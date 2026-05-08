import os
import random
import traceback

from fastapi import FastAPI, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import JSONResponse

from database import Base, engine, SessionLocal
from models import Profile, Preference
from routes import auth, interests, matches, notifications, profiles, webhooks, wishlists
from routes.auth import hash_password

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
UPLOADS_DIR = os.path.join(os.path.dirname(__file__), "uploads")
os.makedirs(os.path.join(UPLOADS_DIR, "profiles"), exist_ok=True)
app.mount("/uploads", StaticFiles(directory=UPLOADS_DIR), name="uploads")


@app.on_event("startup")
def startup():
    Base.metadata.create_all(bind=engine)

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
def seed_database(token: str = Query(default="")):
    """One-time seed endpoint — protected by SEED_TOKEN env var."""
    try:
        expected = os.getenv("SEED_TOKEN", "")
        if not expected or token != expected:
            return JSONResponse(status_code=403, content={"detail": "Forbidden"})

        db = SessionLocal()
        try:
            existing = db.query(Profile).count()
            if existing >= 10:
                return {"message": "Already seeded", "count": existing}

            first_names_m = ["Arjun", "Kiran", "Vikram", "Rahul", "Suresh", "Anil", "Deepak", "Ravi",
                             "Sanjay", "Manoj", "Ajay", "Vinay", "Naresh", "Ramesh", "Ganesh",
                             "Sunil", "Rajesh", "Praveen", "Santosh", "Harish"]
            first_names_f = ["Priya", "Anjali", "Divya", "Pooja", "Swathi", "Lakshmi", "Kavya", "Sneha",
                             "Sruthi", "Manasa", "Padma", "Sunita", "Rekha", "Usha", "Anitha",
                             "Lavanya", "Bhavana", "Sirisha", "Madhuri", "Aparna"]
            last_names  = ["Reddy", "Sharma", "Rao", "Kumar", "Naidu", "Chandra", "Varma", "Goud", "Prasad", "Raju"]
            cities      = ["Hyderabad", "Vijayawada", "Visakhapatnam", "Tirupati", "Warangal", "Guntur"]
            educations  = ["B.Tech", "M.Tech", "MBA", "MBBS", "B.Com", "M.Sc", "B.Sc", "CA"]
            professions = ["Software Engineer", "Doctor", "Teacher", "Business", "Government Employee", "Banker"]
            castes      = ["Kamma", "Reddy", "Kapu", "Brahmin", "Velama", "Yadav"]

            # Hash once and reuse — bcrypt is slow; hashing 50x on 0.1-CPU would timeout
            hashed_pw = hash_password("Test@1234")

            profiles_added = 0
            for i in range(50):
                gender   = "Male" if i < 25 else "Female"
                fname    = random.choice(first_names_m if gender == "Male" else first_names_f)
                lname    = random.choice(last_names)
                age      = random.randint(22, 38)
                city     = random.choice(cities)
                email    = f"{fname.lower()}.{lname.lower()}{i}@example.com"

                if db.query(Profile).filter(Profile.email == email).first():
                    continue

                full_name = f"{fname} {lname}"
                # Use UI Avatars for instant, permanent photo URLs — no upload needed
                bg = "e8b4b8" if gender == "Female" else "b4c8e8"
                avatar_url = (
                    f"https://ui-avatars.com/api/?name={fname}+{lname}"
                    f"&size=400&background={bg}&color=fff&bold=true&rounded=true"
                )
                p = Profile(
                    email             = email,
                    password_hash     = hashed_pw,
                    full_name         = full_name,
                    gender            = gender,
                    age               = age,
                    date_of_birth     = f"{2026 - age}-06-15",
                    height            = f"{random.randint(155, 185)} cm",
                    caste             = random.choice(castes),
                    mother_tongue     = "Telugu",
                    education         = random.choice(educations),
                    profession        = random.choice(professions),
                    current_city      = city,
                    marital_status    = "Never Married",
                    about_me          = f"I am {fname}, a {random.choice(professions).lower()} from {city}.",
                    profile_photo_url = avatar_url,
                )
                db.add(p)
                db.flush()

                pref = Preference(
                    profile_id            = p.profile_id,
                    pref_gender           = "Female" if gender == "Male" else "Male",
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
            total = db.query(Profile).count()
            return {"message": "Seeded successfully", "added": profiles_added, "total": total}

        except Exception as e:
            db.rollback()
            return JSONResponse(status_code=500, content={"error": str(e), "trace": traceback.format_exc()})
        finally:
            db.close()

    except Exception as outer_e:
        return JSONResponse(status_code=500, content={"error": str(outer_e), "trace": traceback.format_exc()})


@app.get("/api/test-accounts")
def test_accounts(token: str = Query(default="")):
    """List all seeded test account emails (protected by SEED_TOKEN)."""
    try:
        expected = os.getenv("SEED_TOKEN", "")
        if not expected or token != expected:
            return JSONResponse(status_code=403, content={"detail": "Forbidden"})

        db = SessionLocal()
        try:
            profiles = (
                db.query(Profile.email, Profile.full_name, Profile.gender)
                .filter(Profile.email.like("%@example.com"))
                .order_by(Profile.full_name)
                .all()
            )
            return {
                "password": "Test@1234",
                "accounts": [
                    {"email": p.email, "name": p.full_name, "gender": p.gender}
                    for p in profiles
                ],
            }
        finally:
            db.close()
    except Exception as e:
        return JSONResponse(status_code=500, content={"error": str(e)})


@app.get("/api/fix-photos")
def fix_seed_photos(token: str = Query(default="")):
    """Backfill UI-Avatar photo URLs for any seeded profiles missing a photo."""
    try:
        expected = os.getenv("SEED_TOKEN", "")
        if not expected or token != expected:
            return JSONResponse(status_code=403, content={"detail": "Forbidden"})

        db = SessionLocal()
        try:
            profiles = db.query(Profile).filter(Profile.profile_photo_url == None).all()
            updated = 0
            for p in profiles:
                fname = p.full_name.split()[0] if p.full_name else "User"
                lname = p.full_name.split()[-1] if p.full_name and len(p.full_name.split()) > 1 else ""
                bg = "e8b4b8" if p.gender == "Female" else "b4c8e8"
                p.profile_photo_url = (
                    f"https://ui-avatars.com/api/?name={fname}+{lname}"
                    f"&size=400&background={bg}&color=fff&bold=true&rounded=true"
                )
                updated += 1
            db.commit()
            return {"message": "Photos fixed", "updated": updated}
        except Exception as e:
            db.rollback()
            return JSONResponse(status_code=500, content={"error": str(e)})
        finally:
            db.close()
    except Exception as e:
        return JSONResponse(status_code=500, content={"error": str(e)})
