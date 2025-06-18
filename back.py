from flask import Flask, request, jsonify
from flask_cors import CORS
import requests
import os
import re
from dotenv import load_dotenv

load_dotenv()
GROQ_API_KEY = os.getenv("GROQ_API_KEY")

if not GROQ_API_KEY:
    raise ValueError("Missing GROQ_API_KEY in .env")

app = Flask(__name__)
CORS(app)

GROQ_API_URL = "https://api.groq.com/openai/v1/chat/completions"
MODEL_NAME = "llama3-8b-8192"  # Groq's model name for Llama 3 8B

def call_groq_llm(prompt: str) -> str:
    headers = {
        "Authorization": f"Bearer {GROQ_API_KEY}",
        "Content-Type": "application/json",
    }

    payload = {
        "model": MODEL_NAME,
        "messages": [
            {"role": "system", "content": (
                "You are an AI assistant that helps psychiatrists diagnose "
                "and treat mental health conditions based on detailed patient data. "
                "Provide thoughtful, in-depth analysis and possible diagnosis, "
                "including suggested treatment options, precautions, and follow-up "
                "recommendations. Use professional and compassionate language."
            )},
            {"role": "user", "content": prompt}
        ],
        "temperature": 0.5,
        "max_tokens": 1200
    }

    response = requests.post(GROQ_API_URL, headers=headers, json=payload)
    if response.status_code != 200:
        raise Exception(f"Groq API Error {response.status_code}: {response.text}")

    data = response.json()
    return data["choices"][0]["message"]["content"]

def extract_treatment_plan(text: str) -> str:
    match = re.search(r"(Suggested|Recommended|Treatment)[^\n]*\n[-•\s]+(.+?)(?=\n\d|$)", text, re.DOTALL | re.IGNORECASE)
    return match.group(0).strip() if match else "No specific treatment plan found."

@app.route("/api/analyze", methods=["POST"])
def analyze():
    try:
        data = request.get_json(force=True)

        prompt = (
            f"Patient details:\n"
            f"- Age: {data.get('age', 'Not specified')}\n"
            f"- Gender: {data.get('gender', 'Not specified')}\n"
            f"- Symptoms: {data.get('reported_symptoms', 'Not specified')}\n"
            f"- Medical History: {data.get('existing_conditions', 'Not specified')}\n"
            f"- Family History: {data.get('family_history', 'Not specified')}\n"
            f"- Current Medications: {data.get('medications', 'Not specified')}\n"
            f"- Lifestyle Factors: {data.get('socio_environmental_context', 'Not specified')}\n"
            f"- Other Notes: {data.get('behavioral_changes', '')}, {data.get('therapy_history', '')}\n\n"
            "Please analyze the patient's condition in detail. Provide:\n"
            "1. Possible diagnoses or conditions\n"
            "2. Suggested treatment plans or therapies\n"
            "3. Precautions or warning signs to monitor\n"
            "4. Recommendations for follow-up and further tests\n"
            "5. Any relevant psychological or social considerations"
        )

        result = call_groq_llm(prompt)
        treatment_plan = extract_treatment_plan(result)

        return jsonify({
            "plain_text": result,
            "html": result.replace("\n", "<br>"),
            "treatment_plan": treatment_plan.replace("\n", "<br>")
        })

    except Exception as e:
        return jsonify({"error": str(e)}), 500

if __name__ == "__main__":
    app.run(port=8000, debug=True)
