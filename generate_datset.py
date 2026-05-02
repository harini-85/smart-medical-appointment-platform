import random
import pandas as pd

departments = {
    "Cardiology": ["chest pain", "heart palpitations", "shortness of breath",
                   "pressure in chest", "rapid heartbeat", "tightness in chest"],
    "Neurology": ["headache", "dizziness", "seizures", "numbness in hand",
                  "memory loss", "migraine"],
    "Orthopedics": ["knee pain", "back pain", "fracture",
                    "joint swelling", "shoulder pain", "ankle injury"],
    "Dermatology": ["skin rash", "itching", "acne",
                    "red spots on skin", "skin irritation", "eczema"],
    "Gastroenterology": ["stomach pain", "vomiting", "diarrhea",
                         "acid reflux", "bloating", "abdominal cramps"],
    "Pulmonology": ["cough", "breathing difficulty", "wheezing",
                    "chest congestion", "shortness of breath", "persistent cough"],
    "ENT": ["ear pain", "sore throat", "sinus pain",
            "blocked nose", "ear discharge", "voice hoarseness"],
    "Ophthalmology": ["blurred vision", "eye redness", "eye pain",
                      "watery eyes", "dry eyes", "double vision"],
    "Psychiatry": ["anxiety", "depression", "mood swings",
                   "sleep issues", "panic attacks", "stress"],
    "Urology": ["burning urination", "frequent urination", "blood in urine",
                "lower abdominal pain", "urine infection", "pain while urinating"],
    "Gynecology": ["irregular periods", "pelvic pain", "heavy bleeding",
                   "menstrual cramps", "vaginal discharge", "period delay"],
    "Pediatrics": ["child fever", "child cough", "vomiting in child",
                   "rash in child", "child cold", "child stomach pain"],
    "Endocrinology": ["thyroid problem", "weight gain", "fatigue",
                      "high blood sugar", "hormone imbalance", "excess thirst"],
    "General Medicine": ["fever", "body pain", "weakness",
                         "cold and cough", "viral infection", "general discomfort"],
    "Emergency": ["severe chest pain", "accident injury", "heavy bleeding",
                  "unconsciousness", "severe breathing issue", "major trauma"]
}

templates = [
    "I have been experiencing {} for {}.",
    "Suffering from {} since {}.",
    "Having {} from past {}.",
    "{} is bothering me for {}.",
    "Facing {} and it feels serious.",
    "I feel {} continuously for {}.",
    "There is {} happening since {}.",
    "Dealing with {} for {} now.",
    "Experiencing severe {} since {}."
]

durations = [
    "2 days", "3 days", "a week", "one day",
    "two weeks", "since morning", "last night",
    "few hours", "past 4 days"
]

context_phrases = [
    "", 
    " It is getting worse.",
    " The pain is increasing.",
    " It started suddenly.",
    " I am very worried.",
    " It is not improving."
]

def add_typo(text):
    if random.random() < 0.10:
        index = random.randint(0, len(text)-2)
        return text[:index] + random.choice("abcdefghijklmnopqrstuvwxyz") + text[index+1:]
    return text

data = []
seen_sentences = set()

for dept, symptoms in departments.items():
    while len([d for d in data if d["department"] == dept]) < 110:
        symptom = random.choice(symptoms)
        template = random.choice(templates)
        duration = random.choice(durations)
        context = random.choice(context_phrases)

        sentence = template.format(symptom, duration) + context
        sentence = sentence.lower()
        sentence = add_typo(sentence)

        if sentence not in seen_sentences:
            seen_sentences.add(sentence)
            data.append({
                "text": sentence,
                "department": dept
            })

df = pd.DataFrame(data)
df = df.sample(frac=1).reset_index(drop=True)

df.to_csv("appointment_dataset.csv", index=False)

print("Dataset generated successfully!")
print("Total samples:", len(df))
print("Unique sentences:", len(df["text"].unique()))