"use client";

/**
 * EditResumeTab — full resume editor enhanced with:
 *  1. Drag-to-reorder Experience & Project entries  (@dnd-kit/sortable)
 *  2. Auto-save with 500 ms debounce + "Saved" indicator
 *  3. Side-by-side live preview toggle (50/50 split)
 *  4. Undo / Redo — Zustand history store (max 20), Cmd+Z / Cmd+Shift+Z
 *  5. Export JSON — downloads resume_backup.json
 */

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import {
  useForm,
  useFieldArray,
  useWatch,
  type Control,
  type UseFormRegister,
  type FieldErrors,
} from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { useResume, useUpdateResume } from "@/hooks/useResume";
import { useResumeHistoryStore, useCanUndo, useCanRedo } from "@/lib/store";
import ResumePreview from "./ResumePreview";
import type {
  Resume,
  PersonalInfo,
  Experience,
  Project,
  SkillCategory,
  Education,
  OtherRole,
} from "@/types/resume";

// ─── Internal form types ──────────────────────────────────────────────────────
// All string[] fields are wrapped as {value:string}[] for useFieldArray compat.

type SV = { value: string };

interface ExperienceForm
  extends Omit<Experience, "points" | "technologies" | "otherRoles"> {
  points: SV[];
  technologies: SV[];
  otherRoles: Array<Omit<OtherRole, "points"> & { points: SV[] }>;
}

interface ProjectForm extends Omit<Project, "points" | "stack"> {
  points: SV[];
  stack: SV[];
}

interface SkillCategoryForm extends Omit<SkillCategory, "skills"> {
  skills: SV[];
}

interface EducationForm extends Omit<Education, "achievements"> {
  achievements: SV[];
}

interface ResumeFormValues {
  personalInfo: PersonalInfo;
  experience: ExperienceForm[];
  projects: ProjectForm[];
  skills: SkillCategoryForm[];
  education: EducationForm[];
}

// ─── Converters ───────────────────────────────────────────────────────────────

function sv(arr: string[] | undefined): SV[] {
  return (arr ?? []).map((v) => ({ value: v }));
}

function toForm(r: Resume): ResumeFormValues {
  return {
    personalInfo: r.personalInfo,
    experience: r.experience.map((e) => ({
      ...e,
      points: sv(e.points),
      technologies: sv(e.technologies),
      otherRoles: (e.otherRoles ?? []).map((or) => ({
        ...or,
        points: sv(or.points),
      })),
    })),
    projects: r.projects.map((p) => ({
      ...p,
      points: sv(p.points),
      stack: sv(p.stack),
    })),
    skills: r.skills.map((s) => ({ ...s, skills: sv(s.skills) })),
    education: r.education.map((e) => ({ ...e, achievements: sv(e.achievements) })),
  };
}

function fromForm(v: ResumeFormValues): Resume {
  const str = (arr: SV[]): string[] =>
    arr.map((s) => s.value).filter(Boolean);
  return {
    personalInfo: v.personalInfo,
    experience: v.experience.map((e) => ({
      ...e,
      points: str(e.points),
      technologies: str(e.technologies),
      otherRoles: e.otherRoles.map((or) => ({ ...or, points: str(or.points) })),
    })),
    projects: v.projects.map((p) => ({
      ...p,
      points: str(p.points),
      stack: str(p.stack),
    })),
    skills: v.skills.map((s) => ({ ...s, skills: str(s.skills) })),
    education: v.education.map((e) => ({
      ...e,
      achievements: str(e.achievements),
    })),
  };
}

// ─── Shared zod schema (mirrors types/resume.ts) ──────────────────────────────

const SVSchema = z.object({ value: z.string() });

const PersonalInfoSchema = z.object({
  name: z.string().min(1),
  title: z.string().min(1),
  email: z.string().email(),
  phone: z.string().min(1),
  location: z.string().min(1),
  linkedin: z.string().min(1),
  github: z.string().min(1),
  portfolio: z.string().optional(),
  summary: z.string().min(1),
});

const OtherRoleFormSchema = z.object({
  role: z.string().min(1),
  location: z.string().min(1),
  date: z.string().min(1),
  points: z.array(SVSchema),
});

const ExperienceFormSchema = z.object({
  id: z.string().min(1),
  companyName: z.string().min(1),
  role: z.string().min(1),
  location: z.string().min(1),
  date: z.string().min(1),
  startDate: z.string().min(1),
  endDate: z.string().min(1),
  points: z.array(SVSchema),
  technologies: z.array(SVSchema),
  otherRoles: z.array(OtherRoleFormSchema),
});

const ProjectFormSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  stack: z.array(SVSchema),
  date: z.string().min(1),
  description: z.string().min(1),
  points: z.array(SVSchema),
  website: z
    .object({ url: z.string().url(), text: z.string().min(1) })
    .optional(),
  github: z.string().optional(),
  image: z.string().optional(),
});

const SkillCategoryFormSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  skills: z.array(SVSchema),
});

