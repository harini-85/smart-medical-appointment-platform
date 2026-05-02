"""
Run once to add feedback columns to appointments table:
    python -m backend.migrate_feedback
"""
from backend.database import engine
from sqlalchemy import text

with engine.connect() as conn:
    conn.execute(text("""
        ALTER TABLE appointments
        ADD COLUMN IF NOT EXISTS is_correct     BOOLEAN DEFAULT NULL,
        ADD COLUMN IF NOT EXISTS corrected_department VARCHAR(100) DEFAULT NULL
    """))
    conn.commit()
    print("Migration complete: is_correct, corrected_department added to appointments.")
