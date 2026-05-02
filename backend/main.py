from fastapi import FastAPI, Query
import numpy as np
import math
import logging
from datetime import datetime

from apscheduler.schedulers.background import BackgroundScheduler

from backend.model_loader import load_model
from backend.schemas import PredictionRequest
from backend.database import SessionLocal
from sqlalchemy import text
from backend.auth import router as auth_router
from fastapi import Depends
from backend.schemas import PatientProfileRequest, PatientProfileResponse
from backend.schemas import AppointmentCreate, AppointmentResponse
from backend.dependencies import require_patient, require_admin, get_current_user
from fastapi import HTTPException
from fastapi.middleware.cors import CORSMiddleware
from backend.schemas import (
    DoctorCreate,
    DoctorResponse,
    AvailabilityCreate,
    AvailabilityResponse,
    FeedbackRequest,
    EmergencyRefineRequest,
    EmergencyRefineResponse
)

logger = logging.getLogger(__name__)

app = FastAPI(title="Appointment Reason Classifier API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth_router)

model = load_model()

HIGH_CONF = 0.70
LOW_CONF = 0.45

# ── Scheduled retraining ──────────────────────────────────────────────────────

RETRAIN_FEEDBACK_THRESHOLD = 10  # minimum new feedback rows since last retrain

def _do_retrain():
    """
    Core retrain logic. Runs on schedule or can be called directly.
    Saves result to retrain_log table.
    """
    import pandas as pd
    from sklearn.pipeline import Pipeline
    from sklearn.feature_extraction.text import TfidfVectorizer
    from sklearn.linear_model import LogisticRegression
    import joblib
    global model

    db = SessionLocal()
    try:
        rows = db.execute(
            text("""
                SELECT input_text, predicted_department, corrected_department, is_correct
                FROM appointments
                WHERE is_correct IS NOT NULL AND input_text IS NOT NULL
            """)
        ).fetchall()

        feedback_records = []
        for row in rows:
            label = row.predicted_department if row.is_correct else row.corrected_department
            if label and row.input_text:
                feedback_records.append({"text": row.input_text.strip(), "department": label})

        try:
            original_df = pd.read_csv("appointment_dataset.csv").drop_duplicates(subset=["text"]).dropna()
        except Exception as e:
            _log_retrain(db, "failed", 0, 0, f"Could not load dataset: {e}")
            return

        feedback_df = pd.DataFrame(feedback_records)

        if not feedback_df.empty:
            combined_df = pd.concat([original_df, feedback_df], ignore_index=True)
            combined_df = combined_df.drop_duplicates(subset=["text"], keep="last")
        else:
            combined_df = original_df

        if len(combined_df) < 10:
            _log_retrain(db, "skipped", len(combined_df), len(feedback_df), "Not enough data")
            return

        pipeline = Pipeline([
            ("tfidf", TfidfVectorizer(analyzer="char_wb", ngram_range=(3, 5), min_df=2, max_features=5000)),
            ("clf", LogisticRegression(max_iter=1000, solver="lbfgs", C=2.0))
        ])
        pipeline.fit(combined_df["text"], combined_df["department"])
        joblib.dump(pipeline, "models/appointment_model_v1.pkl")
        model = pipeline

        _log_retrain(db, "success", len(combined_df), len(feedback_df), "Retrained successfully")
        logger.info(f"Scheduled retrain complete — {len(combined_df)} samples ({len(feedback_df)} feedback)")

    except Exception as e:
        logger.error(f"Scheduled retrain failed: {e}")
        try:
            _log_retrain(db, "failed", 0, 0, str(e))
        except Exception:
            pass
    finally:
        db.close()


def _log_retrain(db, status: str, total: int, feedback: int, message: str):
    db.execute(
        text("""
            INSERT INTO retrain_log (ran_at, total_samples, feedback_samples, status, message)
            VALUES (:ran_at, :total, :feedback, :status, :message)
        """),
        {"ran_at": datetime.utcnow(), "total": total, "feedback": feedback,
         "status": status, "message": message}
    )
    db.commit()


def _should_retrain() -> bool:
    """Only retrain if there's new feedback since the last successful run."""
    db = SessionLocal()
    try:
        last = db.execute(
            text("SELECT ran_at FROM retrain_log WHERE status = 'success' ORDER BY ran_at DESC LIMIT 1")
        ).fetchone()
        if not last:
            return True  # never retrained
        count = db.execute(
            text("""
                SELECT COUNT(*) FROM appointments
                WHERE is_correct IS NOT NULL
                  AND created_at > :since
            """),
            {"since": last.ran_at}
        ).scalar()
        return (count or 0) >= RETRAIN_FEEDBACK_THRESHOLD
    finally:
        db.close()


def scheduled_retrain():
    if _should_retrain():
        logger.info("Threshold met — starting scheduled retrain")
        _do_retrain()
    else:
        logger.info("Scheduled retrain skipped — not enough new feedback")


scheduler = BackgroundScheduler()
scheduler.add_job(scheduled_retrain, "cron", hour=0, minute=0, id="nightly_retrain")


@app.on_event("startup")
def startup():
    scheduler.start()
    logger.info("Nightly retrain scheduler started (runs at 00:00)")


@app.on_event("shutdown")
def shutdown():
    scheduler.shutdown(wait=False)


@app.get("/")
def root():
    return {"message": "API is running successfully"}


@app.post("/predict")
def predict(request: PredictionRequest, current_user: dict = Depends(get_current_user)):
    text_input = request.text.lower().strip()

    if len(text_input) < 10 or len(text_input.split()) < 3:
        raise HTTPException(
            status_code=400,
            detail="Please describe your symptoms in at least 3 words for an accurate prediction."
        )
    prediction = model.predict([text_input])[0]
    probabilities = model.predict_proba([text_input])[0]
    confidence = float(np.max(probabilities))
    classes = model.classes_
    top3_indices = np.argsort(probabilities)[-3:][::-1]
    top_3 = [{"department": classes[idx], "confidence": float(probabilities[idx])} for idx in top3_indices]

    if confidence >= HIGH_CONF:
        status = "final"
    elif confidence >= LOW_CONF:
        status = "needs_clarification"
    else:
        status = "uncertain"

    db = SessionLocal()
    db.execute(
        text("INSERT INTO predictions (input_text, predicted_department, confidence, status) VALUES (:input_text, :predicted_department, :confidence, :status)"),
        {"input_text": text_input, "predicted_department": prediction, "confidence": confidence, "status": status}
    )
    db.commit()
    db.close()
    return {"status": status, "predicted_department": prediction, "confidence": confidence, "top_3": top_3}


@app.post("/predict/emergency-refine", response_model=EmergencyRefineResponse)
def refine_emergency(
    request: EmergencyRefineRequest,
    current_user: dict = Depends(get_current_user)
):
    """
    Given the original symptom text and a selected emergency sub-type,
    returns urgency level and care description.
    """
    sub_type_map = {
        "Cardiac": {
            "description": "Possible cardiac emergency — chest pain, palpitations, or suspected heart attack. Immediate ECG and cardiac monitoring required.",
            "urgency": "critical",
            "keywords": ["chest", "heart", "palpitation", "pressure", "arm pain", "jaw pain"]
        },
        "Trauma": {
            "description": "Physical injury or trauma — fractures, deep wounds, head injury, or accident. Immediate trauma assessment required.",
            "urgency": "critical",
            "keywords": ["injury", "accident", "fall", "fracture", "wound", "bleeding", "hit"]
        },
        "Neuro": {
            "description": "Neurological emergency — sudden severe headache, stroke symptoms, seizure, or loss of consciousness.",
            "urgency": "critical",
            "keywords": ["headache", "seizure", "unconscious", "stroke", "paralysis", "vision", "speech"]
        },
        "Respiratory": {
            "description": "Respiratory emergency — severe breathing difficulty, choking, or suspected respiratory failure.",
            "urgency": "critical",
            "keywords": ["breath", "choking", "wheez", "asthma", "oxygen", "suffocating"]
        },
        "Other": {
            "description": "General emergency requiring immediate medical attention. Routed to the Emergency department for triage.",
            "urgency": "high",
            "keywords": []
        }
    }

    text_lower = request.text.lower()
    selected = sub_type_map.get(request.sub_type, sub_type_map["Other"])

    # Auto-upgrade urgency if keywords match
    urgency = selected["urgency"]
    if any(kw in text_lower for kw in selected["keywords"]):
        urgency = "critical"

    return EmergencyRefineResponse(
        sub_type=request.sub_type,
        description=selected["description"],
        urgency=urgency
    )


@app.get("/hospitals")
def get_hospitals():
    """Public endpoint — returns all hospital contact details for patients."""
    db = SessionLocal()
    result = db.execute(
        text("""
            SELECT hospital_name, hospital_phone, hospital_address,
                   hospital_lat, hospital_lng, email, mobile
            FROM users
            WHERE role = 'admin'
              AND hospital_name IS NOT NULL
            ORDER BY hospital_name
        """)
    ).fetchall()
    db.close()
    return [dict(row._mapping) for row in result]


@app.post("/patient/profile")
def create_or_update_profile(profile: PatientProfileRequest, current_user: dict = Depends(require_patient)):
    db = SessionLocal()
    existing = db.execute(
        text("SELECT id FROM patient_profiles WHERE user_id = :user_id"),
        {"user_id": current_user["user_id"]}
    ).fetchone()

    if existing:
        db.execute(
            text("""
                UPDATE patient_profiles
                SET age=:age, gender=:gender, blood_group=:blood_group,
                    height_cm=:height_cm, weight_kg=:weight_kg, address=:address,
                    allergies=:allergies, chronic_conditions=:chronic_conditions
                WHERE user_id=:user_id
            """),
            {**profile.dict(), "user_id": current_user["user_id"]}
        )
    else:
        db.execute(
            text("""
                INSERT INTO patient_profiles
                (user_id, age, gender, blood_group, height_cm, weight_kg, address, allergies, chronic_conditions)
                VALUES (:user_id, :age, :gender, :blood_group, :height_cm, :weight_kg, :address, :allergies, :chronic_conditions)
            """),
            {**profile.dict(), "user_id": current_user["user_id"]}
        )
    db.commit()
    db.close()
    return {"message": "Profile saved successfully"}


@app.get("/patient/profile", response_model=PatientProfileResponse)
def get_profile(current_user: dict = Depends(require_patient)):
    db = SessionLocal()
    result = db.execute(
        text("""
            SELECT u.name, u.email, u.mobile,
                   p.age, p.gender, p.blood_group, p.height_cm, p.weight_kg,
                   p.address, p.allergies, p.chronic_conditions
            FROM users u
            LEFT JOIN patient_profiles p ON p.user_id = u.id
            WHERE u.id = :user_id
        """),
        {"user_id": current_user["user_id"]}
    ).fetchone()
    db.close()
    if not result:
        return PatientProfileResponse(
            name=None, email=None, mobile=None,
            age=None, gender=None, blood_group=None,
            height_cm=None, weight_kg=None, address=None,
            allergies=None, chronic_conditions=None
        )
    return dict(result._mapping)


@app.get("/admin/me")
def get_admin_profile(current_user: dict = Depends(require_admin)):
    db = SessionLocal()
    result = db.execute(
        text("SELECT name, hospital_name, hospital_lat, hospital_lng FROM users WHERE id = :user_id"),
        {"user_id": current_user["user_id"]}
    ).fetchone()
    db.close()
    if not result:
        raise HTTPException(status_code=404, detail="Admin not found")
    return dict(result._mapping)


@app.post("/admin/doctors")
def create_doctor(doctor: DoctorCreate, current_user: dict = Depends(require_admin)):
    db = SessionLocal()
    db.execute(
        text("""
            INSERT INTO doctors (name, department, qualification, experience_years, profile_image,
                                 hospital_name, hospital_lat, hospital_lng)
            VALUES (:name, :department, :qualification, :experience_years, :profile_image,
                    :hospital_name, :hospital_lat, :hospital_lng)
        """),
        doctor.dict()
    )
    db.commit()
    db.close()
    return {"message": "Doctor created successfully"}


@app.get("/admin/doctors", response_model=list[DoctorResponse])
def get_admin_doctors(current_user: dict = Depends(require_admin)):
    """Returns only doctors belonging to this admin's hospital."""
    db = SessionLocal()
    admin = db.execute(
        text("SELECT hospital_name FROM users WHERE id = :user_id"),
        {"user_id": current_user["user_id"]}
    ).fetchone()
    if not admin or not admin.hospital_name:
        db.close()
        return []
    result = db.execute(
        text("""
            SELECT id, name, department, qualification, experience_years,
                   profile_image, available, hospital_name, hospital_lat, hospital_lng
            FROM doctors
            WHERE hospital_name = :hospital_name
        """),
        {"hospital_name": admin.hospital_name}
    ).fetchall()
    db.close()
    return [dict(row._mapping) for row in result]


@app.get("/doctors", response_model=list[DoctorResponse])
def get_doctors(department: str = Query(None)):
    """Public endpoint — returns available doctors, optionally filtered by department (case-insensitive)."""
    db = SessionLocal()
    query = """
        SELECT id, name, department, qualification, experience_years,
               profile_image, available, hospital_name, hospital_lat, hospital_lng
        FROM doctors
        WHERE available = TRUE
    """
    params: dict = {}
    if department:
        query += " AND LOWER(department) = LOWER(:department)"
        params["department"] = department
    result = db.execute(text(query), params).fetchall()
    db.close()
    return [dict(row._mapping) for row in result]


def _haversine(lat1: float, lng1: float, lat2: float, lng2: float) -> float:
    R = 6371
    phi1, phi2 = math.radians(lat1), math.radians(lat2)
    dphi = math.radians(lat2 - lat1)
    dlambda = math.radians(lng2 - lng1)
    a = math.sin(dphi / 2) ** 2 + math.cos(phi1) * math.cos(phi2) * math.sin(dlambda / 2) ** 2
    return R * 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))


