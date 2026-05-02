"""
Run once to add hospital_name column to the users table:
    python -m backend.migrate_admin_hospital
"""
from backend.database import engine
from sqlalchemy import text

with engine.connect() as conn:
    conn.execute(text("""
        ALTER TABLE users
        ADD COLUMN IF NOT EXISTS hospital_name VARCHAR(255)
    """))
    conn.commit()
    print("Migration complete: hospital_name added to users.")
