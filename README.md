# Smart Medical Appointment Platform

An AI-powered full-stack healthcare platform that routes patients to the correct medical department based on symptom description, enables nearby doctor discovery, and supports real-time appointment booking — with a self-improving ML model that retrains nightly using admin feedback.

---

## Features

**Patient**
- Symptom-based department prediction using NLP (TF-IDF + Logistic Regression)
- Confidence-aware triage: `final`, `needs_clarification`, or `uncertain`
- Emergency detection with sub-type classification (Cardiac, Trauma, Neuro, Respiratory)
- Geolocation-based nearby doctor discovery (Haversine distance)
- Real-time slot availability and appointment booking
- Patient profile management (age, blood group, allergies, chronic conditions)
- Hospital directory with contact details

**Admin**
- Doctor management (add, edit, delete, toggle availability)
- Availability scheduling via interactive calendar + time slot picker
- Appointment review with feedback (correct / incorrect department)
- Retrain status dashboard (last run, feedback count, threshold)

**ML Pipeline**
- TF-IDF character n-gram vectorizer (3–5 grams) + Logistic Regression
- Nightly scheduled retraining via APScheduler using admin-corrected feedback
- Feedback threshold guard — only retrains when enough new corrections exist
- Retrain logs stored in database with status, sample count, and timestamp

---

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│                     Frontend (Next.js)                  │
│  ┌──────────────┐  ┌──────────────┐  ┌───────────────┐  │
│  │  Landing Page│  │Patient Portal│  │ Admin Dashboard│  │
│  └──────────────┘  └──────────────┘  └───────────────┘  │
└────────────────────────┬────────────────────────────────┘
                         │ REST API (JWT Auth)
┌────────────────────────▼────────────────────────────────┐
│                   Backend (FastAPI)                      │
│                                                          │
│  /predict          → ML model inference                  │
│  /predict/emergency-refine → Emergency sub-type routing  │
│  /doctors/nearby   → Haversine geolocation filter        │
│  /appointments     → Booking & status management         │
│  /admin/*          → Doctor & availability management    │
│  /patient/profile  → Patient health profile              │
│  Scheduler         → Nightly model retraining (00:00)    │
└──────────┬──────────────────────┬───────────────────────┘
           │                      │
┌──────────▼──────┐    ┌──────────▼──────────────────────┐
│   PostgreSQL DB  │    │        ML Model                  │
│                  │    │  TF-IDF (char n-gram 3-5)        │
│  users           │    │  + Logistic Regression           │
│  doctors         │    │  Trained on symptom-department   │
│  appointments    │    │  dataset + admin feedback        │
│  doctor_avail.   │    │  Saved as .pkl, hot-reloaded     │
│  patient_profiles│    │  after nightly retrain           │
│  retrain_log     │    └─────────────────────────────────┘
└──────────────────┘
```

---

## Tech Stack

| Layer     | Technology                                |
|-----------|-------------------------------------------|
| Frontend  | Next.js 14, TypeScript, Tailwind CSS      |
| Backend   | FastAPI, Python                           |
| Database  | PostgreSQL                                |    
| ML        | scikit-learn, TF-IDF, Logistic Regression |
| Auth      | JWT , bcrypt                              |
| Scheduler | APScheduler                               |

---

## Supported Departments

General Medicine · Cardiology · Dermatology · Orthopedics · Neurology · Pediatrics · ENT · Gynecology · Psychiatry · Gastroenterology · Emergency

---

## Project Structure

```
├── backend/
│   ├── main.py          # FastAPI app, all routes, scheduler
│   ├── auth.py          # Signup / Login endpoints
│   ├── schemas.py       # Pydantic models
│   ├── database.py      # DB session
│   ├── security.py      # JWT + password hashing
│   ├── model_loader.py  # Loads .pkl model
│   └── migrate_*.py     # DB migration scripts
├── frontend/
│   ├── app/
│   │   ├── page.tsx         # Landing page
│   │   ├── login/page.tsx   # Login
│   │   ├── signup/page.tsx  # Signup (patient / admin)
│   │   ├── patient/page.tsx # Patient dashboard
│   │   └── admin/page.tsx   # Admin dashboard
│   └── lib/api.ts           # Axios instance
├── src/
│   ├── train.py         # Model training script
│   └── predict.py       # Standalone prediction utility
├── models/
│   └── appointment_model_v1.pkl
└── appointment_dataset.csv
```

---

## Getting Started

### Backend

```bash
# Create and activate virtual environment
python -m venv .venv
.venv\Scripts\activate       # Windows
source .venv/bin/activate    # macOS/Linux

# Install dependencies
pip install -r requirements.txt

# Run migrations
python -m backend.migrate_status
python -m backend.migrate_patient_profile
# ... (run other migrate_*.py scripts as needed)

# Start the API
uvicorn backend.main:app --reload
```

### Frontend

```bash
cd frontend
npm install
npm run dev
```

### Train the Model

```bash
python src/train.py
```

---

## Environment Variables

Create a `.env` file in the root:

```env
DATABASE_URL=postgresql://user:password@localhost:5432/dbname
SECRET_KEY=your_jwt_secret_key
```

---

## ML Model Details

- **Algorithm:** Logistic Regression with character n-gram TF-IDF (3–5 grams)
- **Input:** Free-text symptom description
- **Output:** Predicted department + confidence score + top-3 predictions
- **Confidence thresholds:**
  - `≥ 0.70` → Final prediction
  - `0.45 – 0.70` → Needs clarification
  - `< 0.45` → Uncertain
- **Retraining:** Nightly at 00:00 if ≥ 10 new admin-corrected feedback entries exist since last successful run

---

## API Highlights

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/predict` | Predict department from symptoms |
| POST | `/predict/emergency-refine` | Classify emergency sub-type |
| GET | `/doctors/nearby` | Get doctors sorted by distance |
| POST | `/appointments` | Book an appointment |
| GET | `/appointments/me` | Patient's appointment history |
| POST | `/admin/appointments/{id}/feedback` | Submit prediction feedback |
| GET | `/admin/retrain/status` | View retrain log and threshold |

---

## License

MIT
