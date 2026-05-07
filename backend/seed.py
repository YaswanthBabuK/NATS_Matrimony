"""
Seed script: inserts 50 mock profiles with preferences into the database.
Run: python seed.py

All photos are served from ./uploads/profiles/.
  Males   → files whose name starts with "male"   (e.g. male1 (1).jpeg)
  Females → files whose name starts with "female"  (e.g. female (1).jpeg)
No external API calls are made.
"""
import sys
import os
from pathlib import Path

sys.path.insert(0, os.path.dirname(__file__))

from database import SessionLocal, engine, Base
from models import Interest, Preference, Profile, Wishlist
from routes.auth import hash_password

# ── Local photo directory ─────────────────────────────────────────────────────
PROFILES_PHOTO_DIR = Path(__file__).parent / "uploads" / "profiles"
PROFILES_PHOTO_DIR.mkdir(parents=True, exist_ok=True)

ALLOWED_EXT = {".jpg", ".jpeg", ".png", ".webp"}


def get_local_photos(prefix: str) -> list[str]:
    """
    Return served URL paths for photos whose filename starts with `prefix`.
    Sorted alphabetically so the assignment is deterministic across runs.
    Example: get_local_photos("male")   → ['/uploads/profiles/male1 (1).jpeg', ...]
             get_local_photos("female") → ['/uploads/profiles/female (1).jpeg', ...]
    """
    files = sorted(
        [p for p in PROFILES_PHOTO_DIR.iterdir()
         if p.is_file()
         and p.suffix.lower() in ALLOWED_EXT
         and p.name.lower().startswith(prefix.lower())],
        key=lambda p: p.name.lower(),
    )
    if not files:
        raise FileNotFoundError(
            f"No '{prefix}*' photos found in {PROFILES_PHOTO_DIR}. "
            f"Add the images and re-run."
        )
    return [f"/uploads/profiles/{p.name}" for p in files]


# ── Seed data ─────────────────────────────────────────────────────────────────
DEFAULT_PASSWORD = "password123"

Base.metadata.create_all(bind=engine)

MALE_NAMES = [
    "Arjun Reddy", "Kiran Kumar", "Sai Teja", "Venkat Rao", "Ravi Shankar",
    "Aditya Nair", "Suresh Babu", "Praveen Kumar", "Manoj Chandra", "Vijay Krishna",
    "Rohit Varma", "Srinivas Goud", "Naresh Gupta", "Tarun Sharma", "Deepak Rao",
    "Harish Naidu", "Lokesh Reddy", "Pavan Kalyan", "Charan Singh", "Balaji Murthy",
    "Santosh Kumar", "Rajesh Prasad", "Vamsi Krishna", "Anil Raju", "Ramesh Babu",
]

FEMALE_NAMES = [
    "Priya Lakshmi", "Divya Rani", "Swathi Reddy", "Ananya Sharma", "Kavitha Nair",
    "Sravanthi Rao", "Mounika Devi", "Pavithra Kumar", "Sirisha Goud", "Bhavana Chandra",
    "Haritha Varma", "Madhuri Prasad", "Sunitha Babu", "Rekha Naidu", "Lavanya Murthy",
    "Deepika Rao", "Sandhya Raju", "Pooja Krishnan", "Nandini Reddy", "Aparna Singh",
    "Yamini Devi", "Jyothi Lakshmi", "Revathi Naidu", "Usha Rani", "Meena Kumari",
]

STATES = ["TX", "CA", "NJ", "NY", "IL", "GA", "WA", "FL"]
STATE_CITIES = {
    "TX": ["Houston", "Dallas", "Austin"],
    "CA": ["Sunnyvale", "Fremont", "San Jose"],
    "NJ": ["Edison", "Jersey City", "Newark"],
    "NY": ["New York", "Buffalo", "Albany"],
    "IL": ["Chicago", "Naperville", "Aurora"],
    "GA": ["Atlanta", "Alpharetta", "Marietta"],
    "WA": ["Seattle", "Redmond", "Bellevue"],
    "FL": ["Orlando", "Tampa", "Jacksonville"],
}
EDUCATIONS   = ["Bachelors", "Masters", "PhD", "MBA"]
PROFESSIONS  = ["Software Engineer", "Doctor", "Business Owner", "Teacher",
                "Nurse", "Accountant", "Pharmacist"]
NATIVE_PLACES = ["Hyderabad", "Vijayawada", "Vizag", "Guntur",
                 "Tirupati", "Warangal", "Karimnagar"]
CREATED_BY   = ["Self", "Parent", "Sibling", "Relative"]
HEIGHTS      = ["5'2\"", "5'4\"", "5'6\"", "5'8\"", "5'10\"", "6'0\"", "6'2\""]
INCOMES      = ["$50,000 - $75,000", "$75,000 - $100,000",
                "$100,000 - $150,000", "$150,000+"]
RELIGIONS    = ["Hindu", "Christian", "Muslim"]
CASTES       = ["Kamma", "Reddy", "Brahmin", "Kapu", "Yadav", "Velama", None]

ABOUT_TEMPLATES = [
    "I am a dedicated professional who loves family values and traditional culture. Looking for a life partner who shares similar values.",
    "Family-oriented person with a passion for cooking and travel. I value honesty and commitment in a relationship.",
    "A fun-loving individual who enjoys outdoor activities, cooking, and spending time with family. Seeking a caring and understanding partner.",
    "Hardworking and ambitious professional. I believe in mutual respect and open communication in a relationship.",
    "I come from a close-knit family and value traditions. I enjoy music, travel, and volunteering in the Telugu community.",
]


