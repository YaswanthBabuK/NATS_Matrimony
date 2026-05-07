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