const EducationFormSchema = z.object({
  id: z.string().min(1),
  institution: z.string().min(1),
  degree: z.string().min(1),
  field: z.string().min(1),
  gpa: z.string().optional(),
  graduationDate: z.string().min(1),
  location: z.string().min(1),
  achievements: z.array(SVSchema),
});

const ResumeFormSchema = z.object({
  personalInfo: PersonalInfoSchema,
  experience: z.array(ExperienceFormSchema),
  projects: z.array(ProjectFormSchema),
  skills: z.array(SkillCategoryFormSchema),
  education: z.array(EducationFormSchema),
});

// ─── Shared UI primitives ─────────────────────────────────────────────────────

const inputCls =
  "w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder:text-slate-600 outline-none transition-colors focus:border-indigo-500/70 focus:bg-white/8";
const labelCls = "mb-1 block text-xs font-medium text-slate-500";
const errorCls = "mt-1 text-xs text-red-400";
const sectionHeadCls =
  "text-xs font-semibold uppercase tracking-widest text-slate-600 mb-3";

// ─── Drag handle ─────────────────────────────────────────────────────────────

function DragHandle(props: React.HTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type="button"
      title="Drag to reorder"
      aria-label="Drag handle"
      className="flex h-7 w-6 shrink-0 cursor-grab items-center justify-center rounded text-slate-600 hover:bg-white/8 hover:text-slate-400 active:cursor-grabbing touch-none"
      {...props}
    >
      <svg
        xmlns="http://www.w3.org/2000/svg"
        className="h-4 w-4"
        viewBox="0 0 24 24"
        fill="currentColor"
        aria-hidden="true"
      >
        <circle cx="9" cy="5" r="1.5" />
        <circle cx="15" cy="5" r="1.5" />
        <circle cx="9" cy="12" r="1.5" />
        <circle cx="15" cy="12" r="1.5" />
        <circle cx="9" cy="19" r="1.5" />
        <circle cx="15" cy="19" r="1.5" />
      </svg>
    </button>
  );
}

function Field({
  label,
  error,
  children,
}: {
  label: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className={labelCls}>{label}</label>
      {children}
      {error && <p className={errorCls}>{error}</p>}
    </div>
  );
}

/** Add/Remove buttons for a string-value array */
function StringArrayEditor({
  control,
  name,
  placeholder,
  label,
  register: reg,
}: {
  control: Control<ResumeFormValues>;
  name: string;
  placeholder?: string;
  label: string;
  register: UseFormRegister<ResumeFormValues>;
}) {
  const { fields, append, remove } = useFieldArray({
    control,
    // Dynamic path — cast required for generic component
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    name: name as any,
  });
  return (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <p className={labelCls}>{label}</p>
        <button
          type="button"
          onClick={() => append({ value: "" })}
          className="rounded-md border border-indigo-500/30 bg-indigo-500/10 px-2 py-0.5 text-xs font-medium text-indigo-400 hover:bg-indigo-500/20"
        >
          + Add
        </button>
      </div>
      <div className="space-y-2">
        {fields.map((field, i) => (
          <div key={field.id} className="flex gap-2">
            <input
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              {...reg(`${name}.${i}.value` as any)}
              placeholder={placeholder}
              className={inputCls}
            />
            <button
              type="button"
              onClick={() => remove(i)}
              className="shrink-0 rounded-lg border border-red-500/20 bg-red-500/10 px-2 py-1 text-xs text-red-400 hover:bg-red-500/20"
              aria-label="Remove"
            >
              ✕
            </button>
          </div>
        ))}
        {fields.length === 0 && (
          <p className="text-xs text-slate-700">None yet — click + Add</p>
        )}
      </div>
    </div>
  );
}

// ─── Section: Personal Info ───────────────────────────────────────────────────

function PersonalInfoSection({
  register: reg,
  errors,
}: {
  register: UseFormRegister<ResumeFormValues>;
  errors: FieldErrors<ResumeFormValues>;
}) {
  const pi = errors.personalInfo ?? {};
  return (
    <CollapsibleSection title="Personal Info" defaultOpen>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Full name" error={pi.name?.message}>
          <input {...reg("personalInfo.name")} className={inputCls} />
        </Field>
        <Field label="Title / Role" error={pi.title?.message}>
          <input {...reg("personalInfo.title")} className={inputCls} />
        </Field>
        <Field label="Email" error={pi.email?.message}>
          <input {...reg("personalInfo.email")} type="email" className={inputCls} />
        </Field>
        <Field label="Phone" error={pi.phone?.message}>
          <input {...reg("personalInfo.phone")} className={inputCls} />
        </Field>
        <Field label="Location" error={pi.location?.message}>
          <input {...reg("personalInfo.location")} className={inputCls} />
        </Field>
        <Field label="LinkedIn URL" error={pi.linkedin?.message}>
          <input {...reg("personalInfo.linkedin")} className={inputCls} />
        </Field>
        <Field label="GitHub URL" error={pi.github?.message}>
          <input {...reg("personalInfo.github")} className={inputCls} />
        </Field>
        <Field label="Portfolio URL" error={pi.portfolio?.message}>
          <input {...reg("personalInfo.portfolio")} className={inputCls} />
        </Field>
        <div className="sm:col-span-2">
          <Field label="Summary" error={pi.summary?.message}>
            <textarea {...reg("personalInfo.summary")} rows={3} className={`${inputCls} resize-none`} />
          </Field>
        </div>
      </div>
    </CollapsibleSection>
  );
}

