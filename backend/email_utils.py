"""
email_utils.py — Transactional email helpers for NATS Matrimony.

Uses Resend (https://resend.com) — a simple HTTP webhook API.
No SMTP, no 2-step verification, no Gmail App Password needed.
Just one API key from resend.com (free tier: 3 000 emails / month).

Setup (one-time, ~2 minutes):
  1. Sign up at https://resend.com  (free, no credit card)
  2. Copy the API key shown on the dashboard  (starts with  re_...)
  3. Paste it into backend/.env  →  RESEND_API_KEY=re_xxxxxxxxxxxx
  4. During development the FROM address must be:
         onboarding@resend.dev
     After you verify your own domain at resend.com/domains you can
     change RESEND_FROM_EMAIL to any address at that domain.

Environment variables (backend/.env):
    RESEND_API_KEY      — API key from resend.com  (required)
    RESEND_FROM_EMAIL   — Sender address           (default: onboarding@resend.dev)
    RESEND_FROM_NAME    — Display name             (default: NATS Matrimony)
"""

import json
import os
import threading
import urllib.request
import urllib.error

# ── Config ────────────────────────────────────────────────────────────────────

_API_KEY    = os.getenv("RESEND_API_KEY", "")
_FROM_EMAIL = os.getenv("RESEND_FROM_EMAIL", "onboarding@resend.dev")
_FROM_NAME  = os.getenv("RESEND_FROM_NAME", "NATS Matrimony")
_API_URL    = "https://api.resend.com/emails"

# ── Internal helpers ──────────────────────────────────────────────────────────

def _base_html(title: str, body_html: str) -> str:
    """Wrap body_html in a consistent branded email shell."""
    return f"""<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width,initial-scale=1.0"/>
  <title>{title}</title>
</head>
<body style="margin:0;padding:0;background:#f5f0eb;font-family:Georgia,serif;">
  <table width="100%" cellpadding="0" cellspacing="0"
         style="background:#f5f0eb;padding:32px 0;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0"
             style="background:#ffffff;border-radius:12px;overflow:hidden;
                    box-shadow:0 2px 12px rgba(0,0,0,.08);">

        <!-- Header -->
        <tr>
          <td style="background:linear-gradient(135deg,#8B1A1A 0%,#C0392B 100%);
                     padding:28px 40px;text-align:center;">
            <h1 style="margin:0;color:#ffffff;font-size:22px;letter-spacing:2px;
                       font-family:Georgia,serif;">
              🪷 NATS Matrimony
            </h1>
            <p style="margin:4px 0 0;color:#f5c6c6;font-size:13px;letter-spacing:1px;">
              వివాహ వేదిక — Find Your Life Partner
            </p>
          </td>
        </tr>

        <!-- Body -->
        <tr>
          <td style="padding:36px 40px 28px;color:#333333;
                     line-height:1.7;font-size:15px;">
            {body_html}
          </td>
        </tr>

        <!-- Footer -->
        <tr>
          <td style="background:#faf5f0;padding:20px 40px;text-align:center;
                     border-top:1px solid #ede0d4;">
            <p style="margin:0;font-size:12px;color:#999999;">
              © 2025 North America Telugu Society (NATS) Matrimony &nbsp;|&nbsp;
              <a href="https://nats.org"
                 style="color:#8B1A1A;text-decoration:none;">nats.org</a>
            </p>
            <p style="margin:6px 0 0;font-size:11px;color:#bbbbbb;">
              You received this email because you are registered on NATS Matrimony.
            </p>
          </td>
        </tr>

      </table>
    </td></tr>
  </table>
</body>
</html>"""


