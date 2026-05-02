"""Creates the retrain_log table to track scheduled retraining runs."""
from backend.database import SessionLocal
from sqlalchemy import text

def migrate():
    db = SessionLocal()
    db.execute(text("""
        CREATE TABLE IF NOT EXISTS retrain_log (
            id SERIAL PRIMARY KEY,
            ran_at TIMESTAMP NOT NULL DEFAULT NOW(),
            total_samples INT,
            feedback_samples INT,
            status VARCHAR(20) NOT NULL DEFAULT 'success',
            message TEXT
        )
    """))
    db.commit()
    db.close()
    print("retrain_log table ready.")

if __name__ == "__main__":
    migrate()