// ─── Section: Experience ──────────────────────────────────────────────────────

function OtherRoleEntry({
  control,
  register: reg,
  expIndex,
  roleIndex,
  onRemove,
}: {
  control: Control<ResumeFormValues>;
  register: UseFormRegister<ResumeFormValues>;
  expIndex: number;
  roleIndex: number;
  onRemove: () => void;
}) {
  return (
    <div className="rounded-xl border border-white/8 bg-black/20 p-4 space-y-3">
      <div className="flex items-center justify-between">
        <p className={sectionHeadCls}>Role {roleIndex + 1}</p>
        <button
          type="button"
          onClick={onRemove}
          className="text-xs text-red-400 hover:text-red-300"
        >
          Remove role
        </button>
      </div>
      <div className="grid gap-3 sm:grid-cols-3">
        <Field label="Role title">
          <input
            {...reg(`experience.${expIndex}.otherRoles.${roleIndex}.role`)}
            className={inputCls}
          />
        </Field>
        <Field label="Location">
          <input
            {...reg(`experience.${expIndex}.otherRoles.${roleIndex}.location`)}
            className={inputCls}
          />
        </Field>
        <Field label="Date range">
          <input
            {...reg(`experience.${expIndex}.otherRoles.${roleIndex}.date`)}
            className={inputCls}
          />
        </Field>
      </div>
      <StringArrayEditor
        control={control}
        name={`experience.${expIndex}.otherRoles.${roleIndex}.points`}
        register={reg}
        label="Bullet points"
        placeholder="Bullet point…"
      />
    </div>
  );
}

