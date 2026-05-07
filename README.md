# NATS Matrimony Module

A full-stack matrimony platform for the North America Telugu Society (NATS) website, built with **FastAPI** (backend) and **React + Vite** (frontend).

---

## Features

- Browse 50+ seeded Telugu profiles with filters (gender, age, state, education, profession, marital status)
- Match engine — scores profiles against your preferences
- Send / Accept / Reject interests
- Shortlist profiles
- Contact details revealed only on mutual interest acceptance
- Report profile functionality
- Switch Profile dropdown for testing flows without auth
- Age compliance: profiles under 18 are blocked at API + UI level

---

## Project Structure

```
nats-matrimony/
├── backend/
│   ├── main.py          # FastAPI app + CORS + startup
│   ├── models.py        # SQLAlchemy models (Profile, Preference, Interest, Shortlist)
│   ├── schemas.py       # Pydantic schemas
│   ├── database.py      # PostgreSQL engine + session
│   ├── seed.py          # 50 mock profiles + preferences
│   └── routes/
│       ├── profiles.py  # CRUD + report
│       ├── matches.py   # Match scoring engine
│       ├── interests.py # Send/Accept/Reject
│       └── shortlists.py
└── frontend/
    └── src/
        ├── data/api.js          # Axios API layer
        ├── pages/               # BrowseProfiles, ProfileDetail, MyMatches, MyInterests, Shortlist
        ├── components/          # Navbar, SubNav, ProfileCard, FilterBar, ContactReveal
        ├── styles/nats.css      # NATS brand styles (deep red + gold)
        ├── App.jsx
        └── main.jsx
```

---

## Prerequisites

- Python 3.10+
- Node.js 18+
- PostgreSQL running locally

---

## Backend Setup

```bash
cd backend

# 1. Install dependencies
pip install fastapi uvicorn sqlalchemy psycopg2-binary python-dotenv

# 2. Create PostgreSQL database
# In psql: CREATE DATABASE nats_matrimony;

# 3. Configure environment
# Edit .env — default is:
# DATABASE_URL=postgresql://postgres:password@localhost:5432/nats_matrimony

# 4. Seed 50 mock profiles
python seed.py

# 5. Start the API server
uvicorn main:app --reload
```

API docs available at: http://localhost:8000/docs

---

## Frontend Setup

```bash
cd frontend

# 1. Install dependencies
npm install

# 2. Start dev server
npm run dev
```

App available at: http://localhost:5173

---

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| POST | /api/profiles | Create profile (age ≥ 18 enforced) |
| GET | /api/profiles | List profiles with filters + pagination |
| GET | /api/profiles/{id} | Get profile detail |
| PUT | /api/profiles/{id} | Update profile |
| DELETE | /api/profiles/{id} | Soft delete |
| POST | /api/profiles/{id}/report | Report profile |
| GET | /api/matches/{profile_id} | Get scored matches |
| POST | /api/interests | Send interest |
| GET | /api/interests/sent/{id} | Interests sent |
| GET | /api/interests/received/{id} | Interests received |
| PUT | /api/interests/{id} | Accept / Reject interest |
| POST | /api/shortlists | Add to shortlist |
| GET | /api/shortlists/{profile_id} | Get shortlist |
| DELETE | /api/shortlists/{id} | Remove from shortlist |

---

## Testing the Full Flow

1. Open http://localhost:5173/matrimony
2. Use **Switch Profile** dropdown (top-right of navbar) to select a test profile
3. Browse profiles → click **View Profile** → **Send Interest**
4. Switch to the receiver's profile → go to **Interests** tab → **Accept**
5. Switch back to the sender → view the profile → contact details are now revealed
6. Test **My Matches** to see scored match results
7. Use the ❤️ icon on any card to shortlist profiles

---

## Compliance

- Age < 18: rejected at API (HTTP 400) and filtered in UI
- Contact info hidden until mutual interest acceptance
- Profile Created By shown on all cards and detail pages
- Marital Status badge shown on all cards
- Report button on every profile detail page
