import joblib

MODEL_PATH = "models/appointment_model_v1.pkl"

def load_model():
    model = joblib.load(MODEL_PATH)
    return model