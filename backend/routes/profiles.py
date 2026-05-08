import hashlib
from datetime import date
from pathlib import Path
from typing import Optional  # noqa: F401 — used by email-prefs endpoint
from uuid import UUID
from fastapi import APIRouter, Depends, File, HTTPException, Query, UploadFile
from sqlalchemy.orm import Session
from database import get_db
from models import Interest, Notification, Profile, Preference, Wishlist
from routes.auth import hash_password
from schemas import ProfileCreate, ProfileResponse, ProfileUpdate

UPLOADS_DIR = Path(__file__).parent.parent / "uploads" / "profiles"
UPLOADS_DIR.mkdir(parents=True, exist_ok=True)

router = APIRouter(prefix="/profiles", tags=["profiles"])


# ─────────────────────────────────────────────────────────────────────────────
# Helper: build the response dict — single source of truth for contact gating.
#
# contact_revealed is NEVER passed from the outside world.  It is only set to
# True by routes that have already verified a mutual accepted interest in the DB.
# ─────────────────────────────────────────────────────────────────────────────

def profile_to_response(profile: Profile, contact_revealed: bool = False) -> dict:
    pref = None
    if profile.preference:
        p = profile.preference
        pref = {
            "pref_id":             p.pref_id,
            "profile_id":          p.profile_id,
            "pref_age_min":        p.pref_age_min,
            "pref_age_max":        p.pref_age_max,
            "pref_gender":         p.pref_gender,
            "pref_education":      p.pref_education,
            "pref_profession":     p.pref_profession,
            "pref_location":       p.pref_location,
            "pref_marital_statuses": p.pref_marital_statuses,
            "willing_to_relocate": p.willing_to_relocate,
            "pref_height_min":     getattr(p, "pref_height_min", None),
            "pref_height_max":     getattr(p, "pref_height_max", None),
        }

    return {
        "profile_id":        profile.profile_id,
        "full_name":         profile.full_name,
        "age":               profile.age,
        "date_of_birth":     getattr(profile, "date_of_birth", None),
        "gender":            profile.gender,
        "height":            profile.height,
        "religion":          profile.religion,
        "caste":             profile.caste,
        "sub_caste":         getattr(profile, "sub_caste", None),
        "gothram":           getattr(profile, "gothram", None),
        "mother_tongue":     getattr(profile, "mother_tongue", None),
        "education":         profile.education,
        "profession":        profile.profession,
        "annual_income":     profile.annual_income,
        "current_city":      profile.current_city,
        "current_state":     profile.current_state,
        "native_place":      profile.native_place,
        "marital_status":    profile.marital_status,
        "profile_created_by": profile.profile_created_by,
        "about_me":          profile.about_me,
        "profile_photo_url": profile.profile_photo_url,
        # Phone & email only populated when contact_revealed=True
        "phone":   profile.phone  if contact_revealed else None,
        "email":   profile.email  if contact_revealed else None,
        "is_active":  profile.is_active,
        "is_hidden":  getattr(profile, "is_hidden", False),
        "created_at": profile.created_at,
        "preference": pref,
        "contact_revealed": contact_revealed,
    }


def _check_contact_revealed(viewer_id: UUID, target_id: UUID, db: Session) -> bool:
    """
    Returns True only when there is an accepted Interest record between the two
    profiles — regardless of who sent it first.
    """
    if viewer_id == target_id:
        return False

    # Viewer sent interest → target accepted
    fwd = db.query(Interest).filter(
        Interest.sender_profile_id == viewer_id,
        Interest.receiver_profile_id == target_id,
        Interest.status == "accepted",
    ).first()
    if fwd:
        return True

    # Target sent interest → viewer accepted
    rev = db.query(Interest).filter(
        Interest.sender_profile_id == target_id,
        Interest.receiver_profile_id == viewer_id,
        Interest.status == "accepted",
    ).first()
    return bool(rev)


# ─────────────────────────────────────────────────────────────────────────────
# Routes
# ─────────────────────────────────────────────────────────────────────────────

