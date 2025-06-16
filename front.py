# frontend/app.py
import streamlit as st
import requests
import json
import re
from datetime import datetime
from fpdf import FPDF
import base64
import os
from streamlit.components.v1 import html

BACKEND_URL = "http://localhost:8000/api/analyze"
REPORTS_DIR = "patient_reports"

# Ensure reports directory exists
os.makedirs(REPORTS_DIR, exist_ok=True)

st.set_page_config(
    page_title="PsychAI – Clinical Assistant",
    page_icon="🧠",
    layout="wide",
)

# ----- Custom CSS with Purple/Black Theme and Animations -----
st.markdown("""
    <style>
    button[kind="primary"] {
        background: linear-gradient(135deg, #6a0dad, #8a2be2) !important;
        color: white !important;
        font-weight: bold;
        border: none;
        border-radius: 8px;
        padding: 10px 24px;
        cursor: pointer;
        transition: all 0.3s ease;
        box-shadow: 0 4px 6px rgba(106, 13, 173, 0.3);
    }
    button[kind="primary"]:hover {
        transform: translateY(-2px);
        box-shadow: 0 6px 12px rgba(106, 13, 173, 0.4);
    }
    button[kind="primary"]:active {
        transform: translateY(0);
    }
    .report-box {
        background: linear-gradient(145deg, #1a1a1a, #2a2a2a);
        padding: 25px;
        border-radius: 15px;
        box-shadow: 0 8px 32px rgba(106, 13, 173, 0.2);
        color: #f0f0f0;
        border-left: 4px solid #8a2be2;
        margin-bottom: 20px;
        transition: all 0.4s cubic-bezier(0.25, 0.8, 0.25, 1);
    }
    .report-box:hover {
        box-shadow: 0 12px 40px rgba(106, 13, 173, 0.3);
        transform: translateY(-3px);
    }
    .confidence-container {
        margin: 15px 0;
    }
    .confidence-label {
        font-weight: bold;
        margin-bottom: 6px;
        color: #d9b3ff;
        font-size: 14px;
    }
    .confidence-bar {
        height: 24px;
        background: #333;
        border-radius: 12px;
        overflow: hidden;
        box-shadow: inset 0 1px 3px rgba(0,0,0,0.4);
    }
    .confidence-bar-inner {
        height: 100%;
        background: linear-gradient(90deg, #6a0dad, #9b4dff);
        width: 0%;
        color: white;
        text-align: center;
        line-height: 24px;
        font-size: 13px;
        font-weight: bold;
        border-radius: 12px;
        transition: width 1s ease-out;
        box-shadow: 0 2px 4px rgba(0,0,0,0.2);
    }
    .confidence-bar-inner:hover {
        background: linear-gradient(90deg, #6a0dad, #b76bff);
    }
    .diagnosis-item {
        background: rgba(106, 13, 173, 0.15);
        padding: 15px;
        border-radius: 10px;
        margin: 10px 0;
        border-left: 3px solid #8a2be2;
        transition: all 0.3s ease;
    }
    .diagnosis-item:hover {
        background: rgba(106, 13, 173, 0.25);
        transform: translateX(5px);
    }
    .section-header {
        color: #b76bff;
        font-size: 18px;
        font-weight: bold;
        margin: 20px 0 10px 0;
        padding-bottom: 5px;
        border-bottom: 2px solid rgba(138, 43, 226, 0.3);
    }
    @keyframes fadeIn {
        from { opacity: 0; transform: translateY(10px); }
        to { opacity: 1; transform: translateY(0); }
    }
    .animate-fade {
        animation: fadeIn 0.6s ease-out forwards;
    }
    .stTabs [aria-selected="true"] {
        color: #b76bff !important;
        font-weight: bold;
    }
    .stTabs [aria-selected="true"] div div {
        border-bottom: 2px solid #8a2be2 !important;
    }
    .pdf-button {
        background: linear-gradient(135deg, #6a0dad, #8a2be2);
        color: white;
        padding: 10px 20px;
        border-radius: 5px;
        text-align: center;
        margin: 10px 0;
        display: inline-block;
    }
    </style>
""", unsafe_allow_html=True)

