# ATS Scoring System

## Overview

The ATS (Applicant Tracking System) scoring tool lives in `lib/atsScoring.ts`. It analyzes how well the candidate's resume matches a given job description — entirely client-side, no API calls.

---

## How the Algorithm Works

### Step 1: Extract JD Keywords

The `extractKeywords(text)` function:
1. Lowercases and normalises the JD text
2. Tokenises on whitespace
3. Strips leading/trailing non-alphanumeric characters from tokens
4. Filters out **stop words** (≈60 generic English words)
5. Also generates **bi-grams** (two-word pairs like "machine learning", "react native")
6. Returns unique keywords

### Step 2: Build Resume Keyword Set

The `buildResumeKeywords(resume)` function extracts from:
- All skills in every `SkillCategory`
- `technologies[]` arrays from each experience entry
- CamelCase or hyphenated tech names extracted from experience bullet points
- `stack[]` arrays from each project

### Step 3: Match Keywords

For each JD keyword:
- **Direct hit**: `resumeKws.has(kw)`
- **Partial containment**: e.g., resume has "react" → matches "reactjs" (and vice versa, minimum 4 chars)

Matched → `matched[]`, unmatched → `missing[]`

### Step 4: Score

```
score = Math.round((matched.length / totalRelevantJDKeywords) * 100)
```

Only JD keywords matching the pattern `/^[a-z][a-z0-9+#.]{1,}$/` and length ≥ 3 are counted (filters out generic words that slipped past stop-word filtering). Maximum 60 JD keywords considered.

### Step 5: Label

| Score Range | Label |
|-------------|-------|
| ≥ 65 | `"high"` |
| 35–64 | `"medium"` |
| < 35 | `"low"` |

---

## Stop Words List

The stop words set (≈60 words) covers:
- Common English conjunctions/prepositions: `and`, `or`, `the`, `with`, `for`, `to`...
- HR-speak: `experience`, `years`, `required`, `preferred`, `team`, `role`, `seeking`...
- Generic verbs: `build`, `develop`, `implement`, `help`, `lead`, `design`...

This ensures only meaningful tech/skill terms are compared.

---

## Input / Output

```ts
import { calculateAtsScore } from "@/lib/atsScoring";

const result = calculateAtsScore(jobDescriptionText, resumeData);

// result: AtsResult
{
  score: 72,                  // 0-100
  matched: ["typescript", "react", "graphql", ...],  // up to 20
  missing: ["rust", "wasm", "kubernetes", ...],       // up to 20
  label: "high"
}
```

---

## Usage in the Admin Dashboard

1. Admin pastes a job description into the textarea
2. `calculateAtsScore()` runs synchronously on every keystroke (or on submit)
3. Results display:
   - A circular/bar score meter (0–100)
   - Green chip list of matched keywords
   - Red chip list of missing keywords
4. Admin can use the missing keywords to guide the AI tailoring step

---

## Limitations & Known Behaviours

| Limitation | Notes |
|---|---|
| Case-insensitive only | "TypeScript" and "typescript" are treated the same |
| No stemming | "tested" does not match "testing" |
| No synonym expansion | "k8s" does not match "kubernetes" |
| Bi-gram order matters | "learning machine" ≠ "machine learning" |
| Max 60 JD keywords | Prevents score dilution on very long JDs |
| Max 20 results shown | `matched` and `missing` arrays are capped at 20 for UI clarity |

---

## Extending the Algorithm

To improve accuracy:
1. Add a **tech synonym map**: `{ "k8s": "kubernetes", "js": "javascript", ... }`
2. Add **stemming** via a library like `natural` or `compromise`
3. Weight **skills section** matches higher than experience bullet matches
4. Use **TF-IDF** weighting for JD keyword importance