@app.get("/doctors/nearby", response_model=list[DoctorResponse])
def get_nearby_doctors(
    lat: float = Query(...),
    lng: float = Query(...),
    department: str = Query(None),
    radius_km: float = Query(100),          # increased default from 50 → 100km
    current_user: dict = Depends(get_current_user)
):
    db = SessionLocal()
    query = """
        SELECT id, name, department, qualification, experience_years,
               profile_image, available, hospital_name, hospital_lat, hospital_lng
        FROM doctors
        WHERE available = TRUE
          AND hospital_lat IS NOT NULL AND hospital_lng IS NOT NULL
    """
    params: dict = {}
    if department:
        query += " AND LOWER(department) = LOWER(:department)"   # case-insensitive
        params["department"] = department
    result = db.execute(text(query), params).fetchall()
    db.close()

    doctors = []
    for row in result:
        d = dict(row._mapping)
        dist = _haversine(lat, lng, d["hospital_lat"], d["hospital_lng"])
        if dist <= radius_km:
            d["distance_km"] = round(dist, 2)
            doctors.append(d)
    doctors.sort(key=lambda x: x["distance_km"])
    return doctors


@app.put("/admin/doctors/{doctor_id}")
def update_doctor(doctor_id: int, doctor: DoctorCreate, current_user: dict = Depends(require_admin)):
    db = SessionLocal()
    db.execute(
        text("""
            UPDATE doctors
            SET name=:name, department=:department, qualification=:qualification,
                experience_years=:experience_years, profile_image=:profile_image,
                hospital_name=:hospital_name, hospital_lat=:hospital_lat, hospital_lng=:hospital_lng
            WHERE id=:doctor_id
        """),
        {**doctor.dict(), "doctor_id": doctor_id}
    )
    db.commit()
    db.close()
    return {"message": "Doctor updated successfully"}


