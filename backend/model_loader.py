import joblib
import os

# Absolute path — works regardless of working directory on any server
BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
MODEL_PATH = os.path.join(BASE_DIR, "models", "appointment_model_v1.pkl")

def load_model():
    if not os.path.exists(MODEL_PATH):
        raise FileNotFoundError(f"Model file not found at {MODEL_PATH}. Run: python src/train.py")
    return joblib.load(MODEL_PATH)
