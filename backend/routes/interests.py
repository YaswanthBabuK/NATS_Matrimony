from datetime import datetime
from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from database import get_db
from email_utils import send_interest_accepted_email, send_interest_received_email
from models import Interest, Notification, Profile
from routes.profiles import profile_to_response
from schemas import InterestBetweenResponse, InterestCreate, InterestStatusUpdate

router = APIRouter(prefix="/interests", tags=["interests"])


# ─────────────────────────────────────────────────────────────────────────────
# Notification helper
# ─────────────────────────────────────────────────────────────────────────────

def _create_notification(db: Session, *, profile_id, actor_id, type: str, interest_id):
    """Insert a notification row without committing (caller commits)."""
    notif = Notification(
        profile_id=profile_id,
        actor_id=actor_id,
        type=type,
        interest_id=interest_id,
    )
    db.add(notif)


# ─────────────────────────────────────────────────────────────────────────────
# Interest serialiser
# ─────────────────────────────────────────────────────────────────────────────

def interest_to_response(interest: Interest, db: Session) -> dict:
    sender   = db.query(Profile).filter(Profile.profile_id == interest.sender_profile_id).first()
    receiver = db.query(Profile).filter(Profile.profile_id == interest.receiver_profile_id).first()

    # Contact is revealed for BOTH parties the moment the receiver accepts.
    # There is exactly one Interest record per pair; "accepted" means the receiver said yes.
    contact_revealed = (interest.status == "accepted")

    return {
        "interest_id":          interest.interest_id,
        "sender_profile_id":    interest.sender_profile_id,
        "receiver_profile_id":  interest.receiver_profile_id,
        "status":               interest.status,
        "sent_at":              interest.sent_at,
        "updated_at":           interest.updated_at,
        "sender":   profile_to_response(sender,   contact_revealed) if sender   else None,
        "receiver": profile_to_response(receiver, contact_revealed) if receiver else None,
    }


# ─────────────────────────────────────────────────────────────────────────────
# Routes
# ─────────────────────────────────────────────────────────────────────────────

@router.post("", status_code=201)
def send_interest(data: InterestCreate, db: Session = Depends(get_db)):
    if data.sender_profile_id == data.receiver_profile_id:
        raise HTTPException(status_code=400, detail="Cannot send interest to yourself")

    # Block if sender already sent an interest (any status) to this receiver
    existing = db.query(Interest).filter(
        Interest.sender_profile_id   == data.sender_profile_id,
        Interest.receiver_profile_id == data.receiver_profile_id,
    ).first()
    if existing:
        if existing.status == "rejected":
            raise HTTPException(
                status_code=409,
                detail="This profile has already declined your interest. You cannot send another."
            )
        raise HTTPException(status_code=409, detail="Interest already sent")

    # Block if the RECEIVER already sent an interest to the SENDER that was rejected —
    # i.e., the sender previously declined the receiver. In traditional matrimony this
    # is a soft block: sender can still proceed, but log a note. We allow it (remove this
    # block if you want strict two-way rejection).
    # Also block if receiver already rejected sender in a reverse interest (edge case)
    reverse_rejected = db.query(Interest).filter(
        Interest.sender_profile_id   == data.receiver_profile_id,
        Interest.receiver_profile_id == data.sender_profile_id,
        Interest.status              == "rejected",
    ).first()
    if reverse_rejected:
        raise HTTPException(
            status_code=409,
            detail="You previously declined an interest from this profile. You cannot send a new interest to them."
        )

    sender = db.query(Profile).filter(Profile.profile_id == data.sender_profile_id).first()
    if not sender:
        raise HTTPException(status_code=404, detail="Sender profile not found")

    receiver = db.query(Profile).filter(Profile.profile_id == data.receiver_profile_id).first()
    if not receiver:
        raise HTTPException(status_code=404, detail="Receiver profile not found")

    interest = Interest(
        sender_profile_id   = data.sender_profile_id,
        receiver_profile_id = data.receiver_profile_id,
        status              = "pending",
    )
    db.add(interest)
    db.flush()  # get interest_id before commit

    # Notify the receiver that someone sent them an interest
    _create_notification(
        db,
        profile_id  = data.receiver_profile_id,
        actor_id    = data.sender_profile_id,
        type        = "interest_received",
        interest_id = interest.interest_id,
    )

    db.commit()
    db.refresh(interest)

    # Email the receiver only if they haven't opted out
    if receiver.email and getattr(receiver, "email_on_interest_received", True):
        send_interest_received_email(
            to_email          = receiver.email,
            receiver_name     = receiver.full_name,
            sender_name       = sender.full_name,
            sender_profile_id = str(sender.profile_id),
        )

    return interest_to_response(interest, db)


