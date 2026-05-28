import type { Experience } from "@/types/resume";

interface ExperienceSectionProps {
  experience: Experience[];
}

export default function ExperienceSection({ experience }: ExperienceSectionProps) {
  return (
    <section id="experience" className="bg-slate-50 py-24 px-6">
      <div className="mx-auto max-w-4xl">
        <h2 className="mb-4 text-center text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">
          Experience
        </h2>
        <div className="mx-auto mb-12 h-1 w-16 rounded-full bg-indigo-600" />

        <div className="relative space-y-12">
          {/* Vertical timeline line */}
          <div className="absolute left-4 top-0 h-full w-0.5 bg-slate-200 sm:left-6" />

          {experience.map((job) => (
            <div key={job.id} className="relative pl-12 sm:pl-16">
              {/* Timeline dot */}
              <div className="absolute left-2.5 top-1.5 h-3 w-3 rounded-full border-2 border-indigo-600 bg-white sm:left-4.5" />

              <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
                <div className="mb-1 flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <h3 className="text-lg font-bold text-slate-900">{job.role}</h3>
                    <p className="text-indigo-600 font-medium">{job.companyName}</p>
                  </div>
                  <div className="text-right text-sm text-slate-500">
                    <p>{job.date}</p>
                    <p>{job.location}</p>
                  </div>
                </div>

                <ul className="mt-4 space-y-2">
                  {job.points.map((point, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm text-slate-600">
                      <span className="mt-1.5 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-indigo-400" />
                      {point}
                    </li>
                  ))}
                </ul>

                {job.technologies && (
                  <div className="mt-4 flex flex-wrap gap-2">
                    {job.technologies.map((tech) => (
                      <span
                        key={tech}
                        className="rounded-full bg-indigo-50 px-3 py-1 text-xs font-medium text-indigo-700"
                      >
                        {tech}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
