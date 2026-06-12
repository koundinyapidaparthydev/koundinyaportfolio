import type { Resume } from "@/types/resume";
import { RESUME_DOWNLOAD_FILENAME } from "@/lib/resumeDownload";

export type ChatMessage = {
  role: "user" | "assistant";
  content: string;
};

export const GEMINI_CHAT_MODEL =
  process.env.GEMINI_MODEL ?? "gemini-3.1-flash-lite";

const MAX_CONTEXT_CHARS = 12_000;
const MAX_HISTORY_MESSAGES = 12;

export function buildPortfolioContext(resume: Resume): string {
  const { personalInfo, skills, experience, projects, education } = resume;

  const payload = {
    name: personalInfo.name,
    title: personalInfo.title,
    location: personalInfo.location,
    email: personalInfo.email,
    linkedin: personalInfo.linkedin,
    github: personalInfo.github,
    portfolio: personalInfo.portfolio,
    summary: personalInfo.summary,
    education: education.map((e) => ({
      institution: e.institution,
      degree: `${e.degree} in ${e.field}`,
      graduationDate: e.graduationDate,
      gpa: e.gpa,
      achievements: e.achievements,
    })),
    experience: experience.map((e) => ({
      company: e.companyName,
      role: e.role,
      dates: `${e.startDate} – ${e.endDate}`,
      location: e.location,
      technologies: e.technologies,
      highlights: e.points,
    })),
    skills: skills.map((c) => ({ category: c.title, skills: c.skills })),
    projects: projects.map((p) => ({
      name: p.name,
      date: p.date,
      stack: p.stack,
      description: p.description,
      highlights: p.points,
      website: p.website?.url,
      github: p.github,
    })),
  };

  return JSON.stringify(payload, null, 2).slice(0, MAX_CONTEXT_CHARS);
}

export function buildPortfolioSystemPrompt(context: string): string {
  return `You are the portfolio assistant on Koundinya Pidaparthy's personal website.
Answer questions about his background, skills, projects, experience, education, and resume using ONLY the portfolio context below.
Be concise (2–4 short paragraphs max), friendly, and professional.
If asked about hiring, availability, or contact, mention he is open to work and suggest the Contact section or email ${context.includes("koundinyapidaparthy@gmail.com") ? "koundinyapidaparthy@gmail.com" : "via the site contact form"}.
If you do not know something from the context, say so — do not invent employers, projects, or credentials.
For resume downloads, mention the Resume button in the header downloads ${RESUME_DOWNLOAD_FILENAME}.

Portfolio context:
${context}`;
}

export function trimChatHistory(messages: ChatMessage[]): ChatMessage[] {
  return messages
    .filter((m) => m.content.trim().length > 0)
    .slice(-MAX_HISTORY_MESSAGES);
}

export async function generatePortfolioChatReply(
  messages: ChatMessage[],
  context: string
): Promise<string> {
  const apiKey = process.env.GEMINI_API_KEY?.trim();
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY is not configured");
  }

  const history = trimChatHistory(messages);
  const systemPrompt = buildPortfolioSystemPrompt(context);

  const contents = [
    { role: "user", parts: [{ text: systemPrompt }] },
    {
      role: "model",
      parts: [
        {
          text: "Understood. I will answer only from the portfolio context and keep replies concise.",
        },
      ],
    },
    ...history.map((m) => ({
      role: m.role === "user" ? "user" : "model",
      parts: [{ text: m.content }],
    })),
  ];

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_CHAT_MODEL}:generateContent?key=${apiKey}`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents,
      generationConfig: {
        temperature: 0.35,
        maxOutputTokens: 512,
      },
    }),
    signal: AbortSignal.timeout(25_000),
  });

  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(`Gemini request failed (${res.status}): ${detail.slice(0, 200)}`);
  }

  const data = (await res.json()) as {
    candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
  };

  const text = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
  if (!text) {
    throw new Error("Empty response from Gemini");
  }

  return text;
}