@app.delete("/admin/doctors/{doctor_id}")
def delete_doctor(doctor_id: int, current_user: dict = Depends(require_admin)):
    db = SessionLocal()
    db.execute(text("DELETE FROM doctors WHERE id=:doctor_id"), {"doctor_id": doctor_id})
    db.commit()
    db.close()
    return {"message": "Doctor deleted successfully"}


@app.patch("/admin/doctors/{doctor_id}/availability")
def toggle_doctor_availability(doctor_id: int, current_user: dict = Depends(require_admin)):
    db = SessionLocal()
    result = db.execute(
        text("SELECT available FROM doctors WHERE id = :doctor_id"),
        {"doctor_id": doctor_id}
    ).fetchone()
    if not result:
        db.close()
        raise HTTPException(status_code=404, detail="Doctor not found")
    new_status = not result.available
    db.execute(
        text("UPDATE doctors SET available = :available WHERE id = :doctor_id"),
        {"available": new_status, "doctor_id": doctor_id}
    )
    db.commit()
    db.close()
    return {"available": new_status}


@app.post("/admin/availability")
def add_availability(slot: AvailabilityCreate, current_user: dict = Depends(require_admin)):
    db = SessionLocal()
    existing = db.execute(
        text("""
            SELECT id FROM doctor_availability
            WHERE doctor_id = :doctor_id AND available_date = :available_date AND available_time = :available_time
        """),
        {"doctor_id": slot.doctor_id, "available_date": slot.available_date, "available_time": slot.available_time}
    ).fetchone()
    if existing:
        db.close()
        raise HTTPException(status_code=400, detail="This slot already exists for the doctor")
    db.execute(
        text("INSERT INTO doctor_availability (doctor_id, available_date, available_time) VALUES (:doctor_id, :available_date, :available_time)"),
        {"doctor_id": slot.doctor_id, "available_date": slot.available_date, "available_time": slot.available_time}
    )
    db.commit()
    db.close()
    return {"message": "Availability added"}