@router.post("", response_model=ProfileResponse, status_code=201)
def create_profile(data: ProfileCreate, db: Session = Depends(get_db)):
    if data.age < 18:
        raise HTTPException(status_code=400, detail="Age must be 18 or older")

    # Enforce unique email — used as login ID
    existing = db.query(Profile).filter(Profile.email.ilike(data.email.strip())).first()
    if existing:
        raise HTTPException(status_code=409, detail="An account with this email already exists")

    profile = Profile(
        full_name=data.full_name,
        age=data.age,
        gender=data.gender,
        height=data.height,
        religion=data.religion,
        caste=data.caste,
        education=data.education,
        profession=data.profession,
        annual_income=data.annual_income,
        current_city=data.current_city,
        current_state=data.current_state,
        native_place=data.native_place,
        marital_status=data.marital_status,
        profile_created_by=data.profile_created_by,
        about_me=data.about_me,
        profile_photo_url=data.profile_photo_url,
        phone=data.phone,
        email=data.email.strip(),
        password_hash=hash_password(data.password),  # never store plain text
    )
    db.add(profile)
    db.flush()

    if data.preference:
        pref = Preference(
            profile_id=profile.profile_id,
            pref_age_min=data.preference.pref_age_min,
            pref_age_max=data.preference.pref_age_max,
            pref_gender=data.preference.pref_gender,
            pref_education=data.preference.pref_education,
            pref_profession=data.preference.pref_profession,
            pref_location=data.preference.pref_location,
            pref_marital_statuses=data.preference.pref_marital_statuses,
            willing_to_relocate=data.preference.willing_to_relocate,
        )
        db.add(pref)

    db.commit()
    db.refresh(profile)
    return profile_to_response(profile)


# ─────────────────────────────────────────────────────────────────────────────
# Preference-match scoring (mirrors frontend scoreProfile logic)
# ─────────────────────────────────────────────────────────────────────────────

def _score_profile(candidate: Profile, viewer_pref, viewer_native_place: str) -> int:
    """
    Return 0-100 indicating how well *candidate* fits *viewer_pref*.
    Mirrors the scoreProfile() function that previously lived in BrowseProfiles.jsx.
    """
    if not viewer_pref:
        return 0

    score   = 0
    max_pts = 25  # age bucket always present

    # 1 · Age (25 pts)
    age_min = viewer_pref.pref_age_min or 18
    age_max = viewer_pref.pref_age_max or 80
    if age_min <= candidate.age <= age_max:
        score += 25

    # 2 · Education (20 pts)
    if viewer_pref.pref_education:
        max_pts += 20
        if candidate.education and viewer_pref.pref_education.lower() in candidate.education.lower():
            score += 20

    # 3 · Profession (20 pts)
    if viewer_pref.pref_profession:
        max_pts += 20
        if candidate.profession and viewer_pref.pref_profession.lower() in candidate.profession.lower():
            score += 20

    # 4 · Location / state (20 pts)
    if viewer_pref.pref_location:
        max_pts += 20
        if candidate.current_state and viewer_pref.pref_location.lower() in candidate.current_state.lower():
            score += 20

    # 5 · Native place (15 pts)
    max_pts += 15
    if (
        viewer_native_place and candidate.native_place and
        viewer_native_place.strip().lower() == (candidate.native_place or "").strip().lower()
    ):
        score += 15

    return round((score / max_pts) * 100) if max_pts > 0 else 0


