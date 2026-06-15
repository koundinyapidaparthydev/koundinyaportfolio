"use client";

/**
 * ResumePreview — white-background document view of the resume.
 * Used in the side-by-side split preview mode of the admin editor.
 * Receives a live Resume object and renders it synchronously.
 */

import type { Resume, Experience, Project, SkillCategory, Education } from "@/types/resume";

// ─── Sub-components ───────────────────────────────────────────────────────────

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <div className="mt-5 mb-2 border-b-2 border-slate-800 pb-0.5">
      <h2 className="text-[11px] font-bold uppercase tracking-[0.12em] text-slate-800">
        {children}
      </h2>
    </div>
  );
}

function ExperienceBlock({ exp }: { exp: Experience }) {
  return (
    <div className="mb-3">
      <div className="flex items-baseline justify-between gap-2">
        <span className="font-bold text-slate-900 text-[12px]">{exp.companyName}</span>
        <span className="shrink-0 text-[10px] text-slate-500">{exp.date}</span>
      </div>
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-[11px] italic text-slate-600">{exp.role}</span>
        <span className="shrink-0 text-[10px] text-slate-500">{exp.location}</span>
      </div>
      {exp.points.length > 0 && (
        <ul className="mt-1 ml-3 space-y-0.5 list-disc">
          {exp.points.map((pt, i) => (
            <li key={i} className="text-[10.5px] text-slate-700 leading-relaxed">
              {pt}
            </li>
          ))}
        </ul>
      )}
      {exp.otherRoles?.map((role, i) => (
        <div key={i} className="mt-2 ml-1">
          <div className="flex items-baseline justify-between gap-2">
            <span className="text-[11px] italic text-slate-600">{role.role}</span>
            <span className="shrink-0 text-[10px] text-slate-500">{role.date}</span>
          </div>
          {role.points.length > 0 && (
            <ul className="mt-1 ml-3 space-y-0.5 list-disc">
              {role.points.map((pt, j) => (
                <li key={j} className="text-[10.5px] text-slate-700 leading-relaxed">
                  {pt}
                </li>
              ))}
            </ul>
          )}
        </div>
      ))}
      {exp.technologies && exp.technologies.length > 0 && (
        <p className="mt-1 text-[10px] text-slate-500">
          <span className="font-semibold">Tech:</span>{" "}
          {exp.technologies.join(" · ")}
        </p>
      )}
    </div>
  );
}

function ProjectBlock({ project }: { project: Project }) {
  return (
    <div className="mb-3">
      <div className="flex items-baseline justify-between gap-2">
        <span className="font-bold text-slate-900 text-[12px]">{project.name}</span>
        <span className="shrink-0 text-[10px] text-slate-500">{project.date}</span>
      </div>
      {project.stack.length > 0 && (
        <p className="text-[10px] text-slate-500">
          {project.stack.join(" · ")}
        </p>
      )}
      {project.description && (
        <p className="mt-0.5 text-[10.5px] text-slate-700 leading-relaxed">
          {project.description}
        </p>
      )}
      {project.points.length > 0 && (
        <ul className="mt-1 ml-3 space-y-0.5 list-disc">
          {project.points.map((pt, i) => (
            <li key={i} className="text-[10.5px] text-slate-700 leading-relaxed">
              {pt}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function SkillsBlock({ category }: { category: SkillCategory }) {
  return (
    <div className="mb-1 flex items-baseline gap-2">
      <span className="shrink-0 text-[11px] font-bold text-slate-800">
        {category.title}:
      </span>
      <span className="text-[10.5px] text-slate-700">
        {category.skills.join(", ")}
      </span>
    </div>
  );
}

function EducationBlock({ edu }: { edu: Education }) {
  return (
    <div className="mb-2">
      <div className="flex items-baseline justify-between gap-2">
        <span className="font-bold text-slate-900 text-[12px]">
          {edu.institution}
        </span>
        <span className="shrink-0 text-[10px] text-slate-500">
          {edu.graduationDate}
        </span>
      </div>
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-[11px] text-slate-600">
          {edu.degree} in {edu.field}
          {edu.gpa ? ` · GPA: ${edu.gpa}` : ""}
        </span>
        <span className="shrink-0 text-[10px] text-slate-500">
          {edu.location}
        </span>
      </div>
      {edu.achievements && edu.achievements.length > 0 && (
        <ul className="mt-1 ml-3 space-y-0.5 list-disc">
          {edu.achievements.map((a, i) => (
            <li key={i} className="text-[10.5px] text-slate-700">
              {a}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// ─── Main preview ─────────────────────────────────────────────────────────────

export default function ResumePreview({ resume }: { resume: Resume }) {
  const { personalInfo, experience, projects, skills, education } = resume;

  return (
    <div className="h-full overflow-y-auto bg-white px-8 py-8 text-slate-900 shadow-xl">
      {/* Header — name + contact only (no rule under summary) */}
      <header className="mb-3 text-center">
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">
          {personalInfo.name}
        </h1>
        {personalInfo.title ? (
          <p className="mt-0.5 text-sm font-medium text-slate-600">
            {personalInfo.title}
          </p>
        ) : null}
        <div className="mt-2 flex flex-wrap items-center justify-center gap-x-3 gap-y-1 text-[10.5px] text-slate-500">
          {personalInfo.email && <span>{personalInfo.email}</span>}
          {personalInfo.phone && <span>·</span>}
          {personalInfo.phone && <span>{personalInfo.phone}</span>}
          {personalInfo.location && <span>·</span>}
          {personalInfo.location && <span>{personalInfo.location}</span>}
          {personalInfo.linkedin && <span>·</span>}
          {personalInfo.linkedin && <span>{personalInfo.linkedin}</span>}
          {personalInfo.github && <span>·</span>}
          {personalInfo.github && <span>{personalInfo.github}</span>}
        </div>
      </header>
      {personalInfo.summary && (
        <p className="mb-4 w-full text-[10.5px] font-bold leading-relaxed text-slate-800 text-justify">
          {personalInfo.summary}
        </p>
      )}

      {/* Experience */}
      {experience.length > 0 && (
        <section>
          <SectionTitle>Experience</SectionTitle>
          {experience.map((exp) => (
            <ExperienceBlock key={exp.id} exp={exp} />
          ))}
        </section>
      )}

      {/* Projects */}
      {projects.length > 0 && (
        <section>
          <SectionTitle>Projects</SectionTitle>
          {projects.map((proj) => (
            <ProjectBlock key={proj.id} project={proj} />
          ))}
        </section>
      )}

      {/* Skills */}
      {skills.length > 0 && (
        <section>
          <SectionTitle>Skills</SectionTitle>
          {skills.map((cat) => (
            <SkillsBlock key={cat.id} category={cat} />
          ))}
        </section>
      )}

      {/* Education */}
      {education.length > 0 && (
        <section>
          <SectionTitle>Education</SectionTitle>
          {education.map((edu) => (
            <EducationBlock key={edu.id} edu={edu} />
          ))}
        </section>
      )}
    </div>
  );
}