@router.get("/between/{a_id}/{b_id}")
def get_interest_between(a_id: UUID, b_id: UUID, db: Session = Depends(get_db)):
    """
    Returns the full bilateral interest state between profile A and profile B
    in a single call. Used by ProfileDetail.jsx to determine button state and
    whether to reveal contact details.

    sent_by_me     = Interest record where A is sender and B is receiver (A→B)
    received_by_me = Interest record where B is sender and A is receiver (B→A)
    contact_revealed = True when either record has status=='accepted'
    """
    a_to_b = db.query(Interest).filter(
        Interest.sender_profile_id   == a_id,
        Interest.receiver_profile_id == b_id,
    ).first()

    b_to_a = db.query(Interest).filter(
        Interest.sender_profile_id   == b_id,
        Interest.receiver_profile_id == a_id,
    ).first()

    contact_revealed = (
        (a_to_b is not None and a_to_b.status == "accepted") or
        (b_to_a is not None and b_to_a.status == "accepted")
    )

    return {
        "sent_by_me":      interest_to_response(a_to_b, db) if a_to_b else None,
        "received_by_me":  interest_to_response(b_to_a, db) if b_to_a else None,
        "contact_revealed": contact_revealed,
    }


@router.get("/sent/{profile_id}")
def get_interests_sent(profile_id: UUID, db: Session = Depends(get_db)):
    interests = (
        db.query(Interest)
        .filter(Interest.sender_profile_id == profile_id)
        .order_by(Interest.sent_at.desc())
        .all()
    )
    return [interest_to_response(i, db) for i in interests]


@router.get("/received/{profile_id}")
def get_interests_received(profile_id: UUID, db: Session = Depends(get_db)):
    interests = (
        db.query(Interest)
        .filter(Interest.receiver_profile_id == profile_id)
        .order_by(Interest.sent_at.desc())
        .all()
    )
    return [interest_to_response(i, db) for i in interests]


@router.delete("/{interest_id}", status_code=204)
def unmatch_interest(interest_id: UUID, db: Session = Depends(get_db)):
    """
    Permanently removes an accepted interest record — effectively 'unmatching'
    both parties. The profile disappears from both users' My Matches page and
    contact details are no longer revealed.
    """
    interest = db.query(Interest).filter(Interest.interest_id == interest_id).first()
    if not interest:
        raise HTTPException(status_code=404, detail="Interest not found")
    db.delete(interest)
    db.commit()


@router.put("/{interest_id}")
def update_interest(interest_id: UUID, data: InterestStatusUpdate, db: Session = Depends(get_db)):
    # Validator in InterestStatusUpdate already ensures accepted|rejected
    interest = db.query(Interest).filter(Interest.interest_id == interest_id).first()
    if not interest:
        raise HTTPException(status_code=404, detail="Interest not found")

    if interest.status != "pending":
        raise HTTPException(
            status_code=409,
            detail=f"Interest already {interest.status}. Cannot update again."
        )

    interest.status     = data.status
    interest.updated_at = datetime.utcnow()

    # Notify the original sender of the interest about the decision
    notif_type = "interest_accepted" if data.status == "accepted" else "interest_rejected"
    _create_notification(
        db,
        profile_id  = interest.sender_profile_id,   # original sender gets notified
        actor_id    = interest.receiver_profile_id,  # the person who accepted/rejected
        type        = notif_type,
        interest_id = interest.interest_id,
    )

    # Fetch both profiles for email (before commit so they're still in session)
    original_sender  = db.query(Profile).filter(Profile.profile_id == interest.sender_profile_id).first()
    acceptor_profile = db.query(Profile).filter(Profile.profile_id == interest.receiver_profile_id).first()

    db.commit()
    db.refresh(interest)

    # Email the original sender only when accepted AND they haven't opted out
    if (data.status == "accepted" and original_sender and original_sender.email
            and acceptor_profile
            and getattr(original_sender, "email_on_interest_accepted", True)):
        send_interest_accepted_email(
            to_email            = original_sender.email,
            sender_name         = original_sender.full_name,
            acceptor_name       = acceptor_profile.full_name,
            acceptor_profile_id = str(acceptor_profile.profile_id),
        )

    return interest_to_response(interest, db)