@app.get("/doctors/{doctor_id}/availability", response_model=list[AvailabilityResponse])
def get_availability(doctor_id: int):
    db = SessionLocal()
    result = db.execute(
        text("""
            SELECT id, doctor_id, available_date, available_time, is_booked
            FROM doctor_availability
            WHERE doctor_id = :doctor_id
              AND is_booked = FALSE
              AND (available_date > CURRENT_DATE
                   OR (available_date = CURRENT_DATE AND available_time > CURRENT_TIME))
            ORDER BY available_date, available_time
        """),
        {"doctor_id": doctor_id}
    ).fetchall()
    db.close()
    return [dict(row._mapping) for row in result]


@app.get("/admin/doctors/{doctor_id}/slots", response_model=list[AvailabilityResponse])
def get_doctor_slots_admin(doctor_id: int, current_user: dict = Depends(require_admin)):
    """Admin view — returns all upcoming slots for a doctor, including booked ones."""
    db = SessionLocal()
    result = db.execute(
        text("""
            SELECT id, doctor_id, available_date, available_time, is_booked
            FROM doctor_availability
            WHERE doctor_id = :doctor_id
              AND (available_date > CURRENT_DATE
                   OR (available_date = CURRENT_DATE AND available_time > CURRENT_TIME))
            ORDER BY available_date, available_time
        """),
        {"doctor_id": doctor_id}
    ).fetchall()
    db.close()
    return [dict(row._mapping) for row in result]


