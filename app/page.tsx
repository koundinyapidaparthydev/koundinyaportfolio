import { resumeData } from "@/data/resume";

export default function Home() {
  const { personalInfo, experience, education, skills, projects } = resumeData;

  return (
    <main className="mx-auto min-h-screen max-w-3xl bg-white px-6 py-12 text-slate-900">
      {/* Header */}
      <header className="mb-8 border-b border-slate-200 pb-8">
        <h1 className="text-3xl font-bold tracking-tight text-slate-950">
          {personalInfo.name}
        </h1>
        <p className="mt-1 text-lg font-medium text-slate-700">
          Software Engineer
        </p>

        <address className="mt-4 not-italic">
          <ul className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-slate-600">
            <li>{personalInfo.location}</li>
            <li>
              <a
                href={`mailto:${personalInfo.email}`}
                className="underline decoration-slate-300 underline-offset-2 hover:text-slate-900"
              >
                {personalInfo.email}
              </a>
            </li>
            <li>
              <a
                href={`tel:${personalInfo.phone.replace(/\D/g, "")}`}
                className="underline decoration-slate-300 underline-offset-2 hover:text-slate-900"
              >
                {personalInfo.phone}
              </a>
            </li>
            <li>
              <a
                href={`https://${personalInfo.linkedin}`}
                target="_blank"
                rel="noopener noreferrer"
                className="underline decoration-slate-300 underline-offset-2 hover:text-slate-900"
              >
                linkedin.com/in/koundinyap
              </a>
            </li>
            <li>
              <a
                href={`https://${personalInfo.github}`}
                target="_blank"
                rel="noopener noreferrer"
                className="underline decoration-slate-300 underline-offset-2 hover:text-slate-900"
              >
                github.com/koundinyapidaparthy2
              </a>
            </li>
          </ul>
        </address>
      </header>

      {/* Summary */}
      <section className="mb-8">
        <h2 className="mb-3 text-lg font-bold uppercase tracking-wide text-slate-950">
          Summary
        </h2>
        <p className="text-sm leading-relaxed text-slate-700">
          {personalInfo.summary}
        </p>
      </section>

      {/* Experience */}
      <section className="mb-8">
        <h2 className="mb-4 text-lg font-bold uppercase tracking-wide text-slate-950">
          Experience
        </h2>
        <ul className="space-y-5">
          {experience.map((exp) => (
            <li key={exp.id}>
              <div className="flex flex-col justify-between gap-1 sm:flex-row sm:items-baseline">
                <h3 className="font-semibold text-slate-900">{exp.role}</h3>
                <span className="text-sm text-slate-500">{exp.date}</span>
              </div>
              <p className="text-sm text-slate-700">
                {exp.companyName} · {exp.location}
              </p>
            </li>
          ))}
        </ul>
      </section>

      {/* Education */}
      <section className="mb-8">
        <h2 className="mb-4 text-lg font-bold uppercase tracking-wide text-slate-950">
          Education
        </h2>
        <ul className="space-y-4">
          {education.map((edu) => (
            <li key={edu.id}>
              <div className="flex flex-col justify-between gap-1 sm:flex-row sm:items-baseline">
                <h3 className="font-semibold text-slate-900">
                  {edu.institution}
                </h3>
                <span className="text-sm text-slate-500">
                  {edu.graduationDate}
                </span>
              </div>
              <p className="text-sm text-slate-700">
                {edu.degree} in {edu.field} · {edu.location}
              </p>
            </li>
          ))}
        </ul>
      </section>

      {/* Skills */}
      <section className="mb-8">
        <h2 className="mb-4 text-lg font-bold uppercase tracking-wide text-slate-950">
          Skills
        </h2>
        <ul className="space-y-2">
          {skills.map((category) => (
            <li key={category.id} className="text-sm text-slate-700">
              <span className="font-semibold text-slate-900">
                {category.title}:
              </span>{" "}
              {category.skills.join(", ")}
            </li>
          ))}
        </ul>
      </section>

      {/* Projects */}
      <section className="mb-8">
        <h2 className="mb-4 text-lg font-bold uppercase tracking-wide text-slate-950">
          Projects
        </h2>
        <ul className="space-y-5">
          {projects.map((project) => (
            <li key={project.id}>
              <div className="flex flex-col justify-between gap-1 sm:flex-row sm:items-baseline">
                <h3 className="font-semibold text-slate-900">
                  {project.name}
                </h3>
                <span className="text-sm text-slate-500">{project.date}</span>
              </div>
              <p className="text-sm text-slate-700">{project.description}</p>
              <p className="mt-1 text-sm text-slate-600">
                <span className="font-medium text-slate-700">Stack:</span>{" "}
                {project.stack.join(", ")}
              </p>
              {project.github && (
                <p className="mt-1 text-sm">
                  <a
                    href={project.github}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="underline decoration-slate-300 underline-offset-2 hover:text-slate-900"
                  >
                    {project.github.replace(/^https:\/\//, "")}
                  </a>
                </p>
              )}
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
}
