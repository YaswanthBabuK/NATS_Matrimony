import re
from datetime import datetime
from typing import Optional
from uuid import UUID
from pydantic import BaseModel, field_validator


# ── 8-4 Rule ─────────────────────────────────────────────────────────────────
# A password is valid when it has ≥ 8 characters AND contains all four
# character classes: uppercase, lowercase, digit, special character.

def _enforce_84_rule(v: str) -> str:
    missing = []
    if len(v) < 8:                          missing.append("at least 8 characters")
    if not re.search(r"[A-Z]", v):          missing.append("an uppercase letter")
    if not re.search(r"[a-z]", v):          missing.append("a lowercase letter")
    if not re.search(r"[0-9]", v):          missing.append("a number")
    if not re.search(r"[^A-Za-z0-9]", v):   missing.append("a special character")
    if missing:
        raise ValueError("Password must include " + ", ".join(missing) + ".")
    return v


# ─────────────────────────────────────────────
# Preference
# ─────────────────────────────────────────────

class PreferenceCreate(BaseModel):
    pref_age_min: int = 18
    pref_age_max: int = 45
    pref_gender: str
    pref_education: Optional[str] = None
    pref_profession: Optional[str] = None
    pref_location: Optional[str] = None
    pref_marital_statuses: Optional[str] = None
    willing_to_relocate: bool = True
    pref_height_min: Optional[str] = None
    pref_height_max: Optional[str] = None


class PreferenceResponse(PreferenceCreate):
    pref_id: UUID
    profile_id: UUID

    class Config:
        from_attributes = True


# ─────────────────────────────────────────────
# Profile
# ─────────────────────────────────────────────

class ProfileCreate(BaseModel):
    full_name: str
    age: int
    gender: str
    height: Optional[str] = None
    religion: Optional[str] = None
    caste: Optional[str] = None
    education: Optional[str] = None
    profession: Optional[str] = None
    annual_income: Optional[str] = None
    current_city: Optional[str] = None
    current_state: Optional[str] = None
    native_place: Optional[str] = None
    marital_status: Optional[str] = None
    profile_created_by: Optional[str] = None
    about_me: Optional[str] = None
    profile_photo_url: Optional[str] = None
    phone: Optional[str] = None
    email: str                            # required — used as login ID
    password: str                         # required — plain-text, hashed by backend before persist
    preference: Optional[PreferenceCreate] = None

    @field_validator("age")
    @classmethod
    def age_must_be_18_or_older(cls, v):
        if v < 18:
            raise ValueError("Age must be 18 or older")
        return v

    @field_validator("password")
    @classmethod
    def password_84_rule(cls, v):
        return _enforce_84_rule(v)


# ─────────────────────────────────────────────
# Auth
# ─────────────────────────────────────────────

class UserLogin(BaseModel):
    email: str
    password: str


class LoginResponse(BaseModel):
    profile_id: UUID
    full_name: str
    email: str


class ProfileUpdate(BaseModel):
    full_name: Optional[str] = None
    date_of_birth: Optional[str] = None
    height: Optional[str] = None
    marital_status: Optional[str] = None
    religion: Optional[str] = None
    caste: Optional[str] = None
    sub_caste: Optional[str] = None
    gothram: Optional[str] = None
    mother_tongue: Optional[str] = None
    education: Optional[str] = None
    profession: Optional[str] = None
    annual_income: Optional[str] = None
    about_me: Optional[str] = None
    current_city: Optional[str] = None
    current_state: Optional[str] = None
    native_place: Optional[str] = None
    profile_created_by: Optional[str] = None
    profile_photo_url: Optional[str] = None
    phone: Optional[str] = None
    email: Optional[str] = None


