"use client";

import { useEffect, useMemo, useState } from "react";
import {
  answerLabels,
  gadQuestions,
  hasSafetySignal,
  phqQuestions,
  severity,
} from "@/lib/assessments";
import type { EvidenceItem } from "@/lib/knowledge";

type Analysis = {
  clinicalFormulation: string;
  presentingConcerns: string[];
  functionalImpact: string[];
  protectiveFactors: string[];
  therapyOptions: string[];
  medicationConsiderations: string[];
};

type Result = {
  analysis: Analysis;
  evidence: EvidenceItem[];
  safety: boolean;
  mode: "ai-assisted" | "rules-only" | "safety-protocol";
};

type TrendPoint = { date: string; phq: number; gad: number };

const emptyPhq = Array<number>(9).fill(0);
const emptyGad = Array<number>(7).fill(0);

const sampleCase = {
  alias: "Case A-104",
  age: 28,
  pronouns: "They / them",
  mood: "Low and easily overwhelmed",
  sleep: "5–6 hours, frequently interrupted",
  symptoms:
    "Low motivation, difficulty concentrating, persistent worry about work, and less interest in social activities for the past three weeks.",
  context:
    "Recently changed jobs and moved away from family. Has one close friend nearby and is open to speaking with a counsellor.",
  phq: [2, 2, 2, 2, 1, 1, 2, 0, 0],
  gad: [2, 2, 2, 2, 1, 1, 2],
};

function ScoreRing({ score, max, label, tone }: { score: number; max: number; label: string; tone: "violet" | "cyan" }) {
  const radius = 44;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference * (1 - score / max);
  return (
    <div className={`score-ring ${tone}`}>
      <svg viewBox="0 0 108 108" aria-hidden="true">
        <circle className="ring-track" cx="54" cy="54" r={radius} />
        <circle
          className="ring-value"
          cx="54"
          cy="54"
          r={radius}
          strokeDasharray={circumference}
          strokeDashoffset={offset}
        />
      </svg>
      <div className="ring-copy">
        <strong>{score}</strong>
        <span>/ {max}</span>
      </div>
      <p>{label}</p>
    </div>
  );
}

function AssessmentBlock({
  title,
  subtitle,
  questions,
  answers,
  onChange,
}: {
  title: string;
  subtitle: string;
  questions: readonly string[];
  answers: number[];
  onChange: (answers: number[]) => void;
}) {
  return (
    <details className="assessment-block">
      <summary>
        <span>
          <strong>{title}</strong>
          <small>{subtitle}</small>
        </span>
        <span className="summary-score">{answers.reduce((sum, value) => sum + value, 0)} pts</span>
      </summary>
      <div className="question-list">
        {questions.map((question, index) => (
          <label className="question-row" key={question}>
            <span><b>{String(index + 1).padStart(2, "0")}</b>{question}</span>
            <select
              value={answers[index]}
              onChange={(event) => {
                const next = [...answers];
                next[index] = Number(event.target.value);
                onChange(next);
              }}
              aria-label={`${question} frequency`}
            >
              {answerLabels.map((label, value) => (
                <option value={value} key={label}>{label}</option>
              ))}
            </select>
          </label>
        ))}
      </div>
    </details>
  );
}

function TrendChart({ points }: { points: TrendPoint[] }) {
  const data = points;
  const width = 520;
  const height = 150;
  const pad = 18;
  const x = (index: number) => pad + index * ((width - pad * 2) / Math.max(1, data.length - 1));
  const y = (value: number) => height - pad - (value / 27) * (height - pad * 2);
  const pathFor = (key: "phq" | "gad") => data.map((point, i) => `${i ? "L" : "M"} ${x(i)} ${y(point[key])}`).join(" ");
  const describeChange = (key: "phq" | "gad", label: string) => {
    if (!data.length) return `${label}: no recorded score yet`;
    if (data.length === 1) return `${label}: ${data[0][key]} at the latest assessment`;
    const change = data.at(-1)![key] - data[0][key];
    if (change === 0) return `${label}: unchanged at ${data.at(-1)![key]}`;
    return `${label}: ${Math.abs(change)} point${Math.abs(change) === 1 ? "" : "s"} ${change > 0 ? "higher" : "lower"} than the first recorded assessment`;
  };

  return (
    <div className="trend-chart">
      {data.length ? <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Screening score trend chart">
        {[0, 9, 18, 27].map((value) => (
          <line key={value} x1={pad} x2={width - pad} y1={y(value)} y2={y(value)} className="grid-line" />
        ))}
        <path d={pathFor("phq")} className="trend-line phq-line" />
        <path d={pathFor("gad")} className="trend-line gad-line" />
        {data.map((point, i) => (
          <g key={`${point.date}-${i}`}>
            <circle cx={x(i)} cy={y(point.phq)} r="4" className="phq-dot" />
            <circle cx={x(i)} cy={y(point.gad)} r="4" className="gad-dot" />
          </g>
        ))}
      </svg> : <div className="empty-chart">Generate an assessment to begin the score graph.</div>}
      <div className="chart-footer">
        <span><i className="legend-dot phq-dot" /> PHQ-9</span>
        <span><i className="legend-dot gad-dot" /> GAD-7</span>
      </div>
      <div className="trend-reading">
        <span>{describeChange("phq", "Depressive symptoms")}</span>
        <span>{describeChange("gad", "Anxiety symptoms")}</span>
      </div>
    </div>
  );
}

