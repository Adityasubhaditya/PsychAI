import { NextResponse } from "next/server";
import { hasSafetySignal, severity } from "@/lib/assessments";
import { retrieveGuidance } from "@/lib/knowledge";

type AnalyzeBody = {
  age?: number;
  pronouns?: string;
  mood?: string;
  sleep?: string;
  symptoms?: string;
  context?: string;
  phqAnswers?: number[];
  gadAnswers?: number[];
};

type Analysis = {
  clinicalFormulation: string;
  presentingConcerns: string[];
  functionalImpact: string[];
  protectiveFactors: string[];
  therapyOptions: string[];
  medicationConsiderations: string[];
};

function fallbackAnalysis(body: AnalyzeBody, phqScore: number, gadScore: number, safety: boolean): Analysis {
  const mood = body.mood?.trim() || "Mood concerns were not described";
  const sleep = body.sleep?.trim() || "Sleep pattern was not described";
  return {
    clinicalFormulation: safety
      ? "The current presentation includes a safety-related response that takes priority over routine formulation. A qualified professional should clarify intent, plan, access to means, protective factors and immediate support before continuing the assessment."
      : `The available information suggests a pattern of ${severity(phqScore, "phq").toLowerCase()} depressive symptoms alongside ${severity(gadScore, "gad").toLowerCase()} anxiety symptoms. Mood, sleep, current stressors and day-to-day functioning should be explored together to understand what may be precipitating and maintaining the distress. This is a working psychological formulation, not a diagnosis.`,
    presentingConcerns: [
      mood,
      sleep,
      `PHQ-9 ${phqScore}/27 (${severity(phqScore, "phq").toLowerCase()}); GAD-7 ${gadScore}/21 (${severity(gadScore, "gad").toLowerCase()})`,
    ],
    functionalImpact: [
      "Clarify effects on work or study, relationships, self-care and routine.",
      "Assess duration, recent change and situations in which symptoms improve or worsen.",
    ],
    protectiveFactors: ["Engagement with screening", "Willingness to describe current experiences"],
    therapyOptions: safety
      ? ["Complete safety planning and stabilization before beginning routine therapy work."]
      : [
          "Consider cognitive behavioural therapy to examine links between thoughts, emotions and behaviour.",
          "Consider behavioural activation where withdrawal, low motivation or reduced pleasure are prominent.",
          "Use sleep-focused behavioural strategies when disrupted sleep is maintaining mood or anxiety symptoms.",
        ],
    medicationConsiderations: [
      "Medication decisions require an authorized prescriber, diagnostic assessment, medical history and interaction review.",
      "If symptoms are persistent, severe or significantly impairing, consider referral for a medication evaluation.",
    ],
  };
}

function cleanAnalysis(value: unknown, fallback: Analysis): Analysis {
  if (!value || typeof value !== "object") return fallback;
  const candidate = value as Partial<Analysis>;
  const strings = (input: unknown, defaultValue: string[]) =>
    Array.isArray(input) ? input.filter((item): item is string => typeof item === "string").slice(0, 5) : defaultValue;
  const concise = (input: unknown, defaultValue: string) => {
    if (typeof input !== "string") return defaultValue;
    const normalized = input.replace(/\s+/g, " ").trim();
    if (normalized.length <= 720) return normalized;
    const clipped = normalized.slice(0, 720);
    const sentenceEnd = Math.max(clipped.lastIndexOf(". "), clipped.lastIndexOf("? "), clipped.lastIndexOf("! "));
    if (sentenceEnd >= 360) return clipped.slice(0, sentenceEnd + 1);
    return `${clipped.slice(0, clipped.lastIndexOf(" ")).replace(/[,:;\s]+$/, "")}.`;
  };
  return {
    clinicalFormulation: concise(candidate.clinicalFormulation, fallback.clinicalFormulation),
    presentingConcerns: strings(candidate.presentingConcerns, fallback.presentingConcerns),
    functionalImpact: strings(candidate.functionalImpact, fallback.functionalImpact),
    protectiveFactors: strings(candidate.protectiveFactors, fallback.protectiveFactors),
    therapyOptions: strings(candidate.therapyOptions, fallback.therapyOptions),
    medicationConsiderations: strings(candidate.medicationConsiderations, fallback.medicationConsiderations),
  };
}