class ProfileResponse(BaseModel):
    """
    phone and email are ALWAYS None unless contact_revealed=True is explicitly
    set by profile_to_response() after verifying a mutual accepted interest on
    the backend. The frontend MUST pass viewer_id — it cannot set this flag.
    """
    profile_id: UUID
    full_name: str
    age: int
    gender: str
    height: Optional[str] = None
    religion: Optional[str] = None
    caste: Optional[str] = None
    sub_caste: Optional[str] = None
    gothram: Optional[str] = None
    mother_tongue: Optional[str] = None
    date_of_birth: Optional[str] = None
    education: Optional[str] = None
    profession: Optional[str] = None
    annual_income: Optional[str] = None
    current_city: Optional[str] = None
    current_state: Optional[str] = None
    native_place: Optional[str] = None
    marital_status: Optional[str] = None
    profile_created_by: Optional[str] = None
    about_me: Optional[str] = None
    profile_photo_url: Optional[str] = None
    # These two fields are always null unless contact_revealed=True
    phone: Optional[str] = None
    email: Optional[str] = None
    is_active: bool
    is_hidden: bool = False
    created_at: datetime
    email_on_interest_received: bool = True
    email_on_interest_accepted: bool = True
    preference: Optional[PreferenceResponse] = None
    contact_revealed: bool = False

    class Config:
        from_attributes = True


# ─────────────────────────────────────────────
# Registration (multi-step wizard)
# ─────────────────────────────────────────────

class RegisterRequest(BaseModel):
    """Payload sent by the registration wizard (JSON, inside multipart form)."""
    # Step 1 — Basic & Account
    profile_created_by: str = "Self"
    first_name: str
    last_name: str
    gender: str
    date_of_birth: str          # "YYYY-MM-DD" — age is computed on backend
    email: str
    password: str
    phone: Optional[str] = None

    # Step 2 — Personal & Cultural
    marital_status: str = "Never Married"
    height: Optional[str] = None
    religion: str = "Hindu"
    caste: Optional[str] = None
    sub_caste: Optional[str] = None
    gothram: Optional[str] = None
    mother_tongue: str = "Telugu"

    # Step 3 — Education, Profession & Location
    education: Optional[str] = None
    profession: Optional[str] = None
    annual_income: Optional[str] = None
    about_me: Optional[str] = None
    current_city: Optional[str] = None
    current_state: Optional[str] = None
    native_place: Optional[str] = None

    # Step 4 — Partner Preferences
    pref_age_min: int = 18
    pref_age_max: int = 45
    pref_height_min: Optional[str] = None
    pref_height_max: Optional[str] = None
    pref_education: Optional[str] = None
    pref_profession: Optional[str] = None
    pref_location: Optional[str] = None
    pref_marital_statuses: Optional[str] = None   # comma-separated e.g. "Never Married,Divorced"

    @field_validator("password")
    @classmethod
    def password_84_rule(cls, v):
        return _enforce_84_rule(v)

    @field_validator("email")
    @classmethod
    def email_strip(cls, v):
        return v.strip().lower()


class RegisterResponse(BaseModel):
    message: str


# ─────────────────────────────────────────────
# Interest
# ─────────────────────────────────────────────

class InterestCreate(BaseModel):
    sender_profile_id: UUID
    receiver_profile_id: UUID


class InterestResponse(BaseModel):
    interest_id: UUID
    sender_profile_id: UUID
    receiver_profile_id: UUID
    status: str
    sent_at: datetime
    updated_at: datetime
    sender: Optional[ProfileResponse] = None
    receiver: Optional[ProfileResponse] = None

    class Config:
        from_attributes = True


class InterestStatusUpdate(BaseModel):
    status: str

    @field_validator("status")
    @classmethod
    def status_must_be_valid(cls, v):
        if v not in ("accepted", "rejected"):
            raise ValueError("status must be 'accepted' or 'rejected'")
        return v


class InterestBetweenResponse(BaseModel):
    """
    Returned by GET /interests/between/{a_id}/{b_id}.
    Encodes the full bilateral state in one call — used by ProfileDetail
    to determine button state AND contact reveal without fetching all interests.
    """
    sent_by_me: Optional[InterestResponse] = None       # A→B interest record
    received_by_me: Optional[InterestResponse] = None   # B→A interest record
    contact_revealed: bool = False                       # True when either side accepted


# ─────────────────────────────────────────────
# Wishlist
# ─────────────────────────────────────────────

class WishlistCreate(BaseModel):
    profile_id: UUID
    saved_profile_id: UUID


class WishlistResponse(BaseModel):
    wishlist_id: UUID
    profile_id: UUID
    saved_profile_id: UUID
    saved_at: datetime
    saved_profile: Optional[ProfileResponse] = None

    class Config:
        from_attributes = True