def _send(to_email: str, subject: str, html: str, plain: str) -> None:
    """POST one email to the Resend API (runs in a background thread)."""
    if not _API_KEY:
        print(f"[email_utils] RESEND_API_KEY not set — skipping email to {to_email}")
        return

    payload = json.dumps({
        "from":    f"{_FROM_NAME} <{_FROM_EMAIL}>",
        "to":      [to_email],
        "subject": subject,
        "html":    html,
        "text":    plain,
    }).encode("utf-8")

    req = urllib.request.Request(
        _API_URL,
        data    = payload,
        headers = {
            "Authorization": f"Bearer {_API_KEY}",
            "Content-Type":  "application/json",
            "User-Agent":    "NATS-Matrimony/1.0",
        },
        method = "POST",
    )

    try:
        with urllib.request.urlopen(req, timeout=15) as resp:
            body = resp.read().decode()
            print(f"[email_utils] ✓ sent '{subject}' → {to_email}  ({resp.status})")
    except urllib.error.HTTPError as exc:
        err_body = exc.read().decode()
        print(f"[email_utils] ✗ Resend API error {exc.code} for '{subject}' → {to_email}: {err_body}")
    except Exception as exc:
        print(f"[email_utils] ✗ failed to send '{subject}' → {to_email}: {exc}")


def _async(fn, *args, **kwargs) -> None:
    """Fire-and-forget: run fn in a daemon thread so HTTP response is instant."""
    threading.Thread(target=fn, args=args, kwargs=kwargs, daemon=True).start()


# ── Public API ────────────────────────────────────────────────────────────────

def send_welcome_email(to_email: str, full_name: str) -> None:
    """Send confirmation email after successful registration."""
    first_name = full_name.split()[0] if full_name else "there"
    subject    = "Welcome to NATS Matrimony! 🪷"

    body_html = f"""
      <h2 style="color:#8B1A1A;margin-top:0;">Namaste, {first_name}! 🙏</h2>
      <p>
        Your profile has been successfully created on
        <strong>NATS Matrimony</strong>. We are delighted to welcome you to our
        community of Telugu families across North America.
      </p>

      <table width="100%" cellpadding="0" cellspacing="0"
             style="background:#fdf6f0;border-radius:8px;padding:20px 24px;
                    border-left:4px solid #8B1A1A;margin:20px 0;">
        <tr><td>
          <p style="margin:0 0 8px;font-weight:bold;color:#8B1A1A;">What's next?</p>
          <ul style="margin:0;padding-left:20px;color:#555555;">
            <li style="margin-bottom:6px;">Browse profiles matched to your preferences</li>
            <li style="margin-bottom:6px;">Send interests to profiles you like</li>
            <li style="margin-bottom:6px;">Save profiles to your wishlist for later</li>
            <li>Complete your profile with a photo to get more responses</li>
          </ul>
        </td></tr>
      </table>

      <p>
        <a href="http://localhost:5173/browse"
           style="display:inline-block;background:#8B1A1A;color:#ffffff;
                  padding:12px 28px;border-radius:6px;text-decoration:none;
                  font-size:15px;font-weight:bold;letter-spacing:0.5px;">
          Start Browsing Profiles →
        </a>
      </p>

      <p style="color:#777777;font-size:13px;margin-top:24px;">
        We wish you all the best on your journey to finding your life partner.
      </p>
      <p style="margin-bottom:0;">Warm regards,<br/>
        <strong>The NATS Matrimony Team</strong>
      </p>"""

    plain = (
        f"Namaste {first_name},\n\n"
        "Your profile has been successfully created on NATS Matrimony.\n\n"
        "Next steps:\n"
        "  • Browse profiles matched to your preferences\n"
        "  • Send interests to profiles you like\n"
        "  • Save profiles to your wishlist\n"
        "  • Complete your profile with a photo\n\n"
        "Visit: http://localhost:5173/browse\n\n"
        "Warm regards,\nThe NATS Matrimony Team"
    )

    _async(_send, to_email, subject, _base_html(subject, body_html), plain)


