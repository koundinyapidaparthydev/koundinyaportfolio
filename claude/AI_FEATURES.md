# AI Features

## Overview

The portfolio integrates AI in two ways:
1. **Client-side ATS scoring** — purely algorithmic, no API calls
2. **Server-side resume tailoring** — powered by Anthropic Claude

---

## 1. ATS Keyword Scoring (Client-Side)

**Location**: `lib/atsScoring.ts`  
**Used in**: Admin dashboard → ATS Scorer tab

Analyzes how well the resume matches a job description without any API calls. See [ATS_SCORING.md](./ATS_SCORING.md) for the full algorithm.

```ts
const result = calculateAtsScore(jobDescriptionText, resume);
// result.score: 0-100
// result.label: "high" | "medium" | "low"
// result.matched: string[]
// result.missing: string[]
```

---

## 2. AI Resume Tailoring (Anthropic Claude)

**Location**: `app/api/resume/tailor/route.ts`  
**Library**: `@anthropic-ai/sdk`  
**Model**: Claude (latest available via API key)

### How It Works

1. Admin pastes a job description in the admin dashboard
2. Clicks "Tailor with AI"
3. Client sends `POST /api/resume/tailor`:

```json
{
  "jobDescription": "<full JD text>",
  "resume": { /* current Resume object */ }
}
```

4. Server builds a prompt instructing Claude to:
   - Rewrite `experience[].points` bullets to use language from the JD
   - Incorporate missing keywords naturally
   - Maintain truthfulness (no fabrication)
   - Preserve the JSON structure of the resume

5. Claude returns the modified resume JSON
6. Server validates and returns it to the client
7. Client loads the tailored resume into Zustand
8. Admin reviews, then saves or discards

### Prompt Strategy

The system prompt instructs Claude to act as an expert resume coach:

```
You are an expert resume coach and ATS optimization specialist.
You will be given a resume in JSON format and a job description.
Rewrite ONLY the experience bullet points to:
1. Use language and keywords from the job description
2. Quantify achievements where possible
3. Maintain truthfulness — do not invent facts
4. Return the FULL resume JSON with only the experience.points fields changed.
```

### Error Handling

- If `ANTHROPIC_API_KEY` is not set → returns `{ error: "AI tailoring not configured" }` with 503
- If Claude returns invalid JSON → server logs error, returns 500
- If request times out → Vercel serverless function timeout (10s default)

---

## 3. Potential Future AI Features

These are not yet implemented but are natural extensions:

### Cover Letter Generator
- Input: job description + company name
- Output: personalized cover letter
- Implementation: POST `/api/cover-letter` → Claude prompt

### Interview Prep
- Input: job description + resume
- Output: predicted interview questions + model answers
- Implementation: POST `/api/interview-prep` → streaming Claude response

### Resume Score Improvement Suggestions
- Input: ATS results (matched/missing keywords)
- Output: specific suggestions for which resume sections to strengthen
- Implementation: Client-side Claude call or server route

### Portfolio Chat
- A chat widget where visitors can ask questions about the portfolio owner
- Implementation: RAG over resume data + Claude

---

## Anthropic SDK Usage

```ts
import Anthropic from "@anthropic-ai/sdk";

const client = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

const message = await client.messages.create({
  model: "claude-opus-4-5",
  max_tokens: 4096,
  messages: [
    {
      role: "user",
      content: `${systemPrompt}\n\nResume:\n${JSON.stringify(resume, null, 2)}\n\nJob Description:\n${jobDescription}`,
    },
  ],
});

const tailoredResume = JSON.parse(message.content[0].text);
```

---

## Security & Privacy

- `ANTHROPIC_API_KEY` is a server-only secret (not prefixed with `NEXT_PUBLIC_`)
- Resume data sent to Anthropic includes personal info (name, email, phone)
- Anthropic's data retention policy applies — review before using in production
- Consider stripping PII before sending to Anthropic if privacy is a concern
