// ─── Personal Info ────────────────────────────────────────────────────────────

export interface PersonalInfo {
  name: string;
  title: string;
  email: string;
  phone: string;
  location: string;
  linkedin: string;
  github: string;
  portfolio?: string;
  summary: string;
}

// ─── Education ────────────────────────────────────────────────────────────────

export interface Education {
  id: string;
  institution: string;
  degree: string;
  field: string;
  gpa?: string;
  graduationDate: string;
  location: string;
  achievements?: string[];
}

// ─── Work Experience ──────────────────────────────────────────────────────────

export interface OtherRole {
  role: string;
  location: string;
  date: string;
  points: string[];
}

export interface Experience {
  id: string;
  companyName: string;
  role: string;
  location: string;
  date: string;
  startDate: string;
  endDate: string | "Present";
  points: string[];
  otherRoles?: OtherRole[];
  technologies?: string[];
}

// ─── Skills ───────────────────────────────────────────────────────────────────

export interface SkillCategory {
  id: string;
  title: string;
  skills: string[];
}

// ─── Projects ─────────────────────────────────────────────────────────────────

export interface ProjectWebsite {
  url: string;
  text: string;
}

export interface Project {
  id: string;
  name: string;
  stack: string[];
  date: string;
  description: string;
  points: string[];
  website?: ProjectWebsite;
  github?: string;
  image?: string;
}

// ─── Full Resume ──────────────────────────────────────────────────────────────

export interface Resume {
  personalInfo: PersonalInfo;
  education: Education[];
  experience: Experience[];
  skills: SkillCategory[];
  projects: Project[];
}

// ─── Auth ─────────────────────────────────────────────────────────────────────

export interface User {
  id: string;
  name: string;
  email: string;
  role: "admin" | "viewer";
}

// ─── Contact Form ─────────────────────────────────────────────────────────────

export interface ContactFormData {
  name: string;
  email: string;
  subject: string;
  message: string;
}

// ─── Store Slices ─────────────────────────────────────────────────────────────

export interface AuthSlice {
  isAdmin: boolean;
  user: User | null;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
  setUser: (user: User | null) => void;
}

export interface ResumeSlice {
  resume: Resume;
  isEditing: boolean;
  isDirty: boolean;
  updatePersonalInfo: (info: Partial<PersonalInfo>) => void;
  updateExperience: (experience: Experience[]) => void;
  updateEducation: (education: Education[]) => void;
  updateSkills: (skills: SkillCategory[]) => void;
  updateProjects: (projects: Project[]) => void;
  updateResume: (resume: Partial<Resume>) => void;
  setIsEditing: (editing: boolean) => void;
  resetToSaved: () => void;
}

export type RootStore = AuthSlice & ResumeSlice;