@app.post("/appointments")
def create_appointment(appointment: AppointmentCreate, current_user: dict = Depends(require_patient)):
    db = SessionLocal()
    try:
        appointment_status = "confirmed"
        if appointment.confidence is None or appointment.confidence < HIGH_CONF:
            appointment_status = "pending_review"

        slot = db.execute(
            text("SELECT id, doctor_id, available_date, available_time, is_booked FROM doctor_availability WHERE id = :availability_id"),
            {"availability_id": appointment.availability_id}
        ).fetchone()
        if not slot:
            raise HTTPException(status_code=404, detail="Slot not found")
        if slot.is_booked:
            raise HTTPException(status_code=400, detail="Slot already booked")
        if slot.doctor_id != appointment.doctor_id:
            raise HTTPException(status_code=400, detail="Doctor and slot do not match")

        db.execute(text("UPDATE doctor_availability SET is_booked = TRUE WHERE id = :availability_id"), {"availability_id": appointment.availability_id})
        db.execute(
            text("""
                INSERT INTO appointments
                (user_id, doctor_id, input_text, predicted_department, appointment_date, appointment_time, status)
                VALUES (:user_id, :doctor_id, :input_text, :predicted_department, :appointment_date, :appointment_time, :status)
            """),
            {
                "user_id": current_user["user_id"],
                "doctor_id": appointment.doctor_id,
                "input_text": appointment.input_text,
                "predicted_department": appointment.predicted_department,
                "appointment_date": slot.available_date,
                "appointment_time": slot.available_time,
                "status": appointment_status
            }
        )
        db.commit()
        return {"message": "Appointment booked successfully", "status": appointment_status}
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        db.close()


