"""
routes/webhooks.py — Incoming webhook endpoint for NATS Matrimony.

POST /api/webhook
    Receives signed JSON events from external services (Zapier, Make, custom
    integrations) or from the frontend for internal triggers.

Security
--------
Every request must include the header:
    X-NATS-Signature: sha256=<hex_digest>

The digest is computed as:
    HMAC-SHA256(key=WEBHOOK_SECRET, msg=raw_request_body)

Requests without a valid signature are rejected with 401.

Supported event types
---------------------
  new_registration        — welcome email to a newly registered user
  interest_received       — notify receiver that someone sent an interest
  interest_accepted       — notify original sender that their interest was accepted
  custom_notification     — push an arbitrary in-app notification to a profile

Payload shape (all fields that apply to the event type):
  {
    "event":              "interest_received",
    "receiver_email":     "...",
    "receiver_name":      "...",
    "sender_name":        "...",
    "sender_profile_id":  "...",

    // for interest_accepted:
    "sender_email":       "...",
    "acceptor_name":      "...",
    "acceptor_profile_id":"...",

    // for new_registration:
    "email":              "...",
    "full_name":          "...",

    // for custom_notification:
    "profile_id":         "...",
    "actor_id":           "...",
    "type":               "...",    // e.g. "system_alert"
    "interest_id":        null      // optional
  }
"""

import hashlib
import hmac
import os

from fastapi import APIRouter, Depends, Header, HTTPException, Request
from sqlalchemy.orm import Session

from database import get_db
from email_utils import (
    send_interest_accepted_email,
    send_interest_received_email,
    send_welcome_email,
)
from models import Notification

router = APIRouter(prefix="/webhook", tags=["webhook"])

_WEBHOOK_SECRET = os.getenv("WEBHOOK_SECRET", "")


# ── Signature verification ────────────────────────────────────────────────────

def _verify_signature(body: bytes, signature_header: str) -> bool:
    """
    Validate X-NATS-Signature: sha256=<hex>
    Returns True when the signature matches, False otherwise.
    """
    if not _WEBHOOK_SECRET:
        # If no secret is configured, skip verification (dev convenience only).
        return True

    if not signature_header or not signature_header.startswith("sha256="):
        return False

    expected = hmac.new(
        _WEBHOOK_SECRET.encode(),
        body,
        hashlib.sha256,
    ).hexdigest()

    provided = signature_header[len("sha256="):]
    return hmac.compare_digest(expected, provided)


# ── Route ─────────────────────────────────────────────────────────────────────

@router.post("", status_code=200)
async def handle_webhook(
    request: Request,
    x_nats_signature: str = Header(default=""),
    db: Session = Depends(get_db),
):
    """
    Receive a signed JSON event and perform the corresponding action
    (send email, create in-app notification, or both).
    """
    body = await request.body()

    # ── Verify signature ──────────────────────────────────────────────────────
    if not _verify_signature(body, x_nats_signature):
        raise HTTPException(status_code=401, detail="Invalid webhook signature.")

    # ── Parse JSON ────────────────────────────────────────────────────────────
    try:
        payload = await request.json()
    except Exception:
        raise HTTPException(status_code=400, detail="Webhook body must be valid JSON.")

    event = payload.get("event", "").strip()
    if not event:
        raise HTTPException(status_code=400, detail="Missing 'event' field in payload.")

    # ── Dispatch ──────────────────────────────────────────────────────────────

    # ── new_registration ──────────────────────────────────────────────────────
    if event == "new_registration":
        email     = payload.get("email", "").strip()
        full_name = payload.get("full_name", "User").strip()
        if not email:
            raise HTTPException(status_code=400, detail="'email' is required for new_registration.")
        send_welcome_email(email, full_name)
        return {"status": "ok", "action": "welcome_email_queued", "to": email}

    # ── interest_received ─────────────────────────────────────────────────────
    elif event == "interest_received":
        receiver_email    = payload.get("receiver_email", "").strip()
        receiver_name     = payload.get("receiver_name", "User").strip()
        sender_name       = payload.get("sender_name", "Someone").strip()
        sender_profile_id = payload.get("sender_profile_id", "")

        if not receiver_email:
            raise HTTPException(status_code=400, detail="'receiver_email' is required.")

        send_interest_received_email(
            to_email          = receiver_email,
            receiver_name     = receiver_name,
            sender_name       = sender_name,
            sender_profile_id = str(sender_profile_id),
        )
        return {"status": "ok", "action": "interest_received_email_queued", "to": receiver_email}

    # ── interest_accepted ─────────────────────────────────────────────────────
    elif event == "interest_accepted":
        sender_email        = payload.get("sender_email", "").strip()
        sender_name         = payload.get("sender_name", "User").strip()
        acceptor_name       = payload.get("acceptor_name", "Someone").strip()
        acceptor_profile_id = payload.get("acceptor_profile_id", "")

        if not sender_email:
            raise HTTPException(status_code=400, detail="'sender_email' is required.")

        send_interest_accepted_email(
            to_email            = sender_email,
            sender_name         = sender_name,
            acceptor_name       = acceptor_name,
            acceptor_profile_id = str(acceptor_profile_id),
        )
        return {"status": "ok", "action": "interest_accepted_email_queued", "to": sender_email}

    # ── custom_notification ───────────────────────────────────────────────────
    elif event == "custom_notification":
        profile_id  = payload.get("profile_id")
        actor_id    = payload.get("actor_id")
        notif_type  = payload.get("type", "system_alert").strip()
        interest_id = payload.get("interest_id")   # optional

        if not profile_id or not actor_id:
            raise HTTPException(
                status_code=400,
                detail="'profile_id' and 'actor_id' are required for custom_notification."
            )

        notif = Notification(
            profile_id  = profile_id,
            actor_id    = actor_id,
            type        = notif_type,
            interest_id = interest_id,
        )
        db.add(notif)
        db.commit()
        return {
            "status":          "ok",
            "action":          "notification_created",
            "notification_id": str(notif.notification_id),
            "profile_id":      str(profile_id),
        }

    # ── Unknown event ─────────────────────────────────────────────────────────
    else:
        raise HTTPException(
            status_code=422,
            detail=f"Unknown event type '{event}'. "
                   "Supported: new_registration, interest_received, "
                   "interest_accepted, custom_notification."
        )


# ── Health-check for the webhook endpoint ────────────────────────────────────

@router.get("/ping", status_code=200)
def webhook_ping():
    """
    Simple health check — confirm the webhook endpoint is reachable.
    GET /api/webhook/ping → {"status": "ok", "endpoint": "/api/webhook"}
    """
    return {"status": "ok", "endpoint": "/api/webhook"}
