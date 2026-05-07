"""
Matchmaking engine — Telugu Matrimony style two-way strict filtering.

Scoring dimensions (max 100 pts):
  25 pts  Age fit        — candidate within viewer's preferred age range (hard filter → always awarded)
  20 pts  Education      — pref_education set and matches candidate
  20 pts  Profession     — pref_profession set and matches candidate
  20 pts  Location/State — pref_location set and matches candidate's state
  15 pts  Native Place   — candidate shares the same Telugu hometown as viewer

Marital status compatibility (traditional rules unless pref_marital_statuses overrides):
  Never Married    → accepts Never Married only
  Divorced/Widowed → accepts Never Married, Divorced, Widowed
  Awaiting Divorce → accepts Divorced, Widowed, Awaiting Divorce

Exclusions:
  • Profiles the viewer has already sent an interest to (any status)
  • Profiles that have rejected the viewer (receiver rejected viewer's interest)
  • Same-gender profiles (hard rule)
"""

from typing import Optional
from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from database import get_db
from models import Interest, Profile
from routes.profiles import profile_to_response

router = APIRouter(prefix="/matches", tags=["matches"])


# ─────────────────────────────────────────────────────────────────────────────
# Helpers
# ─────────────────────────────────────────────────────────────────────────────

# Default compatible marital statuses when pref_marital_statuses is not set
_MARITAL_DEFAULTS: dict[str, list[str]] = {
    "Never Married":    ["Never Married"],
    "Divorced":         ["Never Married", "Divorced", "Widowed"],
    "Widowed":          ["Never Married", "Divorced", "Widowed"],
    "Awaiting Divorce": ["Divorced", "Widowed", "Awaiting Divorce"],
}


def _is_marital_compatible(
    viewer_marital: Optional[str],
    candidate_marital: Optional[str],
    pref_marital_statuses: Optional[str],
) -> bool:
    """Return True if the candidate's marital status is acceptable to the viewer."""
    if not candidate_marital:
        return True  # unknown — don't hard-exclude

    # Explicit preference overrides default rules
    if pref_marital_statuses:
        allowed = {s.strip() for s in pref_marital_statuses.split(",")}
        return candidate_marital in allowed

    # Fallback to sensible defaults
    if not viewer_marital:
        return True
    allowed = _MARITAL_DEFAULTS.get(viewer_marital, [])
    return candidate_marital in allowed if allowed else True


def _parse_height_inches(h: Optional[str]) -> Optional[int]:
    """
    Convert height strings like "5'8\"", "5'8", "5' 8"" to total inches.
    Returns None on parse failure.
    """
    if not h:
        return None
    try:
        cleaned = h.replace('"', "").replace("\u2019", "'").strip()
        if "'" in cleaned:
            parts = cleaned.split("'")
            feet = int(parts[0].strip())
            inches = int(parts[1].strip()) if len(parts) > 1 and parts[1].strip() else 0
            return feet * 12 + inches
    except (ValueError, IndexError):
        return None
    return None


def _score(
    viewer: Profile,
    candidate: Profile,
) -> int:
    """
    Calculate match percentage (0–100) for a candidate against the viewer's
    preferences.  Age overlap is always 25 pts because the candidate already
    passed the hard age filter before _score() is called.
    """
    pref = viewer.preference
    score = 0
    max_pts = 0

    # 1 · Age (25 pts) — always awarded (hard-filtered above)
    max_pts += 25
    score   += 25

    # 2 · Education (20 pts)
    if pref and pref.pref_education:
        max_pts += 20
        if pref.pref_education.lower() in (candidate.education or "").lower():
            score += 20

    # 3 · Profession (20 pts)
    if pref and pref.pref_profession:
        max_pts += 20
        if pref.pref_profession.lower() in (candidate.profession or "").lower():
            score += 20

    # 4 · Location / State (20 pts)
    if pref and pref.pref_location:
        max_pts += 20
        if pref.pref_location.lower() in (candidate.current_state or "").lower():
            score += 20

    # 5 · Native Place — Telugu hometown bonus (15 pts, no pref needed)
    max_pts += 15
    if (
        candidate.native_place
        and viewer.native_place
        and candidate.native_place.strip().lower() == viewer.native_place.strip().lower()
    ):
        score += 15

    # 6 · Height compatibility bonus (up to 5 bonus pts, doesn't increase max)
    #     Traditional: man ideally 2–8 inches taller than woman
    viewer_h    = _parse_height_inches(viewer.height)
    candidate_h = _parse_height_inches(candidate.height)
    if viewer_h and candidate_h:
        if viewer.gender == "Female" and candidate.gender == "Male":
            diff = candidate_h - viewer_h
            if 2 <= diff <= 8:
                score = min(score + 5, max_pts)
        elif viewer.gender == "Male" and candidate.gender == "Female":
            diff = viewer_h - candidate_h
            if 2 <= diff <= 8:
                score = min(score + 5, max_pts)

    return round((score / max_pts) * 100) if max_pts > 0 else 50


# ─────────────────────────────────────────────────────────────────────────────
# Route
# ─────────────────────────────────────────────────────────────────────────────

@router.get("/{profile_id}")
def get_matches(profile_id: UUID, db: Session = Depends(get_db)):
    viewer = db.query(Profile).filter(
        Profile.profile_id == profile_id, Profile.is_active == True
    ).first()
    if not viewer:
        raise HTTPException(status_code=404, detail="Profile not found")

    pref = viewer.preference
    if not pref:
        raise HTTPException(status_code=400, detail="No preferences set for this profile")

    # ── Build exclusion sets ──────────────────────────────────────────────────

    # 1. Profiles the viewer already sent an interest to (pending / accepted / rejected)
    sent_to_ids: set = {
        i.receiver_profile_id
        for i in db.query(Interest)
        .filter(Interest.sender_profile_id == profile_id)
        .all()
    }

    # 2. Profiles that rejected the viewer (viewer was the receiver, they declined)
    rejected_by_ids: set = {
        i.sender_profile_id
        for i in db.query(Interest)
        .filter(
            Interest.receiver_profile_id == profile_id,
            Interest.status              == "rejected",
        )
        .all()
    }

    excluded_ids = sent_to_ids | rejected_by_ids | {profile_id}

    # ── Candidate pool ───────────────────────────────────────────────────────
    candidates = (
        db.query(Profile)
        .filter(
            Profile.is_active  == True,
            Profile.profile_id.notin_(excluded_ids),
            Profile.age        >= 18,
        )
        .all()
    )

    results = []
    for candidate in candidates:

        # Hard rule 1: Strict opposite gender
        if candidate.gender == viewer.gender:
            continue

        # Hard rule 2: Must also match pref_gender (defensive — should equal opposite)
        if pref.pref_gender and candidate.gender != pref.pref_gender:
            continue

        # Hard rule 3: Age range
        if candidate.age < pref.pref_age_min or candidate.age > pref.pref_age_max:
            continue

        # Hard rule 4: Marital status compatibility
        if not _is_marital_compatible(
            viewer.marital_status,
            candidate.marital_status,
            pref.pref_marital_statuses,
        ):
            continue

        match_score = _score(viewer, candidate)

        result = profile_to_response(candidate)
        result["match_score"]  = match_score
        result["created_at"]   = candidate.created_at  # preserved for sort
        results.append(result)

    # Sort: highest match % first, then most recently created profile
    results.sort(
        key=lambda x: (-(x["match_score"]), -(x["created_at"].timestamp() if x["created_at"] else 0))
    )
    return results
