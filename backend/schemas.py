from pydantic import BaseModel, EmailStr
from typing import List
from typing import Optional
from pydantic import BaseModel
from datetime import date, time
from typing import Optional
from datetime import date, time

class PredictionRequest(BaseModel):
    text: str


class TopPrediction(BaseModel):
    department: str
    confidence: float


class PredictionResponse(BaseModel):
    predicted_department: str
    confidence: float
    top_3: List[TopPrediction]

class SignupRequest(BaseModel):
    name: str
    email: EmailStr
    password: str
    mobile: str
    role: str
    hospital_name: Optional[str] = None
    hospital_lat: Optional[float] = None
    hospital_lng: Optional[float] = None
    hospital_phone: Optional[str] = None
    hospital_address: Optional[str] = None


class LoginRequest(BaseModel):
    email: EmailStr
    password: str

class PatientProfileRequest(BaseModel):
    age: Optional[int]
    gender: Optional[str]
    blood_group: Optional[str]
    height_cm: Optional[float]
    weight_kg: Optional[float]
    address: Optional[str]
    allergies: Optional[str]
    chronic_conditions: Optional[str]


class PatientProfileResponse(BaseModel):
    name: Optional[str]
    email: Optional[str]
    mobile: Optional[str]
    age: Optional[int]
    gender: Optional[str]
    blood_group: Optional[str]
    height_cm: Optional[float]
    weight_kg: Optional[float]
    address: Optional[str]
    allergies: Optional[str]
    chronic_conditions: Optional[str]

class DoctorCreate(BaseModel):
    name: str
    department: str
    qualification: Optional[str]
    experience_years: Optional[int]
    profile_image: Optional[str]
    hospital_name: Optional[str]
    hospital_lat: Optional[float]
    hospital_lng: Optional[float]


class DoctorResponse(BaseModel):
    id: int
    name: str
    department: str
    qualification: Optional[str]
    experience_years: Optional[int]
    profile_image: Optional[str]
    available: bool
    hospital_name: Optional[str]
    hospital_lat: Optional[float]
    hospital_lng: Optional[float]
    distance_km: Optional[float] = None


class AvailabilityCreate(BaseModel):
    doctor_id: int
    available_date: date
    available_time: time


class AvailabilityResponse(BaseModel):
    id: int
    doctor_id: int
    available_date: date
    available_time: time
    is_booked: bool


class AppointmentCreate(BaseModel):
    doctor_id: int
    availability_id: int
    input_text: str
    predicted_department: str
    confidence: Optional[float] = None


class AppointmentResponse(BaseModel):
    id: int
    doctor_id: int
    doctor_name: Optional[str]
    doctor_qualification: Optional[str]
    hospital_name: Optional[str]
    predicted_department: Optional[str]
    input_text: Optional[str]
    appointment_date: date
    appointment_time: time
    status: str
    is_correct: Optional[bool] = None
    corrected_department: Optional[str] = None


class FeedbackRequest(BaseModel):
    is_correct: bool
    corrected_department: Optional[str] = None


class EmergencyRefineRequest(BaseModel):
    text: str
    sub_type: str  # e.g. "Cardiac", "Trauma", "Neuro", "Respiratory", "Other"


class EmergencyRefineResponse(BaseModel):
    sub_type: str
    description: str
    urgency: str  # "critical" | "high" | "moderate"