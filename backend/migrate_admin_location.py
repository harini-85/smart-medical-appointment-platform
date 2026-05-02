"""
Run once to add hospital_lat and hospital_lng to the users table:
    python -m backend.migrate_admin_location
"""
from backend.database import engine
from sqlalchemy import text

with engine.connect() as conn:
    conn.execute(text("""
        ALTER TABLE users
        ADD COLUMN IF NOT EXISTS hospital_lat  DOUBLE PRECISION,
        ADD COLUMN IF NOT EXISTS hospital_lng  DOUBLE PRECISION
    """))
    conn.commit()
    print("Migration complete: hospital_lat, hospital_lng added to users.")