@router.get("", response_model=list[ProfileResponse])
def list_profiles(
    viewer_id: Optional[UUID] = None,
    gender: Optional[str] = None,
    age_min: Optional[int] = Query(None, ge=18),
    age_max: Optional[int] = None,
    state: Optional[str] = None,
    education: Optional[str] = None,
    profession: Optional[str] = None,
    marital_status: Optional[str] = None,
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    db: Session = Depends(get_db),
):
    query = db.query(Profile).filter(
        Profile.is_active == True,
        Profile.age >= 18,
        Profile.is_hidden == False,
    )

    viewer: Optional[Profile] = None

    if viewer_id:
        query = query.filter(Profile.profile_id != viewer_id)

    # Opposite-gender default (traditional matrimony browse)
    if viewer_id and not gender:
        viewer = db.query(Profile).filter(Profile.profile_id == viewer_id).first()
        if viewer:
            opposite = "Female" if viewer.gender == "Male" else "Male"
            query = query.filter(Profile.gender == opposite)

    if gender:
        query = query.filter(Profile.gender == gender)
    if age_min is not None:
        query = query.filter(Profile.age >= age_min)
    if age_max is not None:
        query = query.filter(Profile.age <= age_max)
    if state:
        query = query.filter(Profile.current_state.ilike(f"%{state}%"))
    if education:
        query = query.filter(Profile.education.ilike(f"%{education}%"))
    if profession:
        query = query.filter(Profile.profession.ilike(f"%{profession}%"))
    if marital_status:
        statuses = [s.strip() for s in marital_status.split(",") if s.strip()]
        if len(statuses) == 1:
            query = query.filter(Profile.marital_status == statuses[0])
        else:
            query = query.filter(Profile.marital_status.in_(statuses))

    offset = (page - 1) * limit

    # ── Ranking (viewer present) ──────────────────────────────────────────────
    # Tier 1 — preference match score (0-100, higher is better)
    # Tier 2 — profiles that already sent a pending interest to the viewer first
    # Tier 3 — newest profiles last as tiebreaker
    if viewer_id:
        if viewer is None:
            viewer = db.query(Profile).filter(Profile.profile_id == viewer_id).first()

        viewer_pref         = viewer.preference if viewer else None
        viewer_native_place = (viewer.native_place or "") if viewer else ""

        # Single query: which profile_ids have sent the viewer a pending interest
        interested_ids = {
            str(row.sender_profile_id)
            for row in db.query(Interest.sender_profile_id).filter(
                Interest.receiver_profile_id == viewer_id,
                Interest.status == "pending",
            ).all()
        }

        # Fetch all qualifying rows (no DB LIMIT — dataset is small, ~50-200 rows)
        all_profiles = query.all()

        all_profiles.sort(key=lambda p: (
            -_score_profile(p, viewer_pref, viewer_native_place),   # tier 1: score high→low
            0 if str(p.profile_id) in interested_ids else 1,        # tier 2: interested first
            -(p.created_at.timestamp() if p.created_at else 0),     # tier 3: newest first
        ))

        profiles = all_profiles[offset: offset + limit]

    else:
        # No viewer context — plain newest-first with DB-level pagination
        profiles = query.order_by(Profile.created_at.desc()).offset(offset).limit(limit).all()

    return [profile_to_response(p) for p in profiles]


@router.get("/{profile_id}", response_model=ProfileResponse)
def get_profile(
    profile_id: UUID,
    # viewer_id replaces the old ?contact_revealed=true parameter.
    # The backend verifies the interest record itself — the client cannot fake this.
    viewer_id: Optional[UUID] = None,
    db: Session = Depends(get_db),
):
    is_owner = viewer_id and viewer_id == profile_id
    if is_owner:
        # Owner can always fetch their own profile (even when hidden)
        profile = db.query(Profile).filter(
            Profile.profile_id == profile_id, Profile.is_active == True
        ).first()
    else:
        profile = db.query(Profile).filter(
            Profile.profile_id == profile_id,
            Profile.is_active == True,
            Profile.is_hidden == False,
        ).first()

    if not profile:
        raise HTTPException(status_code=404, detail="Profile not found")

    # Owner always sees their own contact details; others only if accepted interest
    if is_owner:
        contact_revealed = True
    elif viewer_id:
        contact_revealed = _check_contact_revealed(viewer_id, profile_id, db)
    else:
        contact_revealed = False

    return profile_to_response(profile, contact_revealed)


@router.put("/{profile_id}", response_model=ProfileResponse)
def update_profile(profile_id: UUID, data: ProfileUpdate, db: Session = Depends(get_db)):
    profile = db.query(Profile).filter(Profile.profile_id == profile_id).first()
    if not profile:
        raise HTTPException(status_code=404, detail="Profile not found")

    for field, value in data.model_dump(exclude_none=True).items():
        setattr(profile, field, value)

    # Recalculate age whenever date_of_birth is updated
    if data.date_of_birth:
        try:
            dob = date.fromisoformat(data.date_of_birth)  # expects "YYYY-MM-DD"
            today = date.today()
            profile.age = (
                today.year - dob.year
                - ((today.month, today.day) < (dob.month, dob.day))
            )
        except ValueError:
            pass  # leave age unchanged if the date string is malformed

    db.commit()
    db.refresh(profile)
    return profile_to_response(profile)


