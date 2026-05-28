import { z } from "zod";

// ─── Zod schemas mirroring types/resume.ts ────────────────────────────────────

export const PersonalInfoSchema = z.object({
  name: z.string().min(1, "Name is required"),
  title: z.string().min(1, "Title is required"),
  email: z.string().email("Valid email required"),
  phone: z.string().min(1, "Phone is required"),
  location: z.string().min(1, "Location is required"),
  linkedin: z.string().min(1, "LinkedIn URL is required"),
  github: z.string().min(1, "GitHub URL is required"),
  portfolio: z.string().optional(),
  summary: z.string().min(1, "Summary is required"),
});

export const EducationSchema = z.object({
  id: z.string().min(1),
  institution: z.string().min(1),
  degree: z.string().min(1),
  field: z.string().min(1),
  gpa: z.string().optional(),
  graduationDate: z.string().min(1),
  location: z.string().min(1),
  achievements: z.array(z.string()).optional(),
});

export const OtherRoleSchema = z.object({
  role: z.string().min(1),
  location: z.string().min(1),
  date: z.string().min(1),
  points: z.array(z.string()),
});

export const ExperienceSchema = z.object({
  id: z.string().min(1),
  companyName: z.string().min(1),
  role: z.string().min(1),
  location: z.string().min(1),
  date: z.string().min(1),
  startDate: z.string().min(1),
  endDate: z.string().min(1),
  points: z.array(z.string()),
  otherRoles: z.array(OtherRoleSchema).optional(),
  technologies: z.array(z.string()).optional(),
});

export const SkillCategorySchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  skills: z.array(z.string()),
});

export const ProjectWebsiteSchema = z.object({
  url: z.string().url("Must be a valid URL"),
  text: z.string().min(1),
});

export const ProjectSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  stack: z.array(z.string()),
  date: z.string().min(1),
  description: z.string().min(1),
  points: z.array(z.string()),
  website: ProjectWebsiteSchema.optional(),
  github: z.string().optional(),
  image: z.string().optional(),
});

export const ResumeSchema = z.object({
  personalInfo: PersonalInfoSchema,
  education: z.array(EducationSchema),
  experience: z.array(ExperienceSchema),
  skills: z.array(SkillCategorySchema),
  projects: z.array(ProjectSchema),
});

export type ResumeInput = z.infer<typeof ResumeSchema>;
