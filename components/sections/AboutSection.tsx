import type { PersonalInfo } from "@/types/resume";

interface AboutSectionProps {
  personalInfo: PersonalInfo;
}

export default function AboutSection({ personalInfo }: AboutSectionProps) {
  return (
    <section id="about" className="bg-white py-24 px-6">
      <div className="mx-auto max-w-3xl text-center">
        <h2 className="mb-4 text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">
          About Me
        </h2>
        <div className="mx-auto mb-6 h-1 w-16 rounded-full bg-indigo-600" />
        <p className="text-lg leading-relaxed text-slate-600">
          {personalInfo.summary}
        </p>
        <p className="mt-4 text-base text-slate-500">
          Based in {personalInfo.location}
        </p>
      </div>
    </section>
  );
}