function ExperienceEntry({
  control,
  register: reg,
  index,
  onRemove,
  dragHandleProps,
}: {
  control: Control<ResumeFormValues>;
  register: UseFormRegister<ResumeFormValues>;
  index: number;
  onRemove: () => void;
  dragHandleProps?: React.HTMLAttributes<HTMLButtonElement>;
}) {
  const {
    fields: roleFields,
    append: addRole,
    remove: removeRole,
  } = useFieldArray({
    control,
    name: `experience.${index}.otherRoles`,
  });

  const [open, setOpen] = useState(true);

  return (
    <div className="rounded-2xl border border-white/8 bg-white/3 p-5 space-y-4">
      <div className="flex items-center gap-2">
        {dragHandleProps && <DragHandle {...dragHandleProps} />}
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          className="flex flex-1 items-center gap-2 text-left text-sm font-semibold text-slate-300 hover:text-white"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className={`h-3 w-3 transition-transform ${open ? "" : "-rotate-90"}`}
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="3"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="m6 9 6 6 6-6" />
          </svg>
          Experience {index + 1}
        </button>
        <button
          type="button"
          onClick={onRemove}
          className="text-xs text-red-400 hover:text-red-300"
        >
          Remove
        </button>
      </div>

      {open && (
        <>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Company name">
              <input {...reg(`experience.${index}.companyName`)} className={inputCls} />
            </Field>
            <Field label="Role / Title">
              <input {...reg(`experience.${index}.role`)} className={inputCls} />
            </Field>
            <Field label="Location">
              <input {...reg(`experience.${index}.location`)} className={inputCls} />
            </Field>
            <Field label="Display date (e.g. June 2025 – Present)">
              <input {...reg(`experience.${index}.date`)} className={inputCls} />
            </Field>
            <Field label="Start date">
              <input {...reg(`experience.${index}.startDate`)} className={inputCls} />
            </Field>
            <Field label="End date (or Present)">
              <input {...reg(`experience.${index}.endDate`)} className={inputCls} />
            </Field>
          </div>

          <StringArrayEditor
            control={control}
            name={`experience.${index}.points`}
            register={reg}
            label="Bullet points"
            placeholder="Achievement or responsibility…"
          />

          <StringArrayEditor
            control={control}
            name={`experience.${index}.technologies`}
            register={reg}
            label="Technologies"
            placeholder="e.g. React"
          />

          {/* ── Other roles ── */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <p className={sectionHeadCls}>Other roles at this company</p>
              <button
                type="button"
                onClick={() =>
                  addRole({ role: "", location: "", date: "", points: [] })
                }
                className="rounded-md border border-indigo-500/30 bg-indigo-500/10 px-2 py-0.5 text-xs font-medium text-indigo-400 hover:bg-indigo-500/20"
              >
                + Add role
              </button>
            </div>
            <div className="space-y-3">
              {roleFields.map((rf, ri) => (
                <OtherRoleEntry
                  key={rf.id}
                  control={control}
                  register={reg}
                  expIndex={index}
                  roleIndex={ri}
                  onRemove={() => removeRole(ri)}
                />
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

// Sortable wrapper for ExperienceEntry
function SortableExperienceEntry({
  id,
  ...props
}: { id: string } & Omit<React.ComponentProps<typeof ExperienceEntry>, "dragHandleProps">) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id });
  return (
    <div
      ref={setNodeRef}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.45 : 1,
        zIndex: isDragging ? 50 : undefined,
      }}
    >
      <ExperienceEntry {...props} dragHandleProps={{ ...attributes, ...listeners }} />
    </div>
  );
}

function ExperienceSection({
  control,
  register: reg,
}: {
  control: Control<ResumeFormValues>;
  register: UseFormRegister<ResumeFormValues>;
}) {
  const { fields, append, remove, move } = useFieldArray({
    control,
    name: "experience",
  });

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      const oldIdx = fields.findIndex((f) => f.id === active.id);
      const newIdx = fields.findIndex((f) => f.id === over.id);
      move(oldIdx, newIdx);
    }
  };

  return (
    <CollapsibleSection title="Experience">
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={fields.map((f) => f.id)} strategy={verticalListSortingStrategy}>
          <div className="space-y-4">
            {fields.map((f, i) => (
              <SortableExperienceEntry
                key={f.id}
                id={f.id}
                control={control}
                register={reg}
                index={i}
                onRemove={() => remove(i)}
              />
            ))}
          </div>
        </SortableContext>
      </DndContext>
      <button
        type="button"
        onClick={() =>
          append({
            id: `exp-${Date.now()}`,
            companyName: "",
            role: "",
            location: "",
            date: "",
            startDate: "",
            endDate: "",
            points: [],
            technologies: [],
            otherRoles: [],
          })
        }
        className="mt-4 w-full rounded-xl border border-dashed border-white/15 py-3 text-sm text-slate-600 transition-colors hover:border-indigo-500/40 hover:text-indigo-400"
      >
        + Add experience
      </button>
    </CollapsibleSection>
  );
}

// ─── Section: Projects ────────────────────────────────────────────────────────

function ProjectEntry({
  control,
  register: reg,
  index,
  onRemove,
  dragHandleProps,
}: {
  control: Control<ResumeFormValues>;
  register: UseFormRegister<ResumeFormValues>;
  index: number;
  onRemove: () => void;
  dragHandleProps?: React.HTMLAttributes<HTMLButtonElement>;
}) {
  const [open, setOpen] = useState(true);

  return (
    <div className="rounded-2xl border border-white/8 bg-white/3 p-5 space-y-4">
      <div className="flex items-center gap-2">
        {dragHandleProps && <DragHandle {...dragHandleProps} />}
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          className="flex flex-1 items-center gap-2 text-left text-sm font-semibold text-slate-300 hover:text-white"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className={`h-3 w-3 transition-transform ${open ? "" : "-rotate-90"}`}
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="3"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="m6 9 6 6 6-6" />
          </svg>
          Project {index + 1}
        </button>
        <button
          type="button"
          onClick={onRemove}
          className="text-xs text-red-400 hover:text-red-300"
        >
          Remove
        </button>
      </div>

      {open && (
        <>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Project name">
              <input {...reg(`projects.${index}.name`)} className={inputCls} />
            </Field>
            <Field label="Date">
              <input {...reg(`projects.${index}.date`)} className={inputCls} />
            </Field>
            <div className="sm:col-span-2">
              <Field label="Description">
                <textarea
                  {...reg(`projects.${index}.description`)}
                  rows={2}
                  className={`${inputCls} resize-none`}
                />
              </Field>
            </div>
            <Field label="GitHub URL">
              <input {...reg(`projects.${index}.github`)} className={inputCls} placeholder="https://github.com/…" />
            </Field>
            <Field label="Website URL">
              <input {...reg(`projects.${index}.website.url`)} className={inputCls} placeholder="https://…" />
            </Field>
            <Field label="Website link text">
              <input {...reg(`projects.${index}.website.text`)} className={inputCls} placeholder="Live demo" />
            </Field>
          </div>

          <StringArrayEditor
            control={control}
            name={`projects.${index}.stack`}
            register={reg}
            label="Tech stack"
            placeholder="e.g. Next.js"
          />

          <StringArrayEditor
            control={control}
            name={`projects.${index}.points`}
            register={reg}
            label="Bullet points"
            placeholder="Feature or achievement…"
          />
        </>
      )}
    </div>
  );
}

// Sortable wrapper for ProjectEntry
function SortableProjectEntry({
  id,
  ...props
}: { id: string } & Omit<React.ComponentProps<typeof ProjectEntry>, "dragHandleProps">) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id });
  return (
    <div
      ref={setNodeRef}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.45 : 1,
        zIndex: isDragging ? 50 : undefined,
      }}
    >
      <ProjectEntry {...props} dragHandleProps={{ ...attributes, ...listeners }} />
    </div>
  );
}

