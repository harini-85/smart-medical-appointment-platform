import sys
import joblib
import numpy as np

MODEL_PATH = "models/appointment_model_v1.pkl"
model = joblib.load(MODEL_PATH)

print("Model loaded successfully!\n")

if len(sys.argv) < 2:
    print("Usage: python src/predict.py your text here")
    sys.exit(1)

user_input = " ".join(sys.argv[1:])

if not user_input.strip():
    print("Input text cannot be empty.")
    sys.exit(1)

print(f"Input Text: {user_input}\n")

prediction = model.predict([user_input])[0]
probabilities = model.predict_proba([user_input])[0]
confidence = np.max(probabilities)

classes = model.classes_
top3_indices = np.argsort(probabilities)[-3:][::-1]

print("Prediction Results:\n")
if confidence < 0.4:
    print("⚠ Low confidence prediction.")
    print("Please provide more detailed symptoms.\n")

print(f"Predicted Department: {prediction}")
print(f"Confidence: {round(np.max(probabilities) * 100, 2)}%\n")

print("Top 3 Predictions:")
for idx in top3_indices:
    print(f"{classes[idx]} → {round(probabilities[idx] * 100, 2)}%")