@router.patch("/{profile_id}/visibility", status_code=200)
def toggle_visibility(profile_id: UUID, db: Session = Depends(get_db)):
    """Toggle is_hidden — hides/shows the profile in browse without affecting login."""
    profile = db.query(Profile).filter(Profile.profile_id == profile_id).first()
    if not profile:
        raise HTTPException(status_code=404, detail="Profile not found")
    profile.is_hidden = not getattr(profile, "is_hidden", False)
    db.commit()
    return {"is_hidden": profile.is_hidden}


@router.patch("/{profile_id}/photo", status_code=200)
async def update_photo(
    profile_id: UUID,
    photo: UploadFile = File(...),
    db: Session = Depends(get_db),
):
    """Replace the profile photo. Overwrites the previous file on disk."""
    profile = db.query(Profile).filter(Profile.profile_id == profile_id).first()
    if not profile:
        raise HTTPException(status_code=404, detail="Profile not found")

    content = await photo.read()
    photo_hash = hashlib.sha256(content).hexdigest()

    # Reject if a DIFFERENT profile already uses this exact photo
    duplicate = db.query(Profile).filter(
        Profile.photo_hash == photo_hash,
        Profile.profile_id != profile_id,
    ).first()
    if duplicate:
        raise HTTPException(
            status_code=409,
            detail="This photo is already used by another profile. Please upload a different photo."
        )

    from cloudinary_utils import upload_photo
    photo_url = upload_photo(content, str(profile_id))
    profile.profile_photo_url = photo_url
    profile.photo_hash = photo_hash
    db.commit()
    return {"profile_photo_url": profile.profile_photo_url}


@router.delete("/{profile_id}", status_code=204)
def delete_profile(profile_id: UUID, db: Session = Depends(get_db)):
    """Permanently removes the account and all associated data."""
    profile = db.query(Profile).filter(Profile.profile_id == profile_id).first()
    if not profile:
        raise HTTPException(status_code=404, detail="Profile not found")

    # Delete related rows explicitly to avoid FK constraint violations.
    # Order matters: Notifications reference Interests, so delete Notifications first.
    db.query(Notification).filter(
        (Notification.profile_id == profile_id) | (Notification.actor_id == profile_id)
    ).delete(synchronize_session=False)

    db.query(Interest).filter(
        (Interest.sender_profile_id == profile_id) | (Interest.receiver_profile_id == profile_id)
    ).delete(synchronize_session=False)

    db.query(Wishlist).filter(
        (Wishlist.profile_id == profile_id) | (Wishlist.saved_profile_id == profile_id)
    ).delete(synchronize_session=False)

    db.query(Preference).filter(
        Preference.profile_id == profile_id
    ).delete(synchronize_session=False)

    db.delete(profile)
    db.commit()


@router.patch("/{profile_id}/email-prefs", status_code=200)
def update_email_prefs(
    profile_id: UUID,
    email_on_interest_received: Optional[bool] = None,
    email_on_interest_accepted: Optional[bool] = None,
    db: Session = Depends(get_db),
):
    """Update a user's email notification preferences."""
    profile = db.query(Profile).filter(Profile.profile_id == profile_id).first()
    if not profile:
        raise HTTPException(status_code=404, detail="Profile not found")
    if email_on_interest_received is not None:
        profile.email_on_interest_received = email_on_interest_received
    if email_on_interest_accepted is not None:
        profile.email_on_interest_accepted = email_on_interest_accepted
    db.commit()
    return {
        "email_on_interest_received": profile.email_on_interest_received,
        "email_on_interest_accepted": profile.email_on_interest_accepted,
    }


@router.post("/{profile_id}/report", status_code=200)
def report_profile(profile_id: UUID, db: Session = Depends(get_db)):
    profile = db.query(Profile).filter(Profile.profile_id == profile_id).first()
    if not profile:
        raise HTTPException(status_code=404, detail="Profile not found")
    print(f"[REPORT] Profile {profile_id} ({profile.full_name}) has been reported.")
    return {"message": "Profile reported successfully. Our team will review it shortly."}
