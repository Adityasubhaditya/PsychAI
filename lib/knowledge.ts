export type EvidenceItem = {
  id: string;
  title: string;
  source: string;
  url: string;
  text: string;
  tags: string[];
};

const guidance: EvidenceItem[] = [
  {
    id: "who-depression",
    title: "Depressive disorder (depression)",
    source: "World Health Organization",
    url: "https://www.who.int/news-room/fact-sheets/detail/depression",
    text: "Depression can affect mood, interest, sleep, concentration, energy and functioning. Effective psychological and medical treatments exist.",
    tags: ["depression", "mood", "sleep", "energy", "interest", "hopeless"],
  },
  {
    id: "who-anxiety",
    title: "Anxiety disorders",
    source: "World Health Organization",
    url: "https://www.who.int/news-room/fact-sheets/detail/anxiety-disorders",
    text: "Anxiety disorders involve excessive fear and worry and may affect daily functioning. Psychological interventions are effective treatments.",
    tags: ["anxiety", "worry", "fear", "panic", "restless", "nervous"],
  },
  {
    id: "nimh-help",
    title: "Help for mental illnesses",
    source: "National Institute of Mental Health",
    url: "https://www.nimh.nih.gov/health/find-help",
    text: "Immediate help is appropriate when someone is in crisis or experiencing life-threatening thoughts or behaviour.",
    tags: ["crisis", "suicide", "self-harm", "emergency", "safety"],
  },
  {
    id: "nice-depression",
    title: "Depression in adults: treatment and management",
    source: "NICE Guideline NG222",
    url: "https://www.nice.org.uk/guidance/ng222",
    text: "Assessment should consider symptom severity, duration, personal history, functional impairment and individual preferences when discussing care.",
    tags: ["depression", "assessment", "function", "history", "treatment"],
  },
];

function tokens(value: string) {
  return value.toLowerCase().match(/[a-z-]{3,}/g) ?? [];
}

/** Tiny, dependency-free retrieval layer for the curated guidance collection. */
export function retrieveGuidance(query: string, limit = 3): EvidenceItem[] {
  const queryTokens = new Set(tokens(query));
  return guidance
    .map((item) => {
      const body = [...tokens(item.text), ...item.tags];
      const overlap = body.reduce((score, token) => score + (queryTokens.has(token) ? 1 : 0), 0);
      return { item, score: overlap + (item.id === "nimh-help" && queryTokens.has("safety") ? 3 : 0) };
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map(({ item }) => item);
}
