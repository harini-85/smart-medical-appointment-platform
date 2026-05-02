"""
Run once to add location columns to the doctors table:
    python -m backend.migrate_location
"""
from backend.database import engine
from sqlalchemy import text

with engine.connect() as conn:
    conn.execute(text("""
        ALTER TABLE doctors
        ADD COLUMN IF NOT EXISTS hospital_name VARCHAR(255),
        ADD COLUMN IF NOT EXISTS hospital_lat  DOUBLE PRECISION,
        ADD COLUMN IF NOT EXISTS hospital_lng  DOUBLE PRECISION
    """))
    conn.commit()
    print("Migration complete: hospital_name, hospital_lat, hospital_lng added to doctors.")
