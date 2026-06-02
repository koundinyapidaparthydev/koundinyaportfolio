# Data Models

All types are defined in `types/resume.ts`.

---

## `Resume` (root object)

```ts
interface Resume {
  personalInfo: PersonalInfo;
  education: Education[];
  experience: Experience[];
  skills: SkillCategory[];
  projects: Project[];
}
```

The canonical source of truth is `data/resume.ts` which exports `resumeData: Resume`.

---

## `PersonalInfo`

```ts
interface PersonalInfo {
  name: string;           // "Koundinya Pidaparthy"
  title: string;          // "Full Stack Software Engineer"
  email: string;          // "koundinyapidaparthy@gmail.com"
  phone: string;          // "551-229-8660"
  location: string;       // "New York, NY"
  linkedin: string;       // "linkedin.com/in/koundinyap"
  github: string;         // "github.com/koundinyapidaparthy2"
  portfolio: string;      // "koundinyapidaparthy.com"
  summary: string;        // Multi-sentence bio
}
```

---

## `Experience`

```ts
interface Experience {
  id: string;             // e.g. "exp-1"
  companyName: string;    // "Anchor Operating System"
  role: string;           // "Software Engineer"
  location: string;       // "New York, NY (Remote)"
  date: string;           // "June 2025 – Present" (display string)
  startDate: string;      // "June 2025"
  endDate: string;        // "Present" | "Sep 2024"
  points: string[];       // Bullet-point accomplishments
  technologies?: string[]; // ["Next.js 14", "TypeScript", ...]
}
```

Current entries (4 total):
| id | Company | Role | Period |
|----|---------|------|--------|
| exp-1 | Anchor Operating System | Software Engineer | June 2025–Present |
| exp-2 | Anchor Operating System | Software Engineer Intern | May–Sep 2024 |
| exp-3 | Hornblower Group | Software Developer | Aug 2022–Jul 2023 |
| exp-4 | Syscloud Technologies | Frontend Software Engineer Intern | June 2021–June 2022 |

---

## `Education`

```ts
interface Education {
  id: string;
  institution: string;
  degree: string;           // "Master of Science"
  field: string;            // "Computer Science"
  gpa?: string;             // "3.95"
  graduationDate: string;   // "May 2025"
  location: string;
  achievements?: string[];  // Dean's List, TA, etc.
}
```

Current entries:
| id | Institution | Degree | Year |
|----|------------|--------|------|
| edu-1 | Pace University | M.S. Computer Science | 2025 |
| edu-2 | JNTU Hyderabad | B.Tech Computer Science & Engineering | 2021 |

---

## `SkillCategory`

```ts
interface SkillCategory {
  id: string;      // e.g. "skill-frontend"
  title: string;   // "Frontend"
  skills: string[]; // ["React", "Next.js", ...]
}
```

Current categories (7 total):

| id | Title | Count |
|----|-------|-------|
| skill-languages | Languages | 8 |
| skill-frontend | Frontend | 12 |
| skill-backend | Backend | 8 |
| skill-databases | Databases | 7 |
| skill-cloud | Cloud & DevOps | 8 |
| skill-testing | Testing | 5 |
| skill-tools | Tools & Practices | 9 |

---

## `Project`

```ts
interface Project {
  id: string;
  name: string;
  stack: string[];          // Tech stack chips
  date: string;             // "Jan 2025 – May 2025"
  description: string;      // One-line summary
  points: string[];         // Technical bullet points
  website?: {
    url: string;            // "https://aplifyai.com"
    text: string;           // "aplifyai.com"
  };
  github?: string;          // GitHub URL
}
```

Current projects (3 total):
| id | Name | Period |
|----|------|--------|
| project-1 | AplifyAI | Jan–May 2025 |
| project-2 | Harmony AI | Aug–Dec 2024 |
| project-3 | AI Exam Prep Platform | Mar–Jul 2024 |

---

## `User`

Used in Zustand's auth slice and NextAuth session:

```ts
interface User {
  id: string;
  name: string;
  email: string;
  role: "admin" | "viewer";
}
```

---

## `VisitorEntry`

Stored in `data/visitors.json`, written by `/api/track`:

```ts
interface VisitorEntry {
  id: string;           // UUID
  timestamp: string;    // ISO-8601
  ip: string;
  userAgent: string;
  device: "Desktop" | "Mobile" | "Tablet";
  page: string;
  browser?: string;     // "Chrome 148"
  os?: string;          // "macOS"
  referrer?: string;    // "direct" or hostname
  country?: string;     // ISO code from Vercel headers
  city?: string;
  language?: string;    // "en-US"
  screen?: string;      // "1920x1080"
  timezone?: string;    // "America/New_York"
}
```

---

## `AtsResult`

Returned by `calculateAtsScore()` in `lib/atsScoring.ts`:

```ts
interface AtsResult {
  score: number;        // 0–100
  matched: string[];    // up to 20 matched keywords
  missing: string[];    // up to 20 missing keywords
  label: "high" | "medium" | "low";
}
```

Score thresholds:
- `>= 65` → `"high"` (green)
- `>= 35` → `"medium"` (yellow)
- `< 35` → `"low"` (red)