def pick(lst, idx):
    return lst[idx % len(lst)]


def seed():
    db = SessionLocal()
    try:
        # ── Clear existing data ───────────────────────────────────────────────
        db.query(Wishlist).delete()
        db.query(Interest).delete()
        db.query(Preference).delete()
        db.query(Profile).delete()
        db.commit()

        profiles = []

        # ── Load local photos ─────────────────────────────────────────────────
        male_photos   = get_local_photos("male")
        female_photos = get_local_photos("female")
        print(f"  OK: {len(male_photos)} male photos, {len(female_photos)} female photos loaded from disk.")

        # ── Hash password once (bcrypt is intentionally slow) ─────────────────
        print(f"  Hashing default password '{DEFAULT_PASSWORD}' ...")
        default_hash = hash_password(DEFAULT_PASSWORD)

        # ── 25 male profiles ──────────────────────────────────────────────────
        for i in range(25):
            age_groups = [18, 19, 22, 24, 27, 29, 31, 33, 36, 40, 44]
            age   = age_groups[i % len(age_groups)]
            state = pick(STATES, i)
            city  = pick(STATE_CITIES[state], i)

            if i < 17:   marital = "Never Married"
            elif i < 22: marital = "Divorced"
            else:        marital = "Widowed"

            p = Profile(
                full_name          = MALE_NAMES[i],
                age                = age,
                gender             = "Male",
                height             = pick(HEIGHTS, i + 2),
                religion           = pick(RELIGIONS, i),
                caste              = pick(CASTES, i),
                education          = pick(EDUCATIONS, i),
                profession         = pick(PROFESSIONS, i),
                annual_income      = pick(INCOMES, i),
                current_city       = city,
                current_state      = state,
                native_place       = pick(NATIVE_PLACES, i),
                marital_status     = marital,
                profile_created_by = pick(CREATED_BY, i),
                about_me           = pick(ABOUT_TEMPLATES, i),
                profile_photo_url  = male_photos[i % len(male_photos)],
                phone              = f"+1-{800 + i:03d}-{5550 + i:04d}",
                email              = f"{MALE_NAMES[i].lower().replace(' ', '.')}@example.com",
                password_hash      = default_hash,
                is_active          = True,
            )
            db.add(p)
            db.flush()

            pref = Preference(
                profile_id         = p.profile_id,
                pref_age_min       = max(18, age - 5),
                pref_age_max       = age + 5,
                pref_gender        = "Female",
                pref_education     = pick(EDUCATIONS, i + 1) if i % 2 == 0 else None,
                pref_profession    = pick(PROFESSIONS, i + 1) if i % 3 == 0 else None,
                pref_location      = pick(STATES, i + 2)     if i % 4 == 0 else None,
                willing_to_relocate= i % 3 != 0,
            )
            db.add(pref)
            profiles.append(p)

        # ── 25 female profiles ────────────────────────────────────────────────
        for i in range(25):
            age_groups = [18, 19, 21, 23, 26, 28, 30, 32, 35, 39, 43]
            age   = age_groups[i % len(age_groups)]
            state = pick(STATES, i + 3)
            city  = pick(STATE_CITIES[state], i + 1)

            if i < 18:   marital = "Never Married"
            elif i < 22: marital = "Divorced"
            else:        marital = "Widowed"

            p = Profile(
                full_name          = FEMALE_NAMES[i],
                age                = age,
                gender             = "Female",
                height             = pick(HEIGHTS, i),
                religion           = pick(RELIGIONS, i + 1),
                caste              = pick(CASTES, i + 2),
                education          = pick(EDUCATIONS, i + 2),
                profession         = pick(PROFESSIONS, i + 2),
                annual_income      = pick(INCOMES, i + 1),
                current_city       = city,
                current_state      = state,
                native_place       = pick(NATIVE_PLACES, i + 2),
                marital_status     = marital,
                profile_created_by = pick(CREATED_BY, i + 1),
                about_me           = pick(ABOUT_TEMPLATES, i + 1),
                profile_photo_url  = female_photos[i % len(female_photos)],
                phone              = f"+1-{900 + i:03d}-{5550 + i:04d}",
                email              = f"{FEMALE_NAMES[i].lower().replace(' ', '.')}@example.com",
                password_hash      = default_hash,
                is_active          = True,
            )
            db.add(p)
            db.flush()

            pref = Preference(
                profile_id         = p.profile_id,
                pref_age_min       = max(18, age - 2),
                pref_age_max       = age + 8,
                pref_gender        = "Male",
                pref_education     = pick(EDUCATIONS, i)  if i % 2 == 0 else None,
                pref_profession    = pick(PROFESSIONS, i) if i % 3 == 0 else None,
                pref_location      = pick(STATES, i)      if i % 4 == 0 else None,
                willing_to_relocate= i % 2 == 0,
            )
            db.add(pref)
            profiles.append(p)

        db.commit()
        print(f"  Seeded {len(profiles)} profiles successfully.")
    except Exception as e:
        db.rollback()
        print(f"Error seeding database: {e}")
        raise
    finally:
        db.close()


if __name__ == "__main__":
    seed()