export default function Home() {
  const [alias, setAlias] = useState("");
  const [age, setAge] = useState("28");
  const [pronouns, setPronouns] = useState("Prefer not to say");
  const [mood, setMood] = useState("");
  const [sleep, setSleep] = useState("");
  const [symptoms, setSymptoms] = useState("");
  const [context, setContext] = useState("");
  const [phqAnswers, setPhqAnswers] = useState(emptyPhq);
  const [gadAnswers, setGadAnswers] = useState(emptyGad);
  const [result, setResult] = useState<Result | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [timeline, setTimeline] = useState<TrendPoint[]>([]);
  const [therapyPlan, setTherapyPlan] = useState("");
  const [medicationPlan, setMedicationPlan] = useState("");
  const [medicationInstructions, setMedicationInstructions] = useState("");
  const [nextVisit, setNextVisit] = useState("");
  const [clinicianName, setClinicianName] = useState("");
  const [clinicianTitle, setClinicianTitle] = useState("");
  const [registrationNumber, setRegistrationNumber] = useState("");
  const [clinicName, setClinicName] = useState("");

  const phqScore = useMemo(() => phqAnswers.reduce((sum, value) => sum + value, 0), [phqAnswers]);
  const gadScore = useMemo(() => gadAnswers.reduce((sum, value) => sum + value, 0), [gadAnswers]);
  const safetySignal = useMemo(() => hasSafetySignal(symptoms, phqAnswers), [symptoms, phqAnswers]);

  useEffect(() => {
    const saved = sessionStorage.getItem("psychai-session-trend");
    if (saved) {
      try {
        const parsed = JSON.parse(saved) as TrendPoint[];
        queueMicrotask(() => setTimeline(parsed));
      } catch { /* Ignore malformed local session data. */ }
    }
  }, []);

  function loadSampleCase() {
    setAlias(sampleCase.alias);
    setAge(String(sampleCase.age));
    setPronouns(sampleCase.pronouns);
    setMood(sampleCase.mood);
    setSleep(sampleCase.sleep);
    setSymptoms(sampleCase.symptoms);
    setContext(sampleCase.context);
    setPhqAnswers(sampleCase.phq);
    setGadAnswers(sampleCase.gad);
    setResult(null);
    setError("");
  }

  async function analyze() {
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ age: age === "" ? undefined : Number(age), pronouns, mood, sleep, symptoms, context, phqAnswers, gadAnswers }),
      });
      if (!response.ok) throw new Error("The analysis service could not process this screening.");
      const data: Result = await response.json();
      setResult(data);
      const next = [...timeline, {
        date: new Intl.DateTimeFormat("en", { day: "2-digit", month: "short" }).format(new Date()),
        phq: phqScore,
        gad: gadScore,
      }].slice(-6);
      setTimeline(next);
      sessionStorage.setItem("psychai-session-trend", JSON.stringify(next));
      setTimeout(() => document.getElementById("report")?.scrollIntoView({ behavior: "smooth" }), 100);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Something went wrong.");
    } finally {
      setLoading(false);
    }
  }

  async function downloadReport() {
    if (!result) return;
    const { jsPDF } = await import("jspdf");
    const doc = new jsPDF({ unit: "mm", format: "a4", compress: true });
    const pageWidth = 210;
    const margin = 18;
    const contentWidth = pageWidth - margin * 2;
    const purple = [95, 65, 154] as const;
    const dark = [35, 31, 43] as const;
    const muted = [105, 99, 115] as const;
    let y = 20;
    const clean = (text: string) => text
      .replace(/[\u2010-\u2015]/g, "-")
      .replace(/\u00a0/g, " ")
      .replace(/[“”]/g, '"')
      .replace(/[‘’]/g, "'")
      .replace(/•/g, "-");
    const concise = (text: string) => {
      const normalized = text.replace(/\s+/g, " ").trim();
      if (normalized.length <= 720) return normalized;
      const clipped = normalized.slice(0, 720);
      const sentenceEnd = Math.max(clipped.lastIndexOf(". "), clipped.lastIndexOf("? "), clipped.lastIndexOf("! "));
      if (sentenceEnd >= 360) return clipped.slice(0, sentenceEnd + 1);
      return `${clipped.slice(0, clipped.lastIndexOf(" ")).replace(/[,:;\s]+$/, "")}.`;
    };
    const addPageIfNeeded = (height: number) => {
      if (y + height <= 282) return;
      doc.addPage();
      y = 20;
    };
    const addSection = (title: string) => {
      addPageIfNeeded(11);
      y += 2;
      doc.setFillColor(...purple);
      doc.roundedRect(margin, y, 3, 6, 1, 1, "F");
      doc.setFont("helvetica", "bold");
      doc.setFontSize(9);
      doc.setTextColor(...purple);
      doc.text(title.toUpperCase(), margin + 7, y + 4.8);
      y += 9.5;
    };
    const addParagraph = (text: string, color = dark) => {
      const lines = doc.splitTextToSize(clean(text), contentWidth) as string[];
      addPageIfNeeded(lines.length * 5 + 2);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(10);
      doc.setTextColor(...color);
      doc.text(lines, margin, y, { lineHeightFactor: 1.45 });
      y += lines.length * 5.1 + 2;
    };
    const addItems = (items: string[]) => {
      items.forEach((item) => {
        const lines = doc.splitTextToSize(clean(item), contentWidth - 7) as string[];
        addPageIfNeeded(lines.length * 4.8 + 3);
        doc.setFillColor(122, 92, 187);
        doc.circle(margin + 1.5, y - 1.2, 0.8, "F");
        doc.setFont("helvetica", "normal");
        doc.setFontSize(9.5);
        doc.setTextColor(...dark);
        doc.text(lines, margin + 6, y, { lineHeightFactor: 1.4 });
        y += lines.length * 4.8 + 2;
      });
    };

    doc.setFillColor(...purple);
    doc.rect(0, 0, pageWidth, 34, "F");
    doc.setTextColor(255, 255, 255);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(20);
    doc.text("PSYCHOLOGICAL CARE PRESCRIPTION", margin, 15);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9.5);
    doc.text(clean(clinicName || "PsychAI Clinical Workspace"), margin, 22);
    doc.setFontSize(8);
    doc.text("Clinical formulation and treatment plan", margin, 28);
    y = 42;

    doc.setDrawColor(222, 217, 230);
    doc.setFillColor(248, 246, 251);
    doc.roundedRect(margin, y, contentWidth, 22, 2, 2, "FD");
    doc.setTextColor(...muted);
    doc.setFontSize(7.5);
    doc.setFont("helvetica", "bold");
    doc.text("CASE REFERENCE", margin + 6, y + 7);
    doc.text("AGE / PRONOUNS", margin + 67, y + 7);
    doc.text("DATE", margin + 127, y + 7);
    doc.setTextColor(...dark);
    doc.setFontSize(10);
    doc.text(clean(alias || "De-identified profile"), margin + 6, y + 15);
    doc.text(clean(`${age || "Not provided"}${age ? " years" : ""} / ${pronouns}`), margin + 67, y + 15);
    doc.text(new Intl.DateTimeFormat("en-IN", { dateStyle: "medium" }).format(new Date()), margin + 127, y + 15);
    y += 28;

    addSection("Screening profile");
    doc.setFillColor(248, 246, 251);
    doc.roundedRect(margin, y, 83, 19, 2, 2, "F");
    doc.roundedRect(margin + 91, y, 83, 19, 2, 2, "F");
    doc.setTextColor(...purple);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(13);
    doc.text(`PHQ-9  ${phqScore}/27`, margin + 6, y + 8);
    doc.text(`GAD-7  ${gadScore}/21`, margin + 97, y + 8);
    doc.setTextColor(...muted);
    doc.setFontSize(8);
    doc.text(`${severity(phqScore, "phq")} depressive symptoms`, margin + 6, y + 14);
    doc.text(`${severity(gadScore, "gad")} anxiety symptoms`, margin + 97, y + 14);
    y += 24;

    addSection("Psychological formulation");
    addParagraph(concise(result.analysis.clinicalFormulation));
    addSection("Therapeutic prescription");
    if (therapyPlan.trim()) addParagraph(therapyPlan);
    else addItems(result.analysis.therapyOptions);
    addSection("Medication plan");
    addParagraph(medicationPlan.trim() || "No medication plan documented.");
    if (medicationInstructions.trim()) {
      doc.setFont("helvetica", "bold");
      doc.setFontSize(8);
      doc.setTextColor(...muted);
      doc.text("DOSAGE / INSTRUCTIONS / MONITORING", margin, y);
      y += 5;
      addParagraph(medicationInstructions);
    }
    addSection("Next review");
    addParagraph(nextVisit ? new Intl.DateTimeFormat("en-IN", { dateStyle: "long" }).format(new Date(`${nextVisit}T00:00:00`)) : "Not scheduled");

    addPageIfNeeded(38);
    y += 7;
    doc.setDrawColor(190, 184, 201);
    doc.line(margin, y + 16, margin + 73, y + 16);
    doc.line(margin + 99, y + 16, pageWidth - margin, y + 16);
    doc.setTextColor(...dark);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.text(clean(clinicianName || "Clinician name"), margin, y + 22);
    doc.text("Signature", margin + 99, y + 22);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(...muted);
    doc.setFontSize(8);
    doc.text(clean(clinicianTitle || "Professional designation"), margin, y + 27);
    doc.text(clean(registrationNumber ? `Registration: ${registrationNumber}` : "Registration number"), margin, y + 32);

    const pages = doc.getNumberOfPages();
    for (let page = 1; page <= pages; page += 1) {
      doc.setPage(page);
      doc.setDrawColor(225, 221, 231);
      doc.line(margin, 288, pageWidth - margin, 288);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(7);
      doc.setTextColor(...muted);
      doc.text("PsychAI | Psychological Care Prescription", margin, 293);
      doc.text(`Page ${page} of ${pages}`, pageWidth - margin, 293, { align: "right" });
    }

    const safeAlias = (alias || "case-report").replace(/[^a-z0-9-_]+/gi, "-").replace(/^-|-$/g, "");
    doc.save(`${safeAlias || "case-report"}-psychological-care-prescription.pdf`);
  }

  return (
    <main>
      <nav className="topbar">
        <a className="brand" href="#top" aria-label="PsychAI home">
          <span className="brand-mark">P</span>
          <span>Psych<span>AI</span></span>
        </a>
        <div className="nav-center">
          <a href="#assessment">Assessment</a>
          <a href="#report">Insights</a>
          <a href="#timeline">Timeline</a>
        </div>
        <span className="privacy-pill"><i /> Session private</span>
      </nav>

      <section className="hero" id="top">
        <div className="eyebrow">Psychological screening & care planning</div>
        <h1>Understand what you are<br /><em>feeling and experiencing.</em></h1>
        <p>
          PsychAI helps organize emotional, behavioural and day-to-day concerns into a
          structured psychological overview that can support meaningful clinical conversations.
        </p>
        <div className="hero-actions">
          <a className="primary-button" href="#assessment">Begin assessment <span>↗</span></a>
          <button className="ghost-button" onClick={loadSampleCase}>Load sample case <span>▶</span></button>
        </div>
      </section>

      <section className="workspace" id="assessment">
        <div className="section-heading">
          <div>
            <span className="kicker">ASSESSMENT WORKSPACE</span>
            <h2>Build the clinical picture</h2>
          </div>
          <p>Use a case reference only. Direct identifiers are not required for clinical synthesis.</p>
        </div>

        <div className="workspace-grid">
          <div className="intake-card panel">
            <div className="panel-title">
              <span className="step-number">01</span>
              <div><h3>Context & self-report</h3><p>Tell us what has been happening recently.</p></div>
              <span className="complete-tag">PRIVATE</span>
            </div>
            <div className="field-grid">
              <label><span>Case reference</span><input value={alias} onChange={(e) => setAlias(e.target.value)} placeholder="e.g. Case A-104" /></label>
              <label><span>Age range</span><input type="number" min="13" max="100" value={age} onChange={(e) => setAge(e.target.value)} /></label>
              <label className="wide"><span>Pronouns</span>
                <select value={pronouns} onChange={(e) => setPronouns(e.target.value)}>
                  <option>Prefer not to say</option><option>She / her</option><option>He / him</option><option>They / them</option>
                </select>
              </label>
              <label className="wide"><span>Current mood</span><input value={mood} onChange={(e) => setMood(e.target.value)} placeholder="How would you describe your mood?" /></label>
              <label className="wide"><span>Sleep pattern</span><input value={sleep} onChange={(e) => setSleep(e.target.value)} placeholder="Duration, quality, recent changes…" /></label>
              <label className="wide"><span>Symptoms in your own words</span><textarea value={symptoms} onChange={(e) => setSymptoms(e.target.value)} placeholder="Describe the main concerns, when they began and their impact…" rows={4} /></label>
              <label className="wide"><span>Life context & available support</span><textarea value={context} onChange={(e) => setContext(e.target.value)} placeholder="Recent changes, stressors, relationships and sources of support…" rows={3} /></label>
            </div>

            <div className="panel-title screening-title">
              <span className="step-number">02</span>
              <div><h3>Validated screeners</h3><p>Frequency during the previous two weeks.</p></div>
            </div>
            <AssessmentBlock title="PHQ-9" subtitle="Depressive symptom screening" questions={phqQuestions} answers={phqAnswers} onChange={setPhqAnswers} />
            <AssessmentBlock title="GAD-7" subtitle="Anxiety symptom screening" questions={gadQuestions} answers={gadAnswers} onChange={setGadAnswers} />

            {error && <div className="error-banner">{error}</div>}
            <div className="submit-row">
              <span><i className="lock-icon">⌁</i> Case reference is not sent to the AI endpoint</span>
              <button className="analyze-button" onClick={analyze} disabled={loading}>
                {loading ? <><i className="spinner" /> Building insight…</> : <>Generate structured insight <b>↗</b></>}
              </button>
            </div>
          </div>

          <aside className="sidebar">
            <div className={`safety-card ${safetySignal ? "alert" : ""}`}>
              <div className="safety-icon">{safetySignal ? "!" : "✓"}</div>
              <div><span>SAFETY CHECK</span><strong>{safetySignal ? "Review required" : "No immediate signal"}</strong><p>{safetySignal ? "A response needs prompt human follow-up." : "Continually evaluated as answers change."}</p></div>
            </div>
            <div className="score-card panel">
              <div className="mini-heading"><span>LIVE SCREENING SNAPSHOT</span><i>Updated now</i></div>
              <div className="rings">
                <ScoreRing score={phqScore} max={27} label="PHQ-9" tone="violet" />
                <ScoreRing score={gadScore} max={21} label="GAD-7" tone="cyan" />
              </div>
              <div className="severity-row"><span>Depressive symptoms</span><strong>{severity(phqScore, "phq")}</strong></div>
              <div className="severity-row"><span>Anxiety symptoms</span><strong>{severity(gadScore, "gad")}</strong></div>
              <p className="score-note">Screening scores measure symptom burden. They do not establish a diagnosis.</p>
            </div>
          </aside>
        </div>
      </section>

      {result && (
        <section className="report-section" id="report">
          <div className="report-top">
            <div><span className="kicker">PSYCHOLOGICAL OVERVIEW</span><h2>Screening-informed care summary</h2></div>
            <div className="report-actions">
              <span className={`mode-badge ${result.mode}`}>
                {result.mode === "ai-assisted" ? "✦ AI-assisted" : result.mode === "safety-protocol" ? "! Safety protocol" : "Rules-only fallback"}
              </span>
              <button className="download-button" onClick={downloadReport}>Download prescription PDF ↓</button>
            </div>
          </div>

          {result.safety && (
            <div className="crisis-banner">
              <strong>Immediate human review recommended</strong>
              <p>If there is immediate danger, contact local emergency services now. In India, call 112. This app is not a crisis service.</p>
            </div>
          )}

          <div className="report-grid">
            <article className="summary-card feature-report-card">
              <span className="report-label">CLINICAL FORMULATION</span>
              <h3>{result.analysis.clinicalFormulation}</h3>
              <div className="profile-stamp"><span>{alias ? alias.slice(0, 2).toUpperCase() : "DP"}</span><div><b>{alias || "De-identified profile"}</b><small>{age} years · {pronouns}</small></div></div>
            </article>
            <article className="report-card">
              <span className="report-label">PRESENTING CONCERNS</span>
              <ul>{result.analysis.presentingConcerns.map((item) => <li key={item}>{item}</li>)}</ul>
            </article>
            <article className="report-card">
              <span className="report-label">FUNCTIONAL IMPACT</span>
              <ul>{result.analysis.functionalImpact.map((item) => <li key={item}>{item}</li>)}</ul>
            </article>
            <article className="report-card">
              <span className="report-label">PROTECTIVE FACTORS</span>
              <ul className="positive-list">{result.analysis.protectiveFactors.map((item) => <li key={item}>{item}</li>)}</ul>
            </article>
            <article className="report-card next-card">
              <span className="report-label">THERAPY DIRECTIONS</span>
              <ul>{result.analysis.therapyOptions.map((item) => <li key={item}>{item}</li>)}</ul>
            </article>
            <article className="report-card">
              <span className="report-label">MEDICATION REVIEW</span>
              <ul>{result.analysis.medicationConsiderations.map((item) => <li key={item}>{item}</li>)}</ul>
            </article>
          </div>

          <div className="care-plan panel">
            <div className="care-plan-heading">
              <div><span className="kicker">PSYCHOLOGICAL CARE PRESCRIPTION</span><h3>Document the treatment plan</h3></div>
              <p>Medication fields are for an authorized prescriber to complete after clinical and medical review.</p>
            </div>
            <div className="care-plan-grid">
              <label><span>Clinician name</span><input value={clinicianName} onChange={(event) => setClinicianName(event.target.value)} placeholder="Full professional name" /></label>
              <label><span>Professional designation</span><input value={clinicianTitle} onChange={(event) => setClinicianTitle(event.target.value)} placeholder="e.g. Clinical Psychologist" /></label>
              <label><span>Registration / licence number</span><input value={registrationNumber} onChange={(event) => setRegistrationNumber(event.target.value)} placeholder="Professional registration number" /></label>
              <label><span>Clinic / practice</span><input value={clinicName} onChange={(event) => setClinicName(event.target.value)} placeholder="Clinic or practice name" /></label>
              <label><span>Selected therapy approach</span><textarea rows={3} value={therapyPlan} onChange={(event) => setTherapyPlan(event.target.value)} placeholder="e.g. CBT focused on worry cycles, behavioural activation and sleep routine" /></label>
              <label><span>Medication plan</span><input value={medicationPlan} onChange={(event) => setMedicationPlan(event.target.value)} placeholder="Authorized prescriber entry only" /></label>
              <label><span>Dosage, instructions and monitoring</span><textarea rows={3} value={medicationInstructions} onChange={(event) => setMedicationInstructions(event.target.value)} placeholder="Document instructions, contraindication review and monitoring plan" /></label>
              <label><span>Next visit</span><input type="date" value={nextVisit} onChange={(event) => setNextVisit(event.target.value)} /></label>
            </div>
          </div>

          <div className="evidence-card">
            <div><span className="kicker">RETRIEVED EVIDENCE</span><h3>Guidance matched to this screening</h3></div>
            <div className="evidence-list">
              {result.evidence.map((item, index) => (
                <a href={item.url} target="_blank" rel="noreferrer" key={item.id}>
                  <span>0{index + 1}</span><div><b>{item.title}</b><small>{item.source}</small></div><i>↗</i>
                </a>
              ))}
            </div>
          </div>
        </section>
      )}

      <section className="timeline-section" id="timeline">
        <div><span className="kicker">SCORE GRAPH</span><h2>Screening score trend</h2><p>The graph compares recorded PHQ-9 and GAD-7 scores during this browser session.</p></div>
        <TrendChart points={timeline} />
      </section>

      <footer>
        <div className="brand"><span className="brand-mark">P</span><span>Psych<span>AI</span></span></div>
        <p>Professional decision support for qualified review. Outputs support—but do not replace—clinical assessment, diagnosis or emergency protocols.</p>
        <span>Built for clarity · Designed for privacy</span>
      </footer>
    </main>
  );
}
