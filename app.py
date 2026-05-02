import streamlit as st
import joblib
import numpy as np

# ==========================
# Page Config
# ==========================

st.set_page_config(page_title="Appointment Department Classifier", page_icon="🏥")

st.title("🏥 Appointment Department Classifier")
st.write("Enter your symptoms below to get department prediction.")

# ==========================
# Load Model
# ==========================

@st.cache_resource
def load_model():
    return joblib.load("models/appointment_model_v1.pkl")

model = load_model()

# ==========================
# User Input
# ==========================

user_input = st.text_area("Describe your symptoms:")

if st.button("Predict"):

    if not user_input.strip():
        st.warning("Please enter symptoms.")
    else:
        prediction = model.predict([user_input])[0]
        probabilities = model.predict_proba([user_input])[0]
        confidence = np.max(probabilities)

        classes = model.classes_
        top3_indices = np.argsort(probabilities)[-3:][::-1]

        st.subheader("Prediction Result")

        # Low confidence handling
        if confidence < 0.4:
            st.warning("⚠ Low confidence prediction. Please provide more details.")

        st.success(f"Predicted Department: {prediction}")
        st.info(f"Confidence: {round(confidence * 100, 2)}%")

        st.subheader("Top 3 Predictions")

        for idx in top3_indices:
            st.write(f"{classes[idx]} → {round(probabilities[idx] * 100, 2)}%")