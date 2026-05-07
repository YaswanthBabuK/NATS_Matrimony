from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from database import get_db
from models import Profile, Wishlist
from routes.profiles import profile_to_response
from schemas import WishlistCreate

router = APIRouter(prefix="/wishlists", tags=["wishlists"])


@router.post("", status_code=201)
def add_wishlist(data: WishlistCreate, db: Session = Depends(get_db)):
    if data.profile_id == data.saved_profile_id:
        raise HTTPException(status_code=400, detail="Cannot wishlist yourself")

    existing = db.query(Wishlist).filter(
        Wishlist.profile_id == data.profile_id,
        Wishlist.saved_profile_id == data.saved_profile_id,
    ).first()
    if existing:
        raise HTTPException(status_code=409, detail="Already wishlisted")

    entry = Wishlist(
        profile_id=data.profile_id,
        saved_profile_id=data.saved_profile_id,
    )
    db.add(entry)
    db.commit()
    db.refresh(entry)

    saved = db.query(Profile).filter(Profile.profile_id == data.saved_profile_id).first()
    return {
        "wishlist_id": entry.wishlist_id,
        "profile_id": entry.profile_id,
        "saved_profile_id": entry.saved_profile_id,
        "saved_at": entry.saved_at,
        "saved_profile": profile_to_response(saved) if saved else None,
    }


@router.get("/{profile_id}")
def get_wishlist(profile_id: UUID, db: Session = Depends(get_db)):
    entries = db.query(Wishlist).filter(Wishlist.profile_id == profile_id).all()
    result = []
    for entry in entries:
        saved = db.query(Profile).filter(Profile.profile_id == entry.saved_profile_id).first()
        result.append({
            "wishlist_id": entry.wishlist_id,
            "profile_id": entry.profile_id,
            "saved_profile_id": entry.saved_profile_id,
            "saved_at": entry.saved_at,
            "saved_profile": profile_to_response(saved) if saved else None,
        })
    return result


@router.delete("/{wishlist_id}", status_code=204)
def remove_wishlist(wishlist_id: UUID, db: Session = Depends(get_db)):
    entry = db.query(Wishlist).filter(Wishlist.wishlist_id == wishlist_id).first()
    if not entry:
        raise HTTPException(status_code=404, detail="Wishlist entry not found")
    db.delete(entry)
    db.commit()
