"""
Run once to add hospital contact columns to users table:
    python -m backend.migrate_hospital_contact
"""
from backend.database import engine
from sqlalchemy import text

with engine.connect() as conn:
    conn.execute(text("""
        ALTER TABLE users
        ADD COLUMN IF NOT EXISTS hospital_phone   VARCHAR(20),
        ADD COLUMN IF NOT EXISTS hospital_address VARCHAR(500)
    """))
    conn.commit()
    print("Migration complete: hospital_phone, hospital_address added to users.")
