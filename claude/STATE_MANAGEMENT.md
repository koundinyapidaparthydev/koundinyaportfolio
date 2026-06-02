# State Management

## Overview

Client state is managed with **Zustand v5** using three middleware layers:

```
devtools → persist → immer
```

- **devtools**: exposes the store to Redux DevTools browser extension
- **persist**: serialises a subset of state to `localStorage`
- **immer**: allows direct mutation syntax inside `set()` callbacks

---

## The Root Store (`lib/store.ts`)

Two slices compose the root store:

### Auth Slice

```ts
interface AuthSlice {
  isAdmin: boolean;
  user: User | null;
  isLoading: boolean;

  login(email: string, password: string): Promise<void>;
  logout(): void;
  setUser(user: User | null): void;
}
```

**Persistence**: `user` and `isAdmin` are persisted to `localStorage` under key `kp-portfolio-store`.

**`login()`** — currently wraps a 500ms mock delay and sets a hardcoded admin user. In production it delegates to NextAuth `signIn`.

**`setUser()`** — called by `StoreHydrator` on mount to sync the NextAuth JWT session into Zustand.

### Resume Slice

```ts
interface ResumeSlice {
  resume: Resume;
  isEditing: boolean;
  isDirty: boolean;

  updatePersonalInfo(info: Partial<PersonalInfo>): void;
  updateExperience(experience: Experience[]): void;
  updateEducation(education: Education[]): void;
  updateSkills(skills: SkillCategory[]): void;
  updateProjects(projects: Project[]): void;
  updateResume(partial: Partial<Resume>): void;
  setIsEditing(editing: boolean): void;
  resetToSaved(): void;
}
```

**Not persisted** — seeded from `data/resume.ts` on every page load via `StoreHydrator`.

`isDirty` tracks whether the admin has unsaved changes (used to show a "save" prompt or prevent navigation).

---

## Selector Hooks

All selectors are memoised by Zustand's built-in shallow comparison.

```ts
// Auth
useIsAdmin()         → boolean
useCurrentUser()     → User | null
useAuthLoading()     → boolean
useLogin()           → (email, password) => Promise<void>
useLogout()          → () => void

// Resume reads
useResume()          → Resume
usePersonalInfo()    → PersonalInfo
useExperience()      → Experience[]
useEducation()       → Education[]
useSkills()          → SkillCategory[]
useProjects()        → Project[]
useIsEditing()       → boolean
useIsDirty()         → boolean

// Resume writes
useUpdatePersonalInfo()  → (info: Partial<PersonalInfo>) => void
useUpdateExperience()    → (exp: Experience[]) => void
useUpdateEducation()     → (edu: Education[]) => void
useUpdateSkills()        → (skills: SkillCategory[]) => void
useUpdateProjects()      → (projects: Project[]) => void
useSetIsEditing()        → (editing: boolean) => void
useResetToSaved()        → () => void
```

---

## Undo / Redo Store (`useResumeHistoryStore`)

A **separate** Zustand store (not persisted) manages undo/redo history:

```ts
interface ResumeHistoryStore {
  past: Resume[];    // up to 20 snapshots
  future: Resume[];

  push(prev: Resume): void;  // call BEFORE mutating
  undo(current: Resume): Resume | null;
  redo(current: Resume): Resume | null;
  clear(): void;
}
```

**Usage pattern** in admin editor:
```ts
const push = useResumeHistoryStore(s => s.push);

// Before any mutation:
push(currentResume);
updateExperience(newExperience);
```

Helper selectors:
```ts
useCanUndo()  → boolean
useCanRedo()  → boolean
```

---

## Resume Store (`lib/resumeStore.ts`)

A lightweight auxiliary store used outside the main `useStore` — e.g., for tracking which resume variant is active in the PDF preview or AI tailoring flow.

---

## Visitor Store (`lib/visitorStore.ts`)

**Server-side only** — never imported in client components.

Manages reading/writing `data/visitors.json`:

```ts
appendVisitor(data): Promise<void>   // prepends entry, caps at 500
getVisitors(): Promise<VisitorEntry[]>  // reads all entries
```

Also exports browser/OS detection helpers:
```ts
detectBrowser(ua: string): string   // e.g. "Chrome 148"
detectOS(ua: string): string        // e.g. "macOS"
```
