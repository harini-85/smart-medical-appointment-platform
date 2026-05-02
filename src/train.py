import os
import joblib
import pandas as pd
import numpy as np

from sklearn.model_selection import train_test_split
from sklearn.pipeline import Pipeline
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import accuracy_score, classification_report, confusion_matrix


# ==========================
# 1. Load Dataset
# ==========================

DATA_PATH = "appointment_dataset.csv"

df = pd.read_csv(DATA_PATH)

print("Initial shape:", df.shape)

# Safety: remove duplicates
df = df.drop_duplicates(subset=["text"])
df = df.dropna()

print("After cleaning:", df.shape)


# ==========================
# 2. Stratified 70-15-15 Split
# ==========================

# First split: 70% train, 30% temp
train_df, temp_df = train_test_split(
    df,
    test_size=0.30,
    stratify=df["department"],
    random_state=42
)

# Split temp into validation (15%) and test (15%)
val_df, test_df = train_test_split(
    temp_df,
    test_size=0.50,
    stratify=temp_df["department"],
    random_state=42
)

print("\nDataset Split:")
print("Train:", train_df.shape)
print("Validation:", val_df.shape)
print("Test:", test_df.shape)


# ==========================
# 3. Define ML Pipeline
# ==========================

pipeline = Pipeline([
    (
        "tfidf",
        TfidfVectorizer(
            lowercase=True,
             # word n-grams
            # analyzer="char_wb",
            # ngram_range=(3,5),
            analyzer="char_wb",
            ngram_range=(3,5),
            min_df=2,
            max_features=5000
        )
    ),
    (
        "clf",
        LogisticRegression(
            max_iter=1000,
            # multi_class="multinomial",
            solver="lbfgs",
            C=2.0
        )
    )
])


# ==========================
# 4. Train Model
# ==========================

print("\nTraining model...")
pipeline.fit(train_df["text"], train_df["department"])

print("Training complete!")


# ==========================
# 5. Validation Evaluation
# ==========================

val_preds = pipeline.predict(val_df["text"])
val_acc = accuracy_score(val_df["department"], val_preds)

print("\nValidation Accuracy:", round(val_acc, 4))
print("\nValidation Classification Report:\n")
print(classification_report(val_df["department"], val_preds))


# ==========================
# 6. Final Test Evaluation
# ==========================

test_preds = pipeline.predict(test_df["text"])
test_acc = accuracy_score(test_df["department"], test_preds)

print("\nTest Accuracy:", round(test_acc, 4))
print("\nTest Classification Report:\n")
print(classification_report(test_df["department"], test_preds))




os.makedirs("models", exist_ok=True)

joblib.dump(pipeline, "models/appointment_model_v1.pkl")

print("\nModel saved at: models/appointment_model_v1.pkl")