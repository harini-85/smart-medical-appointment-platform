from fastapi import APIRouter, HTTPException
from sqlalchemy import text
from backend.database import SessionLocal
from backend.security import hash_password, verify_password, create_access_token

router = APIRouter()

from backend.schemas import SignupRequest, LoginRequest

@router.post("/signup")
def signup(user: SignupRequest):
    db = SessionLocal()

    if user.role == "admin" and not user.hospital_name:
        raise HTTPException(status_code=400, detail="Hospital name is required for admin accounts")

    hashed_pwd = hash_password(user.password)
    try:
        db.execute(
            text("""
                INSERT INTO users (name, email, password_hash, mobile, role, hospital_name, hospital_lat, hospital_lng, hospital_phone, hospital_address)
                VALUES (:name, :email, :password, :mobile, :role, :hospital_name, :hospital_lat, :hospital_lng, :hospital_phone, :hospital_address)
            """),
            {
                "name": user.name,
                "email": user.email,
                "password": hashed_pwd,
                "mobile": user.mobile,
                "role": user.role,
                "hospital_name": user.hospital_name,
                "hospital_lat": user.hospital_lat,
                "hospital_lng": user.hospital_lng,
                "hospital_phone": user.hospital_phone,
                "hospital_address": user.hospital_address,
            }
        )
        db.commit()
    except Exception:
        db.rollback()
        raise HTTPException(status_code=400, detail="User already exists")

    db.close()
    return {"message": "User created successfully"}


@router.post("/login")
def login(credentials: LoginRequest):
    db = SessionLocal()

    result = db.execute(
        text("SELECT * FROM users WHERE email = :email"),
        {"email": credentials.email}
    ).fetchone()

    db.close()

    if not result:
        raise HTTPException(status_code=400, detail="Invalid email")

    if not verify_password(credentials.password, result.password_hash):
        raise HTTPException(status_code=400, detail="Invalid password")

    token = create_access_token({
        "user_id": result.id,
        "role": result.role
    })

    return {"access_token": token, "token_type": "bearer"}