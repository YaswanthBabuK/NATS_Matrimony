import uuid
from datetime import datetime
from sqlalchemy import Boolean, Column, DateTime, ForeignKey, Integer, String, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from database import Base


class Profile(Base):
    __tablename__ = "profiles"

    profile_id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    full_name = Column(String, nullable=False)
    age = Column(Integer, nullable=False)
    gender = Column(String, nullable=False)
    height = Column(String)
    religion = Column(String)
    caste = Column(String, nullable=True)
    education = Column(String)
    profession = Column(String)
    annual_income = Column(String)
    current_city = Column(String)
    current_state = Column(String)
    native_place = Column(String)
    marital_status = Column(String)
    profile_created_by = Column(String)
    about_me = Column(Text)
    profile_photo_url = Column(String)
    photo_hash        = Column(String, nullable=True, unique=True)  # SHA-256 of photo bytes — prevents duplicate uploads
    phone = Column(String, nullable=True)
    email = Column(String, nullable=True, unique=True, index=True)
    password_hash = Column(String, nullable=True)   # bcrypt hash — never returned in API responses
    is_active  = Column(Boolean, default=True)
    is_hidden  = Column(Boolean, default=False)   # hides from browse but keeps login working
    created_at = Column(DateTime, default=datetime.utcnow)
    # ── Email notification preferences ──────────────────────────────────────
    email_on_interest_received = Column(Boolean, default=True)
    email_on_interest_accepted = Column(Boolean, default=True)
    # ── Cultural / registration fields added for full matrimony profile ─────────
    date_of_birth = Column(String, nullable=True)   # stored as "YYYY-MM-DD" string
    mother_tongue = Column(String, nullable=True)
    sub_caste     = Column(String, nullable=True)
    gothram       = Column(String, nullable=True)

    preference = relationship("Preference", back_populates="profile", uselist=False)
    interests_sent = relationship("Interest", foreign_keys="Interest.sender_profile_id", back_populates="sender")
    interests_received = relationship("Interest", foreign_keys="Interest.receiver_profile_id", back_populates="receiver")
    wishlists = relationship("Wishlist", foreign_keys="Wishlist.profile_id", back_populates="profile")


class Preference(Base):
    __tablename__ = "preferences"

    pref_id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    profile_id = Column(UUID(as_uuid=True), ForeignKey("profiles.profile_id"), unique=True, nullable=False)
    pref_age_min = Column(Integer, default=18)
    pref_age_max = Column(Integer, default=45)
    pref_gender = Column(String)
    pref_education = Column(String, nullable=True)
    pref_profession = Column(String, nullable=True)
    pref_location = Column(String, nullable=True)
    # Comma-separated: "Never Married" or "Never Married,Divorced" etc.
    # NULL means: use default compatibility rules based on own marital status
    pref_marital_statuses = Column(String, nullable=True)
    willing_to_relocate   = Column(Boolean, default=True)
    pref_height_min       = Column(String, nullable=True)
    pref_height_max       = Column(String, nullable=True)

    profile = relationship("Profile", back_populates="preference")


class Interest(Base):
    __tablename__ = "interests"

    interest_id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    sender_profile_id = Column(UUID(as_uuid=True), ForeignKey("profiles.profile_id"), nullable=False)
    receiver_profile_id = Column(UUID(as_uuid=True), ForeignKey("profiles.profile_id"), nullable=False)
    status = Column(String, default="pending")
    sent_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    sender = relationship("Profile", foreign_keys=[sender_profile_id], back_populates="interests_sent")
    receiver = relationship("Profile", foreign_keys=[receiver_profile_id], back_populates="interests_received")


class Wishlist(Base):
    __tablename__ = "wishlists"

    wishlist_id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    profile_id = Column(UUID(as_uuid=True), ForeignKey("profiles.profile_id"), nullable=False)
    saved_profile_id = Column(UUID(as_uuid=True), ForeignKey("profiles.profile_id"), nullable=False)
    saved_at = Column(DateTime, default=datetime.utcnow)

    profile = relationship("Profile", foreign_keys=[profile_id], back_populates="wishlists")
    saved_profile = relationship("Profile", foreign_keys=[saved_profile_id])


class Notification(Base):
    """
    One row per event that a user should be told about.
    profile_id  = the recipient (the person who sees this notification)
    actor_id    = the person whose action triggered it
    type        = interest_received | interest_accepted | interest_rejected
    interest_id = the related interest row (SET NULL on cascade-delete so history survives unmatch)
    """
    __tablename__ = "notifications"

    notification_id  = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    profile_id       = Column(UUID(as_uuid=True), ForeignKey("profiles.profile_id", ondelete="CASCADE"), nullable=False)
    actor_id         = Column(UUID(as_uuid=True), ForeignKey("profiles.profile_id", ondelete="CASCADE"), nullable=False)
    type             = Column(String, nullable=False)
    interest_id      = Column(UUID(as_uuid=True), ForeignKey("interests.interest_id", ondelete="SET NULL"), nullable=True)
    is_read          = Column(Boolean, default=False)
    created_at       = Column(DateTime, default=datetime.utcnow)

    actor = relationship("Profile", foreign_keys=[actor_id])
