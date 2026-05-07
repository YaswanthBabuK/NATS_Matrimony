from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from database import get_db
from models import Notification

router = APIRouter(prefix="/notifications", tags=["notifications"])


def _notif_to_dict(n: Notification) -> dict:
    actor = n.actor
    return {
        "notification_id":  str(n.notification_id),
        "profile_id":       str(n.profile_id),
        "actor_id":         str(n.actor_id),
        "actor_name":       actor.full_name if actor else "Someone",
        "actor_photo":      actor.profile_photo_url if actor else None,
        "type":             n.type,
        "interest_id":      str(n.interest_id) if n.interest_id else None,
        "is_read":          n.is_read,
        "created_at":       n.created_at.isoformat(),
    }


@router.get("/{profile_id}")
def get_notifications(profile_id: UUID, db: Session = Depends(get_db)):
    """Return all notifications for a user, newest first."""
    notifs = (
        db.query(Notification)
        .filter(Notification.profile_id == profile_id)
        .order_by(Notification.created_at.desc())
        .limit(50)
        .all()
    )
    return [_notif_to_dict(n) for n in notifs]


@router.patch("/{notification_id}/read", status_code=200)
def mark_read(notification_id: UUID, db: Session = Depends(get_db)):
    """Mark a single notification as read."""
    n = db.query(Notification).filter(Notification.notification_id == notification_id).first()
    if not n:
        raise HTTPException(status_code=404, detail="Notification not found")
    n.is_read = True
    db.commit()
    return {"ok": True}


@router.patch("/read-all/{profile_id}", status_code=200)
def mark_all_read(profile_id: UUID, db: Session = Depends(get_db)):
    """Mark every notification for a user as read."""
    db.query(Notification).filter(
        Notification.profile_id == profile_id,
        Notification.is_read == False,
    ).update({"is_read": True})
    db.commit()
    return {"ok": True}
