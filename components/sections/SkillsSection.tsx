import type { SkillCategory } from "@/types/resume";

interface SkillsSectionProps {
  skills: SkillCategory[];
}

export default function SkillsSection({ skills }: SkillsSectionProps) {
  return (
    <section id="skills" className="bg-slate-50 py-24 px-6">
      <div className="mx-auto max-w-5xl">
        <h2 className="mb-4 text-center text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">
          Technical Skills
        </h2>
        <div className="mx-auto mb-12 h-1 w-16 rounded-full bg-indigo-600" />

        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {skills.map((category) => (
            <div
              key={category.id}
              className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm"
            >
              <h3 className="mb-3 text-sm font-bold uppercase tracking-wider text-indigo-600">
                {category.title}
              </h3>
              <div className="flex flex-wrap gap-2">
                {category.skills.map((skill) => (
                  <span
                    key={skill}
                    className="rounded-md bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-700"
                  >
                    {skill}
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
