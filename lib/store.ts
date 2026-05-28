import { create } from "zustand";
import { devtools, persist } from "zustand/middleware";
import { immer } from "zustand/middleware/immer";
import type {
  AuthSlice,
  ResumeSlice,
  User,
  PersonalInfo,
  Experience,
  Education,
  SkillCategory,
  Project,
  Resume,
} from "@/types/resume";
import { resumeData } from "@/data/resume";

// ─── Auth Slice ───────────────────────────────────────────────────────────────

type AuthState = Omit<AuthSlice, "login" | "logout" | "setUser">;

const authInitialState: AuthState = {
  isAdmin: false,
  user: null,
  isLoading: false,
};

const createAuthSlice = (
  set: (fn: (state: AuthState) => void) => void
): AuthSlice => ({
  ...authInitialState,

  login: async (email: string, password: string) => {
    void password; // validated by NextAuth in production; placeholder here
    set((state) => {
      state.isLoading = true;
    });
    try {
      // Replace with real auth call (next-auth signIn) in production
      await new Promise((resolve) => setTimeout(resolve, 500));
      const user: User = {
        id: "admin-1",
        name: "Koundinya Pidaparthy",
        email,
        role: "admin",
      };
      set((state) => {
        state.user = user;
        state.isAdmin = true;
        state.isLoading = false;
      });
    } catch {
      set((state) => {
        state.isLoading = false;
      });
      throw new Error("Login failed");
    }
  },

  logout: () => {
    set((state) => {
      state.user = null;
      state.isAdmin = false;
    });
  },

  setUser: (user: User | null) => {
    set((state) => {
      state.user = user;
      state.isAdmin = user?.role === "admin";
    });
  },
});

// ─── Resume Slice ─────────────────────────────────────────────────────────────

type ResumeState = Omit<
  ResumeSlice,
  | "updatePersonalInfo"
  | "updateExperience"
  | "updateEducation"
  | "updateSkills"
  | "updateProjects"
  | "updateResume"
  | "setIsEditing"
  | "resetToSaved"
>;

const resumeInitialState: ResumeState = {
  resume: resumeData,
  isEditing: false,
  isDirty: false,
};

const createResumeSlice = (
  set: (fn: (state: ResumeState) => void) => void
): ResumeSlice => ({
  ...resumeInitialState,

  updatePersonalInfo: (info: Partial<PersonalInfo>) => {
    set((state) => {
      state.resume.personalInfo = { ...state.resume.personalInfo, ...info };
      state.isDirty = true;
    });
  },

  updateExperience: (experience: Experience[]) => {
    set((state) => {
      state.resume.experience = experience;
      state.isDirty = true;
    });
  },

  updateEducation: (education: Education[]) => {
    set((state) => {
      state.resume.education = education;
      state.isDirty = true;
    });
  },

  updateSkills: (skills: SkillCategory[]) => {
    set((state) => {
      state.resume.skills = skills;
      state.isDirty = true;
    });
  },

  updateProjects: (projects: Project[]) => {
    set((state) => {
      state.resume.projects = projects;
      state.isDirty = true;
    });
  },

  updateResume: (partial: Partial<Resume>) => {
    set((state) => {
      state.resume = { ...state.resume, ...partial };
      state.isDirty = true;
    });
  },

  setIsEditing: (editing: boolean) => {
    set((state) => {
      state.isEditing = editing;
    });
  },

  resetToSaved: () => {
    set((state) => {
      state.resume = resumeData;
      state.isEditing = false;
      state.isDirty = false;
    });
  },
});

// ─── Root Store ───────────────────────────────────────────────────────────────

type StoreState = AuthState & ResumeState;
type StoreActions = Omit<AuthSlice, keyof AuthState> &
  Omit<ResumeSlice, keyof ResumeState>;
type Store = StoreState & StoreActions;