function ProjectsSection({
  control,
  register: reg,
}: {
  control: Control<ResumeFormValues>;
  register: UseFormRegister<ResumeFormValues>;
}) {
  const { fields, append, remove, move } = useFieldArray({ control, name: "projects" });

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      const oldIdx = fields.findIndex((f) => f.id === active.id);
      const newIdx = fields.findIndex((f) => f.id === over.id);
      move(oldIdx, newIdx);
    }
  };

  return (
    <CollapsibleSection title="Projects">
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={fields.map((f) => f.id)} strategy={verticalListSortingStrategy}>
          <div className="space-y-4">
            {fields.map((f, i) => (
              <SortableProjectEntry
                key={f.id}
                id={f.id}
                control={control}
                register={reg}
                index={i}
                onRemove={() => remove(i)}
              />
            ))}
          </div>
        </SortableContext>
      </DndContext>
      <button
        type="button"
        onClick={() =>
          append({
            id: `proj-${Date.now()}`,
            name: "",
            stack: [],
            date: "",
            description: "",
            points: [],
          })
        }
        className="mt-4 w-full rounded-xl border border-dashed border-white/15 py-3 text-sm text-slate-600 transition-colors hover:border-indigo-500/40 hover:text-indigo-400"
      >
        + Add project
      </button>
    </CollapsibleSection>
  );
}

// ─── Section: Skills ──────────────────────────────────────────────────────────

function SkillCategoryEntry({
  control,
  register: reg,
  index,
  onRemove,
}: {
  control: Control<ResumeFormValues>;
  register: UseFormRegister<ResumeFormValues>;
  index: number;
  onRemove: () => void;
}) {
  return (
    <div className="rounded-xl border border-white/8 bg-white/3 p-4 space-y-3">
      <div className="flex items-center gap-3">
        <input
          {...reg(`skills.${index}.title`)}
          className={`${inputCls} flex-1`}
          placeholder="Category name"
        />
        <button
          type="button"
          onClick={onRemove}
          className="shrink-0 text-xs text-red-400 hover:text-red-300"
        >
          Remove
        </button>
      </div>
      <StringArrayEditor
        control={control}
        name={`skills.${index}.skills`}
        register={reg}
        label="Skills"
        placeholder="e.g. TypeScript"
      />
    </div>
  );
}

function SkillsSection({
  control,
  register: reg,
}: {
  control: Control<ResumeFormValues>;
  register: UseFormRegister<ResumeFormValues>;
}) {
  const { fields, append, remove } = useFieldArray({ control, name: "skills" });

  return (
    <CollapsibleSection title="Skills">
      <div className="space-y-3">
        {fields.map((f, i) => (
          <SkillCategoryEntry
            key={f.id}
            control={control}
            register={reg}
            index={i}
            onRemove={() => remove(i)}
          />
        ))}
        <button
          type="button"
          onClick={() =>
            append({ id: `skill-${Date.now()}`, title: "", skills: [] })
          }
          className="w-full rounded-xl border border-dashed border-white/15 py-3 text-sm text-slate-600 transition-colors hover:border-indigo-500/40 hover:text-indigo-400"
        >
          + Add category
        </button>
      </div>
    </CollapsibleSection>
  );
}

// ─── Section: Education ───────────────────────────────────────────────────────

function EducationEntry({
  control,
  register: reg,
  index,
  onRemove,
}: {
  control: Control<ResumeFormValues>;
  register: UseFormRegister<ResumeFormValues>;
  index: number;
  onRemove: () => void;
}) {
  return (
    <div className="rounded-2xl border border-white/8 bg-white/3 p-5 space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold text-slate-300">
          Education {index + 1}
        </p>
        <button
          type="button"
          onClick={onRemove}
          className="text-xs text-red-400 hover:text-red-300"
        >
          Remove
        </button>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Institution">
          <input
            {...reg(`education.${index}.institution`)}
            className={inputCls}
          />
        </Field>
        <Field label="Degree">
          <input {...reg(`education.${index}.degree`)} className={inputCls} />
        </Field>
        <Field label="Field of study">
          <input {...reg(`education.${index}.field`)} className={inputCls} />
        </Field>
        <Field label="GPA (optional)">
          <input {...reg(`education.${index}.gpa`)} className={inputCls} />
        </Field>
        <Field label="Graduation date">
          <input
            {...reg(`education.${index}.graduationDate`)}
            className={inputCls}
          />
        </Field>
        <Field label="Location">
          <input {...reg(`education.${index}.location`)} className={inputCls} />
        </Field>
      </div>
      <StringArrayEditor
        control={control}
        name={`education.${index}.achievements`}
        register={reg}
        label="Achievements"
        placeholder="Achievement or award…"
      />
    </div>
  );
}

