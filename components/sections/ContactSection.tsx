import type { PersonalInfo } from "@/types/resume";

interface ContactSectionProps {
  personalInfo: PersonalInfo;
}

export default function ContactSection({ personalInfo }: ContactSectionProps) {
  const { email, phone, linkedin, github } = personalInfo;

  return (
    <section id="contact" className="bg-slate-900 py-24 px-6 text-white">
      <div className="mx-auto max-w-3xl text-center">
        <h2 className="mb-4 text-3xl font-bold tracking-tight sm:text-4xl">
          Get In Touch
        </h2>
        <div className="mx-auto mb-6 h-1 w-16 rounded-full bg-indigo-500" />
        <p className="mb-10 text-slate-400">
          I&apos;m open to new opportunities. Whether you have a question or just want to say hi,
          my inbox is always open.
        </p>

        <div className="mb-10 grid gap-4 sm:grid-cols-2">
          <a
            href={`mailto:${email}`}
            className="flex items-center justify-center gap-3 rounded-lg border border-slate-700 bg-slate-800 px-5 py-4 text-sm font-medium text-slate-300 transition-colors hover:border-indigo-500 hover:text-indigo-400"
          >
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
            </svg>
            {email}
          </a>
          <a
            href={`tel:${phone}`}
            className="flex items-center justify-center gap-3 rounded-lg border border-slate-700 bg-slate-800 px-5 py-4 text-sm font-medium text-slate-300 transition-colors hover:border-indigo-500 hover:text-indigo-400"
          >
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
            </svg>
            {phone}
          </a>
          <a
            href={`https://${linkedin}`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-center gap-3 rounded-lg border border-slate-700 bg-slate-800 px-5 py-4 text-sm font-medium text-slate-300 transition-colors hover:border-indigo-500 hover:text-indigo-400"
          >
            <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 24 24">
              <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
            </svg>
            LinkedIn
          </a>
          <a
            href={`https://${github}`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-center gap-3 rounded-lg border border-slate-700 bg-slate-800 px-5 py-4 text-sm font-medium text-slate-300 transition-colors hover:border-indigo-500 hover:text-indigo-400"
          >
            <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 24 24">
              <path d="M12 0C5.374 0 0 5.373 0 12c0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23A11.509 11.509 0 0112 5.803c1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576C20.566 21.797 24 17.3 24 12c0-6.627-5.373-12-12-12z" />
            </svg>
            GitHub
          </a>
        </div>

        <p className="text-sm text-slate-500">
          © {new Date().getFullYear()} Koundinya Pidaparthy. All rights reserved.
        </p>
      </div>
    </section>
  );
}
