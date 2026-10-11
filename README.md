<div align="center">

# 🧠 PsychAI

### Explainable psychological screening and care-planning intelligence

PsychAI converts structured screening responses and de-identified context into a clear, reviewable psychological overview for qualified professional use.

[![Next.js](https://img.shields.io/badge/Next.js-16-000000?style=for-the-badge&logo=nextdotjs)](https://nextjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?style=for-the-badge&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![React](https://img.shields.io/badge/React-19-61DAFB?style=for-the-badge&logo=react&logoColor=111827)](https://react.dev/)
[![Vercel](https://img.shields.io/badge/Vercel-Ready-000000?style=for-the-badge&logo=vercel)](https://vercel.com/)

</div>

---

## ✨ What PsychAI does

PsychAI brings validated screening, safety checks, evidence retrieval and constrained AI synthesis into one compact workflow. It is designed to make psychological information easier to review—not to replace clinical judgement.

- **Validated screening:** deterministic PHQ-9 and GAD-7 scoring
- **Safety-first triage:** safety signals are evaluated before generative AI runs
- **Psychological formulation:** connects symptoms, context, functional impact and protective factors
- **Therapy directions:** suggests relevant psychological approaches for professional consideration
- **Care-plan workspace:** clinician details, therapy plan, medication documentation and next-review date
- **Professional PDF:** downloads a polished single-page A4 psychological care prescription
- **Evidence links:** retrieves relevant guidance from WHO, NIMH and NICE
- **Session trends:** compares screening scores inside the current browser session
- **Graceful fallback:** deterministic results remain available if the AI provider is unavailable
- **Privacy-conscious design:** no database and no server-side patient record storage

## 🤖 AI/ML pipeline

| Layer | Responsibility | Why it matters |
|---|---|---|
| Deterministic scoring | Calculates PHQ-9 and GAD-7 results in TypeScript | Scores are reproducible and never guessed by an LLM |
| Safety screening | Detects self-harm responses and risk-related language | High-risk cases bypass routine AI synthesis |
| Evidence retrieval | Matches the presentation to a curated local guidance index | Keeps supporting guidance traceable |
| Constrained synthesis | Groq returns a small validated JSON schema | Prevents free-form chatbot output from controlling the UI |
| Rules-only fallback | Produces a structured screening summary without an API call | The core workflow still functions during provider failure |

## 🏗️ Architecture

```mermaid
flowchart LR
    A[Next.js client] --> B[PHQ-9 / GAD-7 scoring]
    A --> C[/api/analyze]
    C --> D{Safety signal?}
    D -->|Yes| E[Deterministic safety protocol]
    D -->|No| F[Local evidence retrieval]
    F --> G[Groq structured synthesis]
    G --> H[Validated clinical JSON]
    H --> I[Care-plan workspace]
    I --> J[In-browser PDF generation]
```

The frontend and backend live in one Vercel-ready Next.js project. `/api/analyze` becomes an on-demand serverless function, while the main interface is statically optimized.

## 🧰 Tech stack

- **Next.js 16 App Router** — application and serverless API
- **React 19 + TypeScript** — typed interactive interface
- **Groq Chat Completions** — structured formulation using `openai/gpt-oss-20b`
- **jsPDF** — private, client-side PDF generation
- **CSS + SVG** — responsive UI and score visualization without a component library
- **Browser sessionStorage** — temporary score history; no database

## 🔐 Safety and privacy

- Use a case reference instead of direct identifiers.
- The case reference is not sent to the AI endpoint.
- High-risk responses enter a deterministic safety pathway.
- The AI cannot autonomously diagnose, select medication or generate dosages.
- Medication fields are clinician-entered and intended for an appropriately authorized professional.
- Closing the browser session clears the locally stored score timeline.

> PsychAI supports qualified professional review. It does not replace a complete clinical assessment, diagnosis, prescribing authority or emergency protocol.

## 🚀 Run locally

```bash
npm install
copy .env.example .env.local
npm run dev
```

Add your Groq key to `.env.local`:

```env
GROQ_API_KEY=your_key_here
GROQ_MODEL=openai/gpt-oss-20b
```

The application deliberately falls back to its rules-based screening summary when no API key is available.

## ✅ Verification

```bash
npm run check
npm run build
```

## ☁️ Vercel deployment

1. Import this repository into Vercel.
2. Add `GROQ_API_KEY` under **Project Settings → Environment Variables**.
3. Optionally set `GROQ_MODEL=openai/gpt-oss-20b`.
4. Deploy using the automatically detected Next.js preset.

No Python runtime, database or persistent server is required for the deployed application.

## 🗂️ Legacy Python prototype

The original `front.py`, `back.py` and `req.txt` files are intentionally retained for historical reference and comparison only.

**They are not imported, executed, built or deployed by the current application.** The production implementation is entirely Next.js/React/TypeScript, and Vercel only builds the files described by `package.json` and the Next.js application structure.

## 📁 Current project structure

```text
app/
├── api/analyze/route.ts   # Serverless analysis backend
├── globals.css            # Responsive visual system
├── layout.tsx             # Application metadata and shell
└── page.tsx               # Screening, insights, care plan and PDF UI
lib/
├── assessments.ts         # Deterministic scoring and safety signals
└── knowledge.ts           # Curated evidence retrieval
front.py / back.py         # Legacy prototype — reference only
```

---

<div align="center">

Built for clarity, traceability and responsible professional review.

</div>