def send_interest_received_email(
    to_email: str,
    receiver_name: str,
    sender_name: str,
    sender_profile_id: str,
) -> None:
    """Notify the receiver that someone sent them an interest."""
    first_name = receiver_name.split()[0] if receiver_name else "there"
    subject    = f"💌 {sender_name} has sent you an interest on NATS Matrimony"

    body_html = f"""
      <h2 style="color:#8B1A1A;margin-top:0;">You have a new interest! 💌</h2>
      <p>Namaste <strong>{first_name}</strong>,</p>
      <p>
        <strong>{sender_name}</strong> has expressed interest in your profile on
        NATS Matrimony. Take a look at their profile and decide whether you'd
        like to accept or decline.
      </p>

      <table width="100%" cellpadding="0" cellspacing="0"
             style="background:#fdf6f0;border-radius:8px;padding:20px 24px;
                    border-left:4px solid #C0392B;margin:20px 0;">
        <tr><td>
          <p style="margin:0;color:#555555;">
            👤 <strong>{sender_name}</strong> is waiting for your response.
            Log in to view their full profile — contact details are shared
            once you accept.
          </p>
        </td></tr>
      </table>

      <p>
        <a href="http://localhost:5173/interests"
           style="display:inline-block;background:#8B1A1A;color:#ffffff;
                  padding:12px 28px;border-radius:6px;text-decoration:none;
                  font-size:15px;font-weight:bold;letter-spacing:0.5px;">
          View Interest →
        </a>
      </p>

      <p style="margin-bottom:0;">Warm regards,<br/>
        <strong>The NATS Matrimony Team</strong>
      </p>"""

    plain = (
        f"Namaste {first_name},\n\n"
        f"{sender_name} has expressed interest in your profile on NATS Matrimony.\n\n"
        "Log in to view their profile and respond:\n"
        "http://localhost:5173/interests\n\n"
        "Warm regards,\nThe NATS Matrimony Team"
    )

    _async(_send, to_email, subject, _base_html(subject, body_html), plain)


def send_interest_accepted_email(
    to_email: str,
    sender_name: str,
    acceptor_name: str,
    acceptor_profile_id: str,
) -> None:
    """Notify the original sender that their interest was accepted."""
    first_name = sender_name.split()[0] if sender_name else "there"
    subject    = f"🎉 {acceptor_name} accepted your interest on NATS Matrimony!"

    body_html = f"""
      <h2 style="color:#8B1A1A;margin-top:0;">Great news — it's a match! 🎉</h2>
      <p>Namaste <strong>{first_name}</strong>,</p>
      <p>
        <strong>{acceptor_name}</strong> has <strong>accepted</strong> your interest!
        You can now view their full profile including contact details.
      </p>

      <table width="100%" cellpadding="0" cellspacing="0"
             style="background:#fdf6f0;border-radius:8px;padding:20px 24px;
                    border-left:4px solid #27AE60;margin:20px 0;">
        <tr><td>
          <p style="margin:0 0 6px;color:#27AE60;font-size:18px;font-weight:bold;">
            ✅ Mutual Interest Confirmed
          </p>
          <p style="margin:0;color:#555555;">
            Contact details are now visible on the My Matches page.
            Reach out and take the next step!
          </p>
        </td></tr>
      </table>

      <p>
        <a href="http://localhost:5173/matches"
           style="display:inline-block;background:#27AE60;color:#ffffff;
                  padding:12px 28px;border-radius:6px;text-decoration:none;
                  font-size:15px;font-weight:bold;letter-spacing:0.5px;">
          View My Matches →
        </a>
      </p>

      <p style="color:#777777;font-size:13px;margin-top:24px;">
        Wishing you both a wonderful journey ahead. 🪷
      </p>
      <p style="margin-bottom:0;">Warm regards,<br/>
        <strong>The NATS Matrimony Team</strong>
      </p>"""

    plain = (
        f"Namaste {first_name},\n\n"
        f"{acceptor_name} has accepted your interest on NATS Matrimony!\n\n"
        "View their contact details on the My Matches page:\n"
        "http://localhost:5173/matches\n\n"
        "Warm regards,\nThe NATS Matrimony Team"
    )

    _async(_send, to_email, subject, _base_html(subject, body_html), plain)
