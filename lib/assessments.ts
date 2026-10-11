export type AssessmentKey = "phq" | "gad";

export const answerLabels = [
  "Not at all",
  "Several days",
  "More than half the days",
  "Nearly every day",
] as const;

export const phqQuestions = [
  "Little interest or pleasure in doing things",
  "Feeling down, depressed, or hopeless",
  "Trouble falling or staying asleep, or sleeping too much",
  "Feeling tired or having little energy",
  "Poor appetite or overeating",
  "Feeling bad about yourself or that you are a failure",
  "Trouble concentrating on things",
  "Moving or speaking slowly, or being unusually restless",
  "Thoughts that you would be better off dead or of hurting yourself",
] as const;

export const gadQuestions = [
  "Feeling nervous, anxious, or on edge",
  "Not being able to stop or control worrying",
  "Worrying too much about different things",
  "Trouble relaxing",
  "Being so restless that it is hard to sit still",
  "Becoming easily annoyed or irritable",
  "Feeling afraid as if something awful might happen",
] as const;

export function severity(score: number, type: AssessmentKey) {
  if (type === "phq") {
    if (score < 5) return "Minimal";
    if (score < 10) return "Mild";
    if (score < 15) return "Moderate";
    if (score < 20) return "Moderately severe";
    return "Severe";
  }
  if (score < 5) return "Minimal";
  if (score < 10) return "Mild";
  if (score < 15) return "Moderate";
  return "Severe";
}

const riskPattern =
  /\b(suicid(?:e|al)|kill myself|end my life|hurt myself|self[- ]?harm|kill (?:him|her|them)|hurt (?:him|her|them))\b/i;

export function hasSafetySignal(symptoms: string, phqAnswers: number[]) {
  return (phqAnswers[8] ?? 0) > 0 || riskPattern.test(symptoms);
}