# ----- Header -----
st.title("🩺 PsychAI – AI Assistant for Psychiatric Diagnosis")
st.markdown("""
    <div style="font-size: 17px; color: #aaa;">
    Enter patient details and click <b>Analyze</b>.  
    PsychAI will suggest possible diagnoses, treatments &amp; medications.
    <br><br><i>Disclaimer: AI suggestions are <b>not</b> a substitute for clinical judgment.</i>
    </div>
""", unsafe_allow_html=True)
st.markdown("---")

# ----- Patient Form -----
with st.form("patient_form"):
    col1, col2 = st.columns(2)

    with col1:
        name = st.text_input("Patient Name")
        age = st.number_input("Age", 0, 120, step=1)
        gender = st.selectbox("Gender", ("Male", "Female", "Other"), index=2)
        mood = st.text_area("Current Mood / Affect")
        behavior = st.text_area("Behavioral Changes")
        sleep = st.text_area("Sleep Patterns")

    with col2:
        history = st.text_area("Existing Mental-Health Conditions")
        meds = st.text_area("Past / Current Medications")
        therapy_hist = st.text_area("Therapy History")
        symptoms = st.text_area("Patient-Reported Symptoms")
        family_hist = st.text_area("Family History (optional)")
        context = st.text_area("Socio-environmental Context (optional)")

    submitted = st.form_submit_button("🔍 Analyze", use_container_width=True)

# ----- On Submit -----
if submitted:
    if not name:
        st.error("Please provide the patient's name.")
        st.stop()

    payload = {
        "timestamp": datetime.now().isoformat(),
        "name": name,
        "age": age,
        "gender": gender,
        "current_mood": mood,
        "behavioral_changes": behavior,
        "sleep_patterns": sleep,
        "existing_conditions": history,
        "medications": meds,
        "therapy_history": therapy_hist,
        "reported_symptoms": symptoms,
        "family_history": family_hist,
        "socio_environmental_context": context,
    }

    with st.spinner("Analyzing patient data..."):
        try:
            r = requests.post(BACKEND_URL, json=payload, timeout=60)
            r.raise_for_status()
            response = r.json()
            st.session_state['analysis'] = response
            st.session_state['payload'] = payload
        except Exception as e:
            st.error(f"Request failed: {e}")
            st.stop()

