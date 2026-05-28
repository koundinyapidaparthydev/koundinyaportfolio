import type { Project } from "@/types/resume";

interface ProjectsSectionProps {
  projects: Project[];
}

export default function ProjectsSection({ projects }: ProjectsSectionProps) {
  return (
    <section id="projects" className="bg-white py-24 px-6">
      <div className="mx-auto max-w-5xl">
        <h2 className="mb-4 text-center text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">
          Projects
        </h2>
        <div className="mx-auto mb-12 h-1 w-16 rounded-full bg-indigo-600" />

        <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
          {projects.map((project) => (
            <div
              key={project.id}
              className="flex flex-col rounded-xl border border-slate-200 bg-white p-6 shadow-sm transition-shadow hover:shadow-md"
            >
              <div className="mb-3 flex items-start justify-between">
                <h3 className="text-lg font-bold text-slate-900">{project.name}</h3>
                <span className="text-xs text-slate-500 whitespace-nowrap ml-2">{project.date}</span>
              </div>

              <p className="mb-4 text-sm text-slate-600 leading-relaxed">
                {project.description}
              </p>

              <ul className="mb-4 space-y-1.5 flex-1">
                {project.points.map((point, i) => (
                  <li key={i} className="flex items-start gap-2 text-xs text-slate-600">
                    <span className="mt-1.5 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-indigo-400" />
                    {point}
                  </li>
                ))}
              </ul>

              <div className="mt-auto">
                <div className="mb-3 flex flex-wrap gap-1.5">
                  {project.stack.map((tech) => (
                    <span
                      key={tech}
                      className="rounded-full bg-indigo-50 px-2 py-0.5 text-xs font-medium text-indigo-700"
                    >
                      {tech}
                    </span>
                  ))}
                </div>

                <div className="flex gap-3">
                  {project.website && (
                    <a
                      href={project.website.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs font-medium text-indigo-600 hover:underline"
                    >
                      Live Demo →
                    </a>
                  )}
                  {project.github && (
                    <a
                      href={project.github}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs font-medium text-slate-600 hover:underline"
                    >
                      GitHub →
                    </a>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