@app.get("/appointments/me", response_model=list[AppointmentResponse])
def get_my_appointments(current_user: dict = Depends(require_patient)):
    db = SessionLocal()
    result = db.execute(
        text("""
            SELECT a.id, a.doctor_id, d.name AS doctor_name,
                   d.qualification AS doctor_qualification,
                   d.hospital_name,
                   a.predicted_department,
                   a.input_text,
                   a.appointment_date, a.appointment_time, a.status
            FROM appointments a
            JOIN doctors d ON a.doctor_id = d.id
            WHERE a.user_id = :user_id
            ORDER BY a.created_at DESC
        """),
        {"user_id": current_user["user_id"]}
    ).fetchall()
    db.close()
    return [dict(row._mapping) for row in result]


@app.get("/admin/appointments")
def get_all_appointments(current_user: dict = Depends(require_admin)):
    """Returns only appointments for doctors in this admin's hospital."""
    db = SessionLocal()
    admin = db.execute(
        text("SELECT hospital_name FROM users WHERE id = :user_id"),
        {"user_id": current_user["user_id"]}
    ).fetchone()
    if not admin or not admin.hospital_name:
        db.close()
        return []
    result = db.execute(
        text("""
            SELECT a.id,
                   u.name AS patient_name,
                   d.name AS doctor_name,
                   a.input_text,
                   a.predicted_department,
                   a.appointment_date,
                   a.appointment_time,
                   a.status,
                   a.is_correct,
                   a.corrected_department
            FROM appointments a
            JOIN users u ON a.user_id = u.id
            JOIN doctors d ON a.doctor_id = d.id
            WHERE d.hospital_name = :hospital_name
            ORDER BY a.created_at DESC
        """),
        {"hospital_name": admin.hospital_name}
    ).fetchall()
    db.close()
    return [dict(row._mapping) for row in result]


@app.post("/admin/appointments/{appointment_id}/feedback")
def submit_feedback(
    appointment_id: int,
    feedback: FeedbackRequest,
    current_user: dict = Depends(require_admin)
):
    if not feedback.is_correct and not feedback.corrected_department:
        raise HTTPException(status_code=400, detail="corrected_department is required when marking as incorrect")

    db = SessionLocal()
    new_status = "confirmed" if feedback.is_correct else "review"
    db.execute(
        text("""
            UPDATE appointments
            SET is_correct = :is_correct,
                corrected_department = :corrected_department,
                status = :status
            WHERE id = :appointment_id
        """),
        {
            "is_correct": feedback.is_correct,
            "corrected_department": feedback.corrected_department if not feedback.is_correct else None,
            "status": new_status,
            "appointment_id": appointment_id
        }
    )
    db.commit()
    db.close()
    return {"message": "Feedback saved"}


@app.get("/admin/retrain/status")
def retrain_status(current_user: dict = Depends(require_admin)):
    """Returns the last retrain run info for display in the admin dashboard."""
    db = SessionLocal()
    last = db.execute(
        text("""
            SELECT ran_at, total_samples, feedback_samples, status, message
            FROM retrain_log
            ORDER BY ran_at DESC
            LIMIT 1
        """)
    ).fetchone()

    # Count pending feedback since last successful retrain
    last_success = db.execute(
        text("SELECT ran_at FROM retrain_log WHERE status = 'success' ORDER BY ran_at DESC LIMIT 1")
    ).fetchone()

    new_feedback = db.execute(
        text("""
            SELECT COUNT(*) FROM appointments
            WHERE is_correct IS NOT NULL
              AND (:since IS NULL OR created_at > :since)
        """),
        {"since": last_success.ran_at if last_success else None}
    ).scalar()

    db.close()
    return {
        "last_run": dict(last._mapping) if last else None,
        "new_feedback_count": new_feedback or 0,
        "threshold": RETRAIN_FEEDBACK_THRESHOLD,
        "next_run": "Nightly at 00:00",
    }