# ----- If Analysis Exists -----
if 'analysis' in st.session_state:
    st.success("Analysis complete!")
    st.markdown("## 📝 AI Report")
    
    # Extract diagnoses from the analysis
    def extract_diagnoses(text):
        pattern = r"(?:Possible Diagnosis|Potential Disorder):?\s*(.*?)\s*(?:\(Confidence:|$)"
        return re.findall(pattern, text, re.IGNORECASE)
    
    ai_text = st.session_state['analysis'].get("plain_text", "")
    suggested_diagnoses = list(set(extract_diagnoses(ai_text)))  # Remove duplicates
    
    # Custom Report Section
    with st.expander("📄 Generate Clinical Report", expanded=False):
        with st.form("report_form"):
            st.subheader("Customize Clinical Report")
            
            col1, col2 = st.columns(2)
            
            with col1:
                selected_diagnoses = st.multiselect(
                    "Select confirmed diagnoses:",
                    options=suggested_diagnoses,
                    default=suggested_diagnoses[:1] if suggested_diagnoses else []
                )
                additional_diagnoses = st.text_input("Add other diagnoses (comma separated)")
                
                therapy_type = st.selectbox(
                    "Recommended Therapy",
                    ["Cognitive Behavioral Therapy", "Dialectical Behavior Therapy", 
                     "Psychodynamic Therapy", "Humanistic Therapy", "Other"]
                )
                sessions = st.slider("Recommended sessions", 1, 52, 6)
                
            with col2:
                medications = st.text_area(
                    "Medications (with dosage)",
                    value=re.search(r"(?<=Medications:).*?(?=\n\n)", ai_text, re.DOTALL | re.IGNORECASE).group(0) 
                    if re.search(r"Medications:", ai_text, re.IGNORECASE) else ""
                )
                
                clinician_notes = st.text_area(
                    "Clinical Notes",
                    height=150
                )
                
                follow_up = st.date_input("Follow-up Date")
                urgency = st.select_slider(
                    "Urgency Level",
                    options=["Low", "Medium", "High"],
                    value="Medium"
                )
            
            generate_report = st.form_submit_button("🖨️ Generate PDF Report")

    if generate_report:
        # Combine all diagnoses
        all_diagnoses = selected_diagnoses
        if additional_diagnoses:
            all_diagnoses.extend([d.strip() for d in additional_diagnoses.split(",") if d.strip()])
        
        # Create PDF report
        class PDF(FPDF):
            def header(self):
                self.set_font('Arial', 'B', 16)
                self.cell(0, 10, f'PsychAI Clinical Report - {name}', 0, 1, 'C')
                self.ln(5)
            
            def footer(self):
                self.set_y(-15)
                self.set_font('Arial', 'I', 8)
                self.cell(0, 10, f'Page {self.page_no()}', 0, 0, 'C')

        try:
            pdf = PDF()
            pdf.add_page()
            pdf.set_margins(15, 15, 15)  # Set margins to ensure space
            
            # Set UTF-8 encoding for special characters
            pdf.set_doc_option('core_fonts_encoding', 'utf-8')
            
            # Report Header
            pdf.set_font("Arial", size=12)
            pdf.cell(0, 10, f"Patient: {name}, {age} years ({gender})", ln=1)
            pdf.cell(0, 10, f"Assessment Date: {datetime.now().strftime('%Y-%m-%d')}", ln=1)
            pdf.ln(10)
            
            # Diagnoses Section
            pdf.set_font("Arial", 'B', 14)
            pdf.cell(0, 10, "Diagnoses", ln=1)
            pdf.set_font("Arial", size=12)
            for dx in all_diagnoses:
                # Clean diagnosis text
                clean_dx = re.sub(r'[^\x00-\x7F]+', ' ', str(dx))  # Remove non-ASCII
                clean_dx = ' '.join(clean_dx.split())  # Remove extra whitespace
                pdf.multi_cell(0, 10, f"• {clean_dx[:200]}")  # Limit to 200 chars per line
            pdf.ln(5)
            
            # Treatment Plan
            pdf.set_font("Arial", 'B', 14)
            pdf.cell(0, 10, "Treatment Plan", ln=1)
            pdf.set_font("Arial", size=12)
            pdf.multi_cell(0, 10, f"Therapy: {therapy_type} ({sessions} sessions recommended)")
            
            # Medications
            pdf.set_font("Arial", 'B', 12)
            pdf.cell(0, 10, "Medications:", ln=1)
            if medications:
                # Clean medications text
                clean_meds = re.sub(r'[^\x00-\x7F]+', ' ', str(medications))
                clean_meds = ' '.join(clean_meds.split())
                pdf.set_font("Arial", size=10)  # Smaller font
                for line in clean_meds.split('\n'):
                    pdf.multi_cell(0, 8, line[:150])  # Limit to 150 chars per line
                pdf.set_font("Arial", size=12)
            pdf.ln(5)
            
            # Clinical Notes
            pdf.set_font("Arial", 'B', 14)
            pdf.cell(0, 10, "Clinical Notes", ln=1)
            pdf.set_font("Arial", size=12)
            if clinician_notes:
                clean_notes = re.sub(r'[^\x00-\x7F]+', ' ', str(clinician_notes))
                clean_notes = ' '.join(clean_notes.split())
                pdf.multi_cell(0, 10, clean_notes[:500])  # Limit to 500 chars
            pdf.ln(5)
            
            # Follow Up
            pdf.set_font("Arial", 'B', 14)
            pdf.cell(0, 10, "Follow Up", ln=1)
            pdf.set_font("Arial", size=12)
            pdf.cell(0, 10, f"Next appointment: {follow_up.strftime('%Y-%m-%d')} ({urgency} priority)", ln=1)
            
            # Save PDF
            filename = f"{REPORTS_DIR}/{name.replace(' ', '_')}_{datetime.now().strftime('%Y%m%d_%H%M')}.pdf"
            pdf.output(filename)
            
            # Provide download link
            with open(filename, "rb") as f:
                pdf_bytes = f.read()
            b64 = base64.b64encode(pdf_bytes).decode()
            href = f'<a href="data:application/pdf;base64,{b64}" download="{os.path.basename(filename)}" class="pdf-button">⬇️ Download Full Report</a>'
            st.markdown(href, unsafe_allow_html=True)
            st.success("Report generated successfully!")
            
        except Exception as e:
            st.error(f"Failed to generate PDF: {str(e)}")
            st.error("Please check the input text for any unusual characters or formatting.")

    # Original Analysis Display Tabs
    tabs = st.tabs(["Formatted Report", "Raw Analysis", "Payload Data"])

    def clean_plain_text(text):
        if not text:
            return "No analysis available"
        return re.sub(r'```(?:\w+)?\n(.*?)```', r'\1', text, flags=re.DOTALL)

    def extract_confidence_bars(text):
        if not text:
            return ""
        pattern = r"(.*?):.*?\(Confidence:\s*(\d+)%\)"
        matches = re.findall(pattern, text)
        bars = ""
        for label, value in matches:
            bars += f"""
            <div class="confidence-container">
                <div class="confidence-label">{label.strip()}</div>
                <div class="confidence-bar">
                    <div class="confidence-bar-inner" style="width: {value}%;">{value}%</div>
                </div>
            </div>
            """
        return bars if bars else "<p>No confidence metrics found in analysis</p>"

    def format_diagnosis_items(text):
        if not text:
            return "No diagnostic information available"
        cleaned = re.sub(r'```.*?```', '', text, flags=re.DOTALL)
        sections = re.split(r'\n(?=#+\s)', cleaned)
        formatted = ""
        for section in sections:
            if section.strip():
                section = section.replace("**", "<strong>").replace("<strong>", "</strong>", 1)
                section = re.sub(r'#+\s(.*?)\n', r'<div class="section-header">\1</div>', section)
                section = re.sub(r'\n', '<br>', section)
                formatted += f'<div class="diagnosis-item">{section.strip()}</div>'
        return formatted if formatted else f'<div class="diagnosis-item">{cleaned.strip()}</div>'

    # Render Tabs
    cleaned_text = clean_plain_text(st.session_state['analysis'].get("plain_text", ""))
    confidence_html = extract_confidence_bars(cleaned_text)
    formatted_diagnosis = format_diagnosis_items(cleaned_text)

    with tabs[0]:
        st.markdown(
            f"""
            <div class="report-box animate-fade">
                {confidence_html}
                {formatted_diagnosis}
                <p style='font-size:13px;color:#888;margin-top:20px;'>
                <i>PsychAI suggestions should be reviewed by a qualified professional.</i>
                </p>
            </div>
            """,
            unsafe_allow_html=True,
        )

    with tabs[1]:
        st.code(st.session_state['analysis'].get("plain_text", "No analysis data received"), language="text")

    with tabs[2]:
        st.code(json.dumps(st.session_state['payload'], indent=2), language="json")

st.markdown("---")
st.markdown("""
    <div style="text-align: center; margin-top: 20px; color: #888;">
        <i>Powered by PsychAI – Your AI Clinical Assistant</i>
    </div>
""", unsafe_allow_html=True)