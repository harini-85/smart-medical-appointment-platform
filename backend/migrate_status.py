"""
Run once to update the status check constraint on appointments:
    python -m backend.migrate_status
"""
from backend.database import engine
from sqlalchemy import text

with engine.connect() as conn:
    # Drop the old constraint and add a new one with all valid statuses
    conn.execute(text("ALTER TABLE appointments DROP CONSTRAINT IF EXISTS appointments_status_check"))
    conn.execute(text("""
        ALTER TABLE appointments
        ADD CONSTRAINT appointments_status_check
        CHECK (status IN ('confirmed', 'cancelled', 'pending_review', 'review'))
    """))
    conn.commit()
    print("Migration complete: status constraint updated.")
