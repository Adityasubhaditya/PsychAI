from flask import Flask, request, jsonify
from flask_cors import CORS
import requests
import os
import re
from dotenv import load_dotenv
import traceback

load_dotenv()
GROQ_API_KEY = os.getenv("GROQ_API_KEY")

if not GROQ_API_KEY:
    raise ValueError("Missing GROQ_API_KEY in .env")

app = Flask(__name__)
CORS(app)

GROQ_API_URL = "https://api.groq.com/openai/v1/chat/completions"
# Updated model names - choose one:
MODEL_NAME = "llama-3.1-8b-instant"  # Fast and efficient
# MODEL_NAME = "llama-3.3-70b-versatile"  # More powerful but slower
# MODEL_NAME = "mixtral-8x7b-32768"  # Good balance

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

    try:
        print(f"Sending request to Groq API with model: {MODEL_NAME}")
        response = requests.post(GROQ_API_URL, headers=headers, json=payload, timeout=30)
        print(f"Response status: {response.status_code}")
        
        if response.status_code != 200:
            error_msg = f"Groq API Error {response.status_code}: {response.text}"
            print(f"API Error: {error_msg}")
            raise Exception(error_msg)

        data = response.json()
        return data["choices"][0]["message"]["content"]
    
    except requests.exceptions.RequestException as e:
        print(f"Request exception: {e}")
        raise Exception(f"Network error: {str(e)}")

def extract_treatment_plan(text: str) -> str:
    try:
        # More flexible pattern matching for treatment plans
        patterns = [
            r"(?:Treatment Plan|Treatment Recommendations|Suggested Treatment)[\s\S]*?(?=\n\n|\d\.|$)",
            r"(?:Plan|Recommendations)[\s\S]*?(?=\n\n|\d\.|$)",
            r"(?:Therapies|Interventions)[\s\S]*?(?=\n\n|\d\.|$)"
        ]
        
        for pattern in patterns:
            match = re.search(pattern, text, re.IGNORECASE)
            if match:
                return match.group(0).strip()
        
        # Fallback: return the entire response if no specific section found
        return text[:500] + "..." if len(text) > 500 else text
    except Exception as e:
        return f"Error extracting treatment plan: {str(e)}"

@app.route("/api/analyze", methods=["POST"])
def analyze():
    try:
        data = request.get_json(force=True)
        print(f"Received data: {data}")

        if not data:
            return jsonify({"error": "No data provided"}), 400

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
            "5. Any relevant psychological or social considerations\n\n"
            "Please structure your response with clear sections."
        )

        print(f"Sending prompt to LLM...")
        result = call_groq_llm(prompt)
        print(f"LLM response received")
        
        treatment_plan = extract_treatment_plan(result)

        return jsonify({
            "plain_text": result,
            "html": result.replace("\n", "<br>"),
            "treatment_plan": treatment_plan.replace("\n", "<br>"),
            "model_used": MODEL_NAME
        })

    except Exception as e:
        print(f"Error in analyze endpoint: {str(e)}")
        print(f"Traceback: {traceback.format_exc()}")
        return jsonify({"error": str(e)}), 500

@app.route("/health", methods=["GET"])
def health_check():
    return jsonify({
        "status": "healthy", 
        "groq_api_key_set": bool(GROQ_API_KEY),
        "current_model": MODEL_NAME
    })

@app.route("/api/models", methods=["GET"])
def get_available_models():
    """Endpoint to check available models"""
    headers = {
        "Authorization": f"Bearer {GROQ_API_KEY}",
    }
    
    try:
        response = requests.get("https://api.groq.com/openai/v1/models", headers=headers)
        if response.status_code == 200:
            models = response.json()
            return jsonify({"models": [model["id"] for model in models["data"]]})
        else:
            return jsonify({"error": "Failed to fetch models"}), 500
    except Exception as e:
        return jsonify({"error": str(e)}), 500

if __name__ == "__main__":
    app.run(port=8000, debug=True)