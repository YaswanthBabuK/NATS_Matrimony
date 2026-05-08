import os

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from database import Base, engine
from routes import auth, interests, matches, notifications, profiles, webhooks, wishlists

app = FastAPI(title="NATS Matrimony API", version="1.0.0")

ALLOWED_ORIGINS = [
    "http://localhost:5173",
    "http://localhost:3000",
    "https://frontend-navy-xi-82.vercel.app",   # production Vercel URL
    os.getenv("FRONTEND_URL", ""),               # override via env var if needed
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=[o for o in ALLOWED_ORIGINS if o],  # filter empty strings
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Static files ─────────────────────────────────────────────────────────────
# Serve uploaded images (profile photos) at /uploads/...
# Make sure the folder exists before mounting so StaticFiles doesn't error out
# on a fresh checkout.
UPLOADS_DIR = os.path.join(os.path.dirname(__file__), "uploads")
os.makedirs(os.path.join(UPLOADS_DIR, "profiles"), exist_ok=True)
app.mount("/uploads", StaticFiles(directory=UPLOADS_DIR), name="uploads")


@app.on_event("startup")
def startup():
    Base.metadata.create_all(bind=engine)

    # ── Safe column migrations (ADD COLUMN IF NOT EXISTS) ────────────────────
    # New columns added after the initial table creation won't be created by
    # create_all, so we run idempotent ALTER TABLE statements on every startup.
    from sqlalchemy import text
    profile_cols = [
        ("date_of_birth", "VARCHAR"),
        ("mother_tongue",  "VARCHAR"),
        ("sub_caste",      "VARCHAR"),
        ("gothram",        "VARCHAR"),
        ("about_me",       "TEXT"),
        ("is_hidden",                   "BOOLEAN DEFAULT FALSE"),
        ("email_on_interest_received",  "BOOLEAN DEFAULT TRUE"),
        ("email_on_interest_accepted",  "BOOLEAN DEFAULT TRUE"),
        ("photo_hash",                  "VARCHAR"),
    ]
    pref_cols = [
        ("pref_height_min",        "VARCHAR"),
        ("pref_height_max",        "VARCHAR"),
        ("pref_education",         "VARCHAR"),
        ("pref_profession",        "VARCHAR"),
        ("pref_location",          "VARCHAR"),
        ("pref_marital_statuses",  "VARCHAR"),
    ]
    with engine.connect() as conn:
        for col, t in profile_cols:
            conn.execute(text(
                f"ALTER TABLE profiles ADD COLUMN IF NOT EXISTS {col} {t}"
            ))
        for col, t in pref_cols:
            conn.execute(text(
                f"ALTER TABLE preferences ADD COLUMN IF NOT EXISTS {col} {t}"
            ))
        conn.commit()


app.include_router(auth.router,          prefix="/api")
app.include_router(profiles.router,      prefix="/api")
app.include_router(matches.router,       prefix="/api")
app.include_router(interests.router,     prefix="/api")
app.include_router(wishlists.router,     prefix="/api")
app.include_router(notifications.router, prefix="/api")
app.include_router(webhooks.router,      prefix="/api")


@app.get("/")
def root():
    return {"message": "NATS Matrimony API is running"}


@app.get("/api/seed")
def seed_database(token: str = ""):
    """One-time seed endpoint — protected by SEED_TOKEN env var."""
    import random
    from database import SessionLocal
    from models import Profile, Preference
    from routes.auth import hash_password

    expected = os.getenv("SEED_TOKEN", "")
    if not expected or token != expected:
        from fastapi import HTTPException
        raise HTTPException(status_code=403, detail="Forbidden")

    db = SessionLocal()
    try:
        if db.query(Profile).count() >= 10:
            return {"message": "Already seeded", "count": db.query(Profile).count()}

        first_names_m = ["Arjun", "Kiran", "Vikram", "Rahul", "Suresh", "Anil", "Deepak", "Ravi", "Sanjay", "Manoj",
                         "Ajay", "Vinay", "Naresh", "Ramesh", "Ganesh", "Sunil", "Rajesh", "Praveen", "Santosh", "Harish"]
        first_names_f = ["Priya", "Anjali", "Divya", "Pooja", "Swathi", "Lakshmi", "Kavya", "Sneha", "Sruthi", "Manasa",
                         "Padma", "Sunita", "Rekha", "Usha", "Anitha", "Lavanya", "Bhavana", "Sirisha", "Madhuri", "Aparna"]
        last_names    = ["Reddy", "Sharma", "Rao", "Kumar", "Naidu", "Chandra", "Varma", "Goud", "Prasad", "Raju"]
        cities        = ["Hyderabad", "Vijayawada", "Visakhapatnam", "Tirupati", "Warangal", "Guntur", "Nellore", "Kurnool"]
        educations    = ["B.Tech", "M.Tech", "MBA", "MBBS", "B.Com", "M.Sc", "B.Sc", "CA"]
        professions   = ["Software Engineer", "Doctor", "Teacher", "Business", "Government Employee", "Banker", "Lawyer"]
        castes        = ["Kamma", "Reddy", "Kapu", "Brahmin", "Velama", "Yadav"]

        profiles_added = 0
        for i in range(50):
            gender   = "Male" if i < 25 else "Female"
            fname    = random.choice(first_names_m if gender == "Male" else first_names_f)
            lname    = random.choice(last_names)
            age      = random.randint(22, 38)
            dob_year = 2026 - age
            email    = f"{fname.lower()}.{lname.lower()}{i}@example.com"

            if db.query(Profile).filter(Profile.email == email).first():
                continue

            p = Profile(
                email             = email,
                password_hash     = hash_password("Test@1234"),
                full_name         = f"{fname} {lname}",
                gender            = gender,
                age               = age,
                date_of_birth     = f"{dob_year}-06-15",
                height            = f"{random.randint(155, 185)} cm",
                caste             = random.choice(castes),
                mother_tongue     = "Telugu",
                education         = random.choice(educations),
                profession        = random.choice(professions),
                current_city      = random.choice(cities),
                marital_status    = "Never Married",
                about_me          = f"I am {fname}, a {random.choice(professions).lower()} from {random.choice(cities)}. Looking for a life partner.",
                profile_photo_url = None,
            )
            db.add(p)
            db.flush()

            pref = Preference(
                profile_id            = p.profile_id,
                pref_age_min          = age - 5,
                pref_age_max          = age + 5,
                pref_height_min       = "155 cm",
                pref_height_max       = "185 cm",
                pref_education        = random.choice(educations),
                pref_profession       = random.choice(professions),
                pref_location         = random.choice(cities),
                pref_marital_statuses = "Never Married",
            )
            db.add(pref)
            profiles_added += 1

        db.commit()
        return {"message": "Seeded successfully", "added": profiles_added, "total": db.query(Profile).count()}
    except Exception as e:
        db.rollback()
        raise
    finally:
        db.close()
