import type { Education } from "@/types/resume";

interface EducationSectionProps {
  education: Education[];
}

export default function EducationSection({ education }: EducationSectionProps) {
  return (
    <section id="education" className="bg-white py-24 px-6 dark:bg-[#0a0a0a]">
      <div className="mx-auto max-w-4xl">
        <h2 className="mb-4 text-center text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl dark:text-white">
          Education
        </h2>
        <div className="mx-auto mb-12 h-1 w-16 rounded-full bg-indigo-600" />

        <div className="grid gap-6 sm:grid-cols-2">
          {education.map((edu) => (
            <div
              key={edu.id}
              className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm dark:border-white/8 dark:bg-[#111]"
            >
              <div className="mb-2 flex items-start justify-between gap-2">
                <h3 className="text-base font-bold text-slate-900">{edu.institution}</h3>
                <span className="text-sm text-slate-500 whitespace-nowrap">{edu.graduationDate}</span>
              </div>
              <p className="text-indigo-600 font-medium text-sm">
                {edu.degree} in {edu.field}
              </p>
              <p className="mt-1 text-sm text-slate-500">{edu.location}</p>
              {edu.gpa && (
                <p className="mt-2 text-sm font-medium text-slate-700">
                  GPA: <span className="text-indigo-600">{edu.gpa}</span>
                </p>
              )}
              {edu.achievements && (
                <ul className="mt-3 space-y-1">
                  {edu.achievements.map((a, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm text-slate-600">
                      <span className="mt-1.5 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-indigo-400" />
                      {a}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