export async function POST(request: Request) {
  let body: AnalyzeBody;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON request." }, { status: 400 });
  }

  const phqAnswers = Array.isArray(body.phqAnswers) ? body.phqAnswers.slice(0, 9) : [];
  const gadAnswers = Array.isArray(body.gadAnswers) ? body.gadAnswers.slice(0, 7) : [];
  const phqScore = phqAnswers.reduce((sum, value) => sum + Math.min(3, Math.max(0, Number(value) || 0)), 0);
  const gadScore = gadAnswers.reduce((sum, value) => sum + Math.min(3, Math.max(0, Number(value) || 0)), 0);
  const safety = hasSafetySignal(body.symptoms ?? "", phqAnswers);
  const evidence = retrieveGuidance(
    `${body.symptoms ?? ""} ${body.mood ?? ""} ${body.sleep ?? ""} ${safety ? "safety crisis" : ""} ${phqScore >= 10 ? "depression" : ""} ${gadScore >= 10 ? "anxiety" : ""}`,
  );
  const fallback = fallbackAnalysis(body, phqScore, gadScore, safety);
  const apiKey = process.env.GROQ_API_KEY;

  if (safety) {
    return NextResponse.json({
      analysis: fallback,
      evidence,
      safety: true,
      mode: "safety-protocol",
    });
  }

  if (!apiKey) {
    return NextResponse.json({
      analysis: fallback,
      evidence,
      safety,
      mode: "rules-only",
    });
  }

  const prompt = {
    demographics: { age: body.age, pronouns: body.pronouns },
    selfReport: { mood: body.mood, sleep: body.sleep, symptoms: body.symptoms, context: body.context },
    screening: {
      phq9: { score: phqScore, severity: severity(phqScore, "phq") },
      gad7: { score: gadScore, severity: severity(gadScore, "gad") },
      safetySignal: safety,
    },
    retrievedGuidance: evidence.map(({ title, source, text }) => ({ title, source, text })),
  };

  try {
    const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      signal: AbortSignal.timeout(20_000),
      body: JSON.stringify({
        model: process.env.GROQ_MODEL || "openai/gpt-oss-20b",
        temperature: 0.2,
        max_tokens: 850,
        response_format: { type: "json_object" },
        messages: [
          {
            role: "system",
            content:
              "You are a cautious clinical psychology formulation assistant supporting qualified professional review. Do not merely paraphrase the self-report. Integrate the information into a concise formulation that connects presenting concerns, possible precipitating and maintaining factors, functional impact and coping resources. Use psychologically informed, compassionate language without independently diagnosing. Suggest evidence-aligned therapy approaches and why they may fit this presentation. For medication, provide only referral or assessment considerations: never name a drug, prescribe, recommend a dose or imply that medication is required. Do not invent citations. Use only the supplied screening data and retrieved guidance. Return JSON with exactly: clinicalFormulation (string), presentingConcerns (string[]), functionalImpact (string[]), protectiveFactors (string[]), therapyOptions (string[]), medicationConsiderations (string[]).",
          },
          { role: "user", content: JSON.stringify(prompt) },
        ],
      }),
    });

    if (!response.ok) throw new Error(`Groq returned ${response.status}`);
    const result = await response.json();
    const raw = result?.choices?.[0]?.message?.content;
    const parsed = typeof raw === "string" ? JSON.parse(raw) : raw;
    return NextResponse.json({
      analysis: cleanAnalysis(parsed, fallback),
      evidence,
      safety,
      mode: "ai-assisted",
    });
  } catch (error) {
    console.error("AI analysis failed; returning deterministic screening output.", error);
    return NextResponse.json({ analysis: fallback, evidence, safety, mode: "rules-only" });
  }
}
