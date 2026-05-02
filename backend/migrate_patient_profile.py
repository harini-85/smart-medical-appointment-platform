"""
Run once to add extended fields to patient_profiles table:
    python -m backend.migrate_patient_profile
"""
from backend.database import engine
from sqlalchemy import text

with engine.connect() as conn:
    conn.execute(text("""
        ALTER TABLE patient_profiles
        ADD COLUMN IF NOT EXISTS date_of_birth       DATE,
        ADD COLUMN IF NOT EXISTS marital_status      VARCHAR(20),
        ADD COLUMN IF NOT EXISTS occupation          VARCHAR(100),
        ADD COLUMN IF NOT EXISTS emergency_contact_name  VARCHAR(100),
        ADD COLUMN IF NOT EXISTS emergency_contact_phone VARCHAR(20),
        ADD COLUMN IF NOT EXISTS smoking_status      VARCHAR(20),
        ADD COLUMN IF NOT EXISTS alcohol_status      VARCHAR(20),
        ADD COLUMN IF NOT EXISTS current_medications TEXT,
        ADD COLUMN IF NOT EXISTS past_surgeries      TEXT,
        ADD COLUMN IF NOT EXISTS family_history      TEXT
    """))
    conn.commit()
    print("Migration complete: extended patient profile fields added.")