export const useStore = create<Store>()(
  devtools(
    persist(
      immer((set) => ({
        // Auth slice
        ...createAuthSlice(set as unknown as (fn: (s: AuthState) => void) => void),
        // Resume slice
        ...createResumeSlice(set as unknown as (fn: (s: ResumeState) => void) => void),
      })),
      {
        name: "kp-portfolio-store",
        partialize: (state) => ({
          // Only persist auth state; resume data is always seeded from source
          user: state.user,
          isAdmin: state.isAdmin,
        }),
      }
    ),
    { name: "KP Portfolio Store" }
  )
);

// ─── Selector Hooks ───────────────────────────────────────────────────────────

// Auth selectors
export const useIsAdmin = () => useStore((s) => s.isAdmin);
export const useCurrentUser = () => useStore((s) => s.user);
export const useAuthLoading = () => useStore((s) => s.isLoading);
export const useLogin = () => useStore((s) => s.login);
export const useLogout = () => useStore((s) => s.logout);

// Resume selectors
export const useResume = () => useStore((s) => s.resume);
export const usePersonalInfo = () => useStore((s) => s.resume.personalInfo);
export const useExperience = () => useStore((s) => s.resume.experience);
export const useEducation = () => useStore((s) => s.resume.education);
export const useSkills = () => useStore((s) => s.resume.skills);
export const useProjects = () => useStore((s) => s.resume.projects);
export const useIsEditing = () => useStore((s) => s.isEditing);
export const useIsDirty = () => useStore((s) => s.isDirty);

// Resume actions
export const useUpdatePersonalInfo = () =>
  useStore((s) => s.updatePersonalInfo);
export const useUpdateExperience = () => useStore((s) => s.updateExperience);
export const useUpdateEducation = () => useStore((s) => s.updateEducation);
export const useUpdateSkills = () => useStore((s) => s.updateSkills);
export const useUpdateProjects = () => useStore((s) => s.updateProjects);
export const useSetIsEditing = () => useStore((s) => s.setIsEditing);
export const useResetToSaved = () => useStore((s) => s.resetToSaved);

// ─── Resume History Store (undo / redo) ───────────────────────────────────────
// Stored separately so it never gets persisted to localStorage and stays
// scoped to the browser session.

const MAX_HISTORY = 20;

interface ResumeHistoryState {
  past: Resume[];
  future: Resume[];
}

interface ResumeHistoryActions {
  /** Call BEFORE mutating — records the pre-change snapshot. */
  push: (prev: Resume) => void;
  /** Undo: returns the state to restore, or null if nothing to undo. */
  undo: (current: Resume) => Resume | null;
  /** Redo: returns the state to restore, or null if nothing to redo. */
  redo: (current: Resume) => Resume | null;
  /** Clear all history (e.g. on new page load). */
  clear: () => void;
}

type ResumeHistoryStore = ResumeHistoryState & ResumeHistoryActions;

export const useResumeHistoryStore = create<ResumeHistoryStore>()(
  immer((set, get) => ({
    past: [],
    future: [],

    push: (prev: Resume) => {
      set((state) => {
        state.past = [prev, ...state.past].slice(0, MAX_HISTORY);
        state.future = []; // new change clears redo stack
      });
    },

    undo: (current: Resume) => {
      const { past } = get();
      if (past.length === 0) return null;
      const [prev, ...restPast] = past;
      set((state) => {
        state.past = restPast;
        state.future = [current, ...state.future];
      });
      return prev;
    },

    redo: (current: Resume) => {
      const { future } = get();
      if (future.length === 0) return null;
      const [next, ...restFuture] = future;
      set((state) => {
        state.past = [current, ...state.past];
        state.future = restFuture;
      });
      return next;
    },

    clear: () => {
      set((state) => {
        state.past = [];
        state.future = [];
      });
    },
  }))
);

export const useCanUndo = () =>
  useResumeHistoryStore((s) => s.past.length > 0);
export const useCanRedo = () =>
  useResumeHistoryStore((s) => s.future.length > 0);
