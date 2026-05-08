"""
Auth routes — login and registration.

Password hashing uses passlib + bcrypt.  Plain-text passwords are NEVER stored
or returned.  On successful login we return only the public identity fields
(profile_id, full_name, email) — no token yet, the frontend persists the
profile_id to sessionStorage and sends it with subsequent requests.
"""
import hashlib
import os
from datetime import date
from pathlib import Path
from typing import Optional

import bcrypt as _bcrypt_lib

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from sqlalchemy.orm import Session

from database import get_db
from email_utils import send_welcome_email
from models import Preference, Profile
from schemas import LoginResponse, RegisterRequest, RegisterResponse, UserLogin

router = APIRouter(prefix="/auth", tags=["auth"])

# Upload directory (same folder that StaticFiles serves from main.py)
UPLOADS_DIR = Path(__file__).parent.parent / "uploads" / "profiles"
UPLOADS_DIR.mkdir(parents=True, exist_ok=True)


# ─────────────────────────────────────────────────────────────────────────────
# Utilities — use bcrypt directly (passlib 1.7.4 is broken with bcrypt 4.x)
# ─────────────────────────────────────────────────────────────────────────────

def hash_password(plain: str) -> str:
    """Return a bcrypt hash of the given plain-text password."""
    return _bcrypt_lib.hashpw(plain.encode("utf-8"), _bcrypt_lib.gensalt()).decode("utf-8")


def verify_password(plain: str, hashed: str) -> bool:
    """Return True if the plain-text password matches the stored bcrypt hash."""
    if not hashed:
        return False
    try:
        return _bcrypt_lib.checkpw(plain.encode("utf-8"), hashed.encode("utf-8"))
    except Exception:
        return False


def _compute_age(dob_str: str) -> int:
    """Return age in full years from a 'YYYY-MM-DD' string."""
    dob = date.fromisoformat(dob_str)
    today = date.today()
    return today.year - dob.year - (
        (today.month, today.day) < (dob.month, dob.day)
    )


# ─────────────────────────────────────────────────────────────────────────────
# Routes
# ─────────────────────────────────────────────────────────────────────────────

@router.get("/check-email")
def check_email(email: str, db: Session = Depends(get_db)):
    """Returns {"available": false} if the email is already registered."""
    exists = db.query(Profile).filter(Profile.email.ilike(email.strip())).first()
    return {"available": not bool(exists)}


@router.get("/profile-by-email", response_model=LoginResponse)
def profile_by_email(email: str, db: Session = Depends(get_db)):
    """
    Called after Firebase Authentication succeeds on the frontend.
    Firebase already verified the user's identity, so no password check is
    needed here — we just look up the profile by email and return the identity
    fields the frontend stores in sessionStorage.
    """
    profile = db.query(Profile).filter(
        Profile.email.ilike(email.strip()),
        Profile.is_active == True,
    ).first()
    if not profile:
        raise HTTPException(status_code=404, detail="No profile found for this account.")
    return LoginResponse(
        profile_id=profile.profile_id,
        full_name=profile.full_name,
        email=profile.email,
    )


@router.post("/login", response_model=LoginResponse)
def login(data: UserLogin, db: Session = Depends(get_db)):
    # Look up profile by email (case-insensitive)
    profile = db.query(Profile).filter(
        Profile.email.ilike(data.email.strip()),
        Profile.is_active == True,
    ).first()

    # Use the same error message for both "no such email" and "wrong password"
    # to avoid leaking which emails exist.
    if not profile or not verify_password(data.password, profile.password_hash):
        raise HTTPException(status_code=401, detail="Invalid email or password")

    return LoginResponse(
        profile_id=profile.profile_id,
        full_name=profile.full_name,
        email=profile.email,
    )


@router.post("/register", response_model=RegisterResponse, status_code=201)
async def register(
    data: str = Form(...),          # JSON string with all profile fields
    photo: Optional[UploadFile] = File(None),
    db: Session = Depends(get_db),
):
    # ── Parse and validate the JSON payload ──────────────────────────────────
    try:
        reg = RegisterRequest.model_validate_json(data)
    except Exception as exc:
        raise HTTPException(status_code=422, detail=str(exc))

    # ── Email uniqueness ──────────────────────────────────────────────────────
    existing = db.query(Profile).filter(
        Profile.email.ilike(reg.email)
    ).first()
    if existing:
        raise HTTPException(
            status_code=400,
            detail="An account with this email already exists."
        )

    # ── Age from DOB ──────────────────────────────────────────────────────────
    try:
        age = _compute_age(reg.date_of_birth)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid date of birth format.")
    if age < 18:
        raise HTTPException(status_code=400, detail="You must be at least 18 years old.")

    # ── Create Profile ────────────────────────────────────────────────────────
    full_name = f"{reg.first_name.strip()} {reg.last_name.strip()}"
    profile = Profile(
        full_name          = full_name,
        age                = age,
        date_of_birth      = reg.date_of_birth,
        gender             = reg.gender,
        height             = reg.height,
        religion           = reg.religion,
        caste              = reg.caste or None,
        sub_caste          = reg.sub_caste or None,
        gothram            = reg.gothram or None,
        mother_tongue      = reg.mother_tongue,
        education          = reg.education or None,
        profession         = reg.profession or None,
        annual_income      = reg.annual_income or None,
        about_me           = reg.about_me or None,
        current_city       = reg.current_city or None,
        current_state      = reg.current_state or None,
        native_place       = reg.native_place or None,
        marital_status     = reg.marital_status,
        profile_created_by = reg.profile_created_by,
        phone              = reg.phone or None,
        email              = reg.email,
        password_hash      = hash_password(reg.password),
        is_active          = True,
    )
    db.add(profile)
    db.flush()   # populate profile.profile_id before we use it below

    # ── Save uploaded photo ───────────────────────────────────────────────────
    if photo and photo.filename:
        content = await photo.read()
        photo_hash = hashlib.sha256(content).hexdigest()

        # Reject if another profile already uses this exact photo
        duplicate = db.query(Profile).filter(
            Profile.photo_hash == photo_hash
        ).first()
        if duplicate:
            raise HTTPException(
                status_code=409,
                detail="This photo is already used by another profile. Please upload a different photo."
            )

        suffix = Path(photo.filename).suffix.lower() or ".jpg"
        dest = UPLOADS_DIR / f"{profile.profile_id}{suffix}"
        dest.write_bytes(content)
        profile.profile_photo_url = f"/uploads/profiles/{profile.profile_id}{suffix}"
        profile.photo_hash = photo_hash

    # ── Create Preference ─────────────────────────────────────────────────────
    opposite = "Female" if reg.gender == "Male" else "Male"
    pref = Preference(
        profile_id             = profile.profile_id,
        pref_age_min           = reg.pref_age_min,
        pref_age_max           = reg.pref_age_max,
        pref_gender            = opposite,
        pref_height_min        = reg.pref_height_min or None,
        pref_height_max        = reg.pref_height_max or None,
        pref_education         = reg.pref_education or None,
        pref_profession        = reg.pref_profession or None,
        pref_location          = reg.pref_location or None,
        pref_marital_statuses  = reg.pref_marital_statuses or None,
    )
    db.add(pref)
    db.commit()

    # Send confirmation email (non-blocking — runs in background thread)
    send_welcome_email(profile.email, profile.full_name)

    return RegisterResponse(message="Registration successful! Please log in.")