function EducationSection({
  control,
  register: reg,
}: {
  control: Control<ResumeFormValues>;
  register: UseFormRegister<ResumeFormValues>;
}) {
  const { fields, append, remove } = useFieldArray({
    control,
    name: "education",
  });

  return (
    <CollapsibleSection title="Education">
      <div className="space-y-4">
        {fields.map((f, i) => (
          <EducationEntry
            key={f.id}
            control={control}
            register={reg}
            index={i}
            onRemove={() => remove(i)}
          />
        ))}
        <button
          type="button"
          onClick={() =>
            append({
              id: `edu-${Date.now()}`,
              institution: "",
              degree: "",
              field: "",
              graduationDate: "",
              location: "",
              achievements: [],
            })
          }
          className="w-full rounded-xl border border-dashed border-white/15 py-3 text-sm text-slate-600 transition-colors hover:border-indigo-500/40 hover:text-indigo-400"
        >
          + Add education
        </button>
      </div>
    </CollapsibleSection>
  );
}

// ─── Collapsible container ────────────────────────────────────────────────────

function CollapsibleSection({
  title,
  children,
  defaultOpen = false,
}: {
  title: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="rounded-2xl border border-white/8">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between px-5 py-4 text-sm font-semibold text-slate-300 hover:text-white"
      >
        {title}
        <svg
          xmlns="http://www.w3.org/2000/svg"
          className={`h-4 w-4 transition-transform text-slate-600 ${open ? "" : "-rotate-90"}`}
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="m6 9 6 6 6-6" />
        </svg>
      </button>
      {open && <div className="border-t border-white/8 p-5">{children}</div>}
    </div>
  );
}

// ─── Save status indicator ────────────────────────────────────────────────────

type SaveStatus = "idle" | "pending" | "saving" | "saved" | "error";

function SaveIndicator({ status }: { status: SaveStatus }) {
  if (status === "idle") return null;
  const map: Record<Exclude<SaveStatus, "idle">, { cls: string; label: string }> = {
    pending: { cls: "bg-slate-700 text-slate-400", label: "Unsaved…" },
    saving:  { cls: "bg-indigo-500/20 text-indigo-300", label: "Saving…" },
    saved:   { cls: "bg-emerald-500/15 text-emerald-400", label: "✓ Saved" },
    error:   { cls: "bg-red-500/15 text-red-400", label: "⚠ Save failed" },
  };
  const { cls, label } = map[status];
  return (
    <span className={`rounded-full px-2.5 py-0.5 text-[11px] font-medium ${cls}`}>
      {label}
    </span>
  );
}

// ─── Root component ───────────────────────────────────────────────────────────

