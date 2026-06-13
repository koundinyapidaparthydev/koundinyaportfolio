import type { PersonalInfo } from "@/types/resume";

interface HeroSectionProps {
  personalInfo: PersonalInfo;
}

export default function HeroSection({ personalInfo }: HeroSectionProps) {
  const { name, email, phone, linkedin, github } = personalInfo;

  return (
    <section
      id="hero"
      className="relative flex min-h-screen items-center justify-center bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 px-6 text-white"
    >
      <div className="mx-auto max-w-4xl text-center">
        <h1 className="mb-6 text-5xl font-bold tracking-tight sm:text-7xl">
          {name}
        </h1>

        <div className="mb-10 flex flex-wrap items-center justify-center gap-4 text-sm text-slate-300">
          <a href={`mailto:${email}`} className="hover:text-indigo-400 transition-colors">
            {email}
          </a>
          <span className="text-slate-600">|</span>
          <a href={`tel:${phone}`} className="hover:text-indigo-400 transition-colors">
            {phone}
          </a>
          <span className="text-slate-600">|</span>
          <a
            href={`https://${linkedin}`}
            target="_blank"
            rel="noopener noreferrer"
            className="hover:text-indigo-400 transition-colors"
          >
            LinkedIn
          </a>
          <span className="text-slate-600">|</span>
          <a
            href={`https://${github}`}
            target="_blank"
            rel="noopener noreferrer"
            className="hover:text-indigo-400 transition-colors"
          >
            GitHub
          </a>
        </div>

        <div className="flex flex-wrap justify-center gap-4">
          <a
            href="#experience"
            className="rounded-lg bg-indigo-600 px-6 py-3 text-sm font-semibold text-white shadow-lg transition-all hover:bg-indigo-500 hover:shadow-indigo-500/25"
          >
            View Experience
          </a>
          <a
            href="#contact"
            className="rounded-lg border border-slate-600 px-6 py-3 text-sm font-semibold text-slate-300 transition-all hover:border-indigo-400 hover:text-indigo-400"
          >
            Contact Me
          </a>
        </div>
      </div>

      {/* Scroll indicator */}
      <div className="absolute bottom-8 left-1/2 -translate-x-1/2 animate-bounce">
        <svg
          className="h-6 w-6 text-slate-500"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M19 9l-7 7-7-7"
          />
        </svg>
      </div>
    </section>
  );
}