export default function EditResumeTab() {
  // ── Server data & mutation ──────────────────────────────────────────────────
  const { data: resumeData, isLoading } = useResume();
  const mutation = useUpdateResume();

  // Keep a stable ref to mutateAsync so the auto-save effect doesn't resubscribe
  // every time the mutation status changes (idle → loading → success → idle).
  const mutateRef = useRef(mutation.mutateAsync);
  useLayoutEffect(() => {
    mutateRef.current = mutation.mutateAsync;
  });

  // ── Form ────────────────────────────────────────────────────────────────────
  const {
    control,
    register,
    handleSubmit,
    reset,
    getValues,
    formState: { errors, isDirty, isSubmitting },
  } = useForm<ResumeFormValues>({
    resolver: zodResolver(ResumeFormSchema),
    defaultValues: resumeData ? toForm(resumeData) : undefined,
  });

  // ── History (undo / redo) ───────────────────────────────────────────────────
  const pushHistory  = useResumeHistoryStore((s) => s.push);
  const undoHistory  = useResumeHistoryStore((s) => s.undo);
  const redoHistory  = useResumeHistoryStore((s) => s.redo);
  const canUndo = useCanUndo();
  const canRedo = useCanRedo();

  // ── UI state ────────────────────────────────────────────────────────────────
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("idle");
  const [showPreview, setShowPreview] = useState(false);

  // ── Loop-prevention refs ────────────────────────────────────────────────────
  // isResettingRef   — true while reset() is running → suppresses auto-save
  // lastSavedSerial  — JSON snapshot of last saved form values (loop guard)
  // lastSavedResume  — Resume object of last save (pushed to history before next)
  // debounceTimer    — setTimeout handle for 500 ms debounce
  // isUndoRedoing    — prevents pushing to history during undo/redo
  const isResettingRef     = useRef(false);
  const lastSavedSerialRef = useRef<string>("");
  const lastSavedResumeRef = useRef<Resume | null>(null);
  const debounceTimer      = useRef<ReturnType<typeof setTimeout>>();
  const isUndoRedoingRef   = useRef(false);

  // ── Initialise form from server data ────────────────────────────────────────
  useEffect(() => {
    if (resumeData) {
      const formValues = toForm(resumeData);
      isResettingRef.current = true;
      reset(formValues);
      lastSavedResumeRef.current = resumeData;
      lastSavedSerialRef.current = JSON.stringify(formValues);
      // Turn off flag after watch callbacks have fired
      Promise.resolve().then(() => { isResettingRef.current = false; });
    }
  }, [resumeData, reset]);

  // ── Live-watched values (powers auto-save + live preview) ───────────────────
  const watchedValues = useWatch({ control }) as ResumeFormValues;

  // ── Auto-save: debounced 500 ms ─────────────────────────────────────────────
  // Guard conditions:
  //   • isResettingRef → form is being reset programmatically
  //   • serial match   → values already match last save (prevents post-reset loop)
  useEffect(() => {
    if (isResettingRef.current) return;
    const serial = JSON.stringify(watchedValues);
    if (serial === lastSavedSerialRef.current) return;

    setSaveStatus("pending");

    clearTimeout(debounceTimer.current);
    debounceTimer.current = setTimeout(async () => {
      let resume: Resume;
      try { resume = fromForm(watchedValues); } catch { return; } // skip if form invalid

      if (!isUndoRedoingRef.current && lastSavedResumeRef.current) {
        pushHistory(lastSavedResumeRef.current); // push PREVIOUS state before overwriting
      }

      setSaveStatus("saving");
      try {
        await mutateRef.current(resume);
        lastSavedSerialRef.current = serial;
        lastSavedResumeRef.current = resume;
        setSaveStatus("saved");
        setTimeout(() => setSaveStatus((s) => (s === "saved" ? "idle" : s)), 2500);
      } catch {
        setSaveStatus("error");
      }
    }, 500);

    return () => clearTimeout(debounceTimer.current);
    // pushHistory is a stable Zustand action ref — safe in deps
  }, [watchedValues, pushHistory]);

  // ── Manual save ─────────────────────────────────────────────────────────────
  const onManualSave = handleSubmit(async (values) => {
    const resume = fromForm(values);
    try {
      if (lastSavedResumeRef.current) pushHistory(lastSavedResumeRef.current);
      await mutation.mutateAsync(resume);
      lastSavedResumeRef.current = resume;
      lastSavedSerialRef.current = JSON.stringify(toForm(resume));
      setSaveStatus("saved");
      setTimeout(() => setSaveStatus((s) => (s === "saved" ? "idle" : s)), 2500);
    } catch (err: unknown) {
      setSaveStatus("error");
      console.error("[EditResumeTab] Manual save failed:", err);
    }
  });

  // ── Undo ────────────────────────────────────────────────────────────────────
  const handleUndo = useCallback(() => {
    const current = fromForm(getValues() as ResumeFormValues);
    const prev = undoHistory(current);
    if (prev) {
      isUndoRedoingRef.current = true;
      isResettingRef.current = true;
      const fv = toForm(prev);
      reset(fv);
      lastSavedResumeRef.current = prev;
      lastSavedSerialRef.current = JSON.stringify(fv);
      Promise.resolve().then(() => {
        isResettingRef.current = false;
        isUndoRedoingRef.current = false;
      });
    }
  }, [getValues, undoHistory, reset]);

  // ── Redo ────────────────────────────────────────────────────────────────────
  const handleRedo = useCallback(() => {
    const current = fromForm(getValues() as ResumeFormValues);
    const next = redoHistory(current);
    if (next) {
      isUndoRedoingRef.current = true;
      isResettingRef.current = true;
      const fv = toForm(next);
      reset(fv);
      lastSavedResumeRef.current = next;
      lastSavedSerialRef.current = JSON.stringify(fv);
      Promise.resolve().then(() => {
        isResettingRef.current = false;
        isUndoRedoingRef.current = false;
      });
    }
  }, [getValues, redoHistory, reset]);

  // ── Keyboard shortcuts: Cmd+Z / Cmd+Shift+Z / Ctrl+Y / Cmd+S ─────────────
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const mod = e.metaKey || e.ctrlKey;
      if (!mod) return;
      if (e.key === "z" && !e.shiftKey)              { e.preventDefault(); handleUndo(); }
      else if (e.key === "z" && e.shiftKey)           { e.preventDefault(); handleRedo(); }
      else if (e.key === "y")                          { e.preventDefault(); handleRedo(); }
      else if (e.key === "s")                          { e.preventDefault(); void onManualSave(); }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [handleUndo, handleRedo, onManualSave]);

  // ── Export JSON ─────────────────────────────────────────────────────────────
  const handleExportJSON = useCallback(() => {
    let resume: Resume;
    try { resume = fromForm(getValues() as ResumeFormValues); }
    catch { resume = lastSavedResumeRef.current ?? ({} as Resume); }

    const blob = new Blob([JSON.stringify(resume, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "resume_backup.json";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, [getValues]);

  // ── Derived live preview resume ─────────────────────────────────────────────
  let previewResume: Resume | null = null;
  if (showPreview) {
    try { previewResume = fromForm(watchedValues); }
    catch { previewResume = lastSavedResumeRef.current; }
  }

  // ── Loading ─────────────────────────────────────────────────────────────────
  if (isLoading || !resumeData) {
    return (
      <div className="flex items-center justify-center py-24">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-indigo-500 border-t-transparent" />
      </div>
    );
  }

  // ── Form markup ─────────────────────────────────────────────────────────────
  const formContent = (
    <form onSubmit={onManualSave} noValidate className="space-y-5">
      <PersonalInfoSection register={register} errors={errors} />
      <ExperienceSection control={control} register={register} />
      <ProjectsSection control={control} register={register} />
      <SkillsSection control={control} register={register} />
      <EducationSection control={control} register={register} />

      {isDirty && (
        <div className="sticky bottom-4 z-10 flex items-center justify-between gap-4 rounded-2xl border border-indigo-500/20 bg-indigo-950/80 px-5 py-3 shadow-lg backdrop-blur">
          <p className="text-sm text-indigo-300">You have unsaved changes.</p>
          <button
            type="submit"
            disabled={isSubmitting}
            className="rounded-xl bg-indigo-600 px-5 py-2 text-sm font-semibold text-white transition-all hover:bg-indigo-500 disabled:opacity-50"
          >
            {isSubmitting ? "Saving…" : "Save now"}
          </button>
        </div>
      )}
    </form>
  );

  return (
    <div className="space-y-4">
      {/* ── Toolbar ── */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="mr-auto">
          <h2 className="text-lg font-semibold text-white">Edit Resume</h2>
          <p className="text-xs text-slate-500">Auto-saved every 500 ms · Cmd+Z to undo</p>
        </div>

        <SaveIndicator status={saveStatus} />

        {/* Undo / Redo */}
        <div className="flex items-center gap-1">
          <button
            type="button"
            disabled={!canUndo}
            onClick={handleUndo}
            title="Undo (Cmd+Z)"
            className="rounded-lg border border-white/10 bg-white/5 px-2.5 py-1.5 text-xs font-medium text-slate-400 transition-colors enabled:hover:bg-white/10 enabled:hover:text-white disabled:opacity-30"
          >
            ↩ Undo
          </button>
          <button
            type="button"
            disabled={!canRedo}
            onClick={handleRedo}
            title="Redo (Cmd+Shift+Z)"
            className="rounded-lg border border-white/10 bg-white/5 px-2.5 py-1.5 text-xs font-medium text-slate-400 transition-colors enabled:hover:bg-white/10 enabled:hover:text-white disabled:opacity-30"
          >
            ↪ Redo
          </button>
        </div>

        {/* Split preview toggle */}
        <button
          type="button"
          onClick={() => setShowPreview((p) => !p)}
          className={[
            "flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-medium transition-colors",
            showPreview
              ? "border-indigo-500/40 bg-indigo-500/15 text-indigo-300"
              : "border-white/10 bg-white/5 text-slate-400 hover:bg-white/10 hover:text-white",
          ].join(" ")}
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" viewBox="0 0 24 24"
            fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"
            strokeLinejoin="round" aria-hidden="true">
            <rect width="18" height="18" x="3" y="3" rx="2" />
            <path d="M3 9h18M9 21V9" />
          </svg>
          {showPreview ? "Hide preview" : "Split preview"}
        </button>

        {/* Export JSON */}
        <button
          type="button"
          onClick={handleExportJSON}
          title="Export resume_backup.json"
          className="flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/5 px-2.5 py-1.5 text-xs font-medium text-slate-400 transition-colors hover:bg-white/10 hover:text-white"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" viewBox="0 0 24 24"
            fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"
            strokeLinejoin="round" aria-hidden="true">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
            <polyline points="7 10 12 15 17 10" />
            <line x1="12" x2="12" y1="15" y2="3" />
          </svg>
          Export JSON
        </button>

        {/* Live site */}
        <a href="/" target="_blank" rel="noopener noreferrer"
          className="flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/5 px-2.5 py-1.5 text-xs font-medium text-slate-400 transition-colors hover:bg-white/10 hover:text-white"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" viewBox="0 0 24 24"
            fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"
            strokeLinejoin="round" aria-hidden="true">
            <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
            <polyline points="15 3 21 3 21 9" />
            <line x1="10" x2="21" y1="14" y2="3" />
          </svg>
          Live site ↗
        </a>

        {/* Manual save */}
        <button
          type="button"
          onClick={() => void onManualSave()}
          disabled={isSubmitting}
          className="rounded-xl bg-indigo-600 px-4 py-1.5 text-sm font-semibold text-white shadow-lg shadow-indigo-500/20 transition-all hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isSubmitting ? "Saving…" : "Save"}
        </button>
      </div>

      {/* ── Main layout (form + optional live preview) ── */}
      {showPreview ? (
        <div className="flex h-[calc(100vh-14rem)] gap-4 overflow-hidden">
          {/* Left: edit form */}
          <div className="w-1/2 overflow-y-auto pr-1">{formContent}</div>
          {/* Right: live preview */}
          <div className="w-1/2 overflow-hidden rounded-2xl border border-white/10 shadow-2xl">
            {previewResume ? (
              <ResumePreview resume={previewResume} />
            ) : (
              <div className="flex h-full items-center justify-center bg-white/5">
                <p className="text-xs text-slate-600">Preview unavailable</p>
              </div>
            )}
          </div>
        </div>
      ) : (
        formContent
      )}
    </div>
  );
}

