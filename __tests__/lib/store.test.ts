/**
 * __tests__/lib/store.test.ts
 *
 * Unit tests for the Zustand store defined in lib/store.ts.
 * Exercises auth and resume slices without rendering React components.
 */

// ─── Zustand store reset helper ───────────────────────────────────────────────
// We need to reset the store between tests so state doesn't leak.
// The `persist` middleware writes to localStorage; we reset that too.

beforeEach(() => {
  localStorage.clear();
});

// ─── Imports ──────────────────────────────────────────────────────────────────

import { act, renderHook } from "@testing-library/react";
import {
  useStore,
  useResumeHistoryStore,
  useIsAdmin,
  useCurrentUser,
  useAuthLoading,
  useLogin,
  useLogout,
  useResume,
  usePersonalInfo,
  useExperience,
  useEducation,
  useSkills,
  useProjects,
  useIsEditing,
  useIsDirty,
  useUpdatePersonalInfo,
  useUpdateExperience,
  useUpdateEducation,
  useUpdateSkills,
  useUpdateProjects,
  useSetIsEditing,
  useResetToSaved,
  useCanUndo,
  useCanRedo,
} from "@/lib/store";
import { resumeData } from "@/data/resume";
import type { User } from "@/types/resume";

// Helper: grab a fresh snapshot of the store state (no subscription)
function snapshot() {
  return useStore.getState();
}

// Fully reset store state between tests so nothing leaks across cases
afterEach(() => {
  // Partial merge — resets all state properties without touching actions
  useStore.setState({
    isAdmin: false,
    user: null,
    isLoading: false,
    resume: resumeData,
    isEditing: false,
    isDirty: false,
  });
});

// ─── Auth slice ───────────────────────────────────────────────────────────────

describe("Auth slice — initial state", () => {
  it("starts with isAdmin = false", () => {
    expect(snapshot().isAdmin).toBe(false);
  });

  it("starts with user = null", () => {
    expect(snapshot().user).toBeNull();
  });

  it("starts with isLoading = false", () => {
    expect(snapshot().isLoading).toBe(false);
  });
});

describe("Auth slice — setUser()", () => {
  it("sets user and marks isAdmin = true for role 'admin'", () => {
    const adminUser: User = { id: "1", name: "Admin", email: "a@b.com", role: "admin" };
    act(() => snapshot().setUser(adminUser));

    expect(snapshot().user).toEqual(adminUser);
    expect(snapshot().isAdmin).toBe(true);
  });

  it("sets user and keeps isAdmin = false for role 'viewer'", () => {
    const viewerUser: User = { id: "2", name: "Viewer", email: "v@b.com", role: "viewer" };
    act(() => snapshot().setUser(viewerUser));

    expect(snapshot().user).toEqual(viewerUser);
    expect(snapshot().isAdmin).toBe(false);
  });

  it("clears user and sets isAdmin = false when called with null", () => {
    // First set a user, then clear
    act(() => snapshot().setUser({ id: "1", name: "Admin", email: "a@b.com", role: "admin" }));
    act(() => snapshot().setUser(null));

    expect(snapshot().user).toBeNull();
    expect(snapshot().isAdmin).toBe(false);
  });
});

describe("Auth slice — logout()", () => {
  it("clears user and removes admin rights", () => {
    act(() => snapshot().setUser({ id: "1", name: "Admin", email: "a@b.com", role: "admin" }));
    act(() => snapshot().logout());

    expect(snapshot().user).toBeNull();
    expect(snapshot().isAdmin).toBe(false);
  });
});

describe("Auth slice — login()", () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  it("resolves with isAdmin = true and a user with the given email", async () => {
    const loginPromise = snapshot().login("admin@test.com", "secret");
    // Flush the 500 ms simulated delay
    await act(async () => {
      jest.advanceTimersByTime(600);
      await loginPromise;
    });

    expect(snapshot().isAdmin).toBe(true);
    expect(snapshot().user?.email).toBe("admin@test.com");
    expect(snapshot().isLoading).toBe(false);
  });

  it("sets isLoading = true while the async operation runs", async () => {
    const loginPromise = snapshot().login("admin@test.com", "secret");

    // Before the timer fires isLoading should still be true
    act(() => jest.advanceTimersByTime(100));
    expect(snapshot().isLoading).toBe(true);

    await act(async () => {
      jest.advanceTimersByTime(600);
      await loginPromise;
    });
    expect(snapshot().isLoading).toBe(false);
  });
});

// ─── Resume slice ─────────────────────────────────────────────────────────────

describe("Resume slice — initial state", () => {
  it("seeds resume from resumeData", () => {
    expect(snapshot().resume.personalInfo.name).toBe(resumeData.personalInfo.name);
  });

  it("starts with isEditing = false", () => {
    expect(snapshot().isEditing).toBe(false);
  });

  it("starts with isDirty = false", () => {
    expect(snapshot().isDirty).toBe(false);
  });
});

describe("Resume slice — updatePersonalInfo()", () => {
  it("merges updated fields and marks isDirty = true", () => {
    act(() => snapshot().updatePersonalInfo({ name: "New Name" }));

    expect(snapshot().resume.personalInfo.name).toBe("New Name");
    expect(snapshot().isDirty).toBe(true);
  });

  it("preserves untouched personalInfo fields", () => {
    const originalEmail = snapshot().resume.personalInfo.email;
    act(() => snapshot().updatePersonalInfo({ name: "Changed" }));

    expect(snapshot().resume.personalInfo.email).toBe(originalEmail);
  });
});

describe("Resume slice — updateExperience()", () => {
  const newExp = [
    {
      id: "exp-test",
      companyName: "Acme",
      role: "Engineer",
      location: "NY",
      date: "2023",
      startDate: "2023-01",
      endDate: "Present",
      points: ["Did stuff"],
    },
  ];

  it("replaces the experience array", () => {
    act(() => snapshot().updateExperience(newExp));
    expect(snapshot().resume.experience).toEqual(newExp);
  });

  it("marks isDirty = true", () => {
    act(() => snapshot().updateExperience(newExp));
    expect(snapshot().isDirty).toBe(true);
  });
});

describe("Resume slice — updateSkills()", () => {
  it("replaces the skills array and marks isDirty", () => {
    const skills = [{ id: "s1", title: "Backend", skills: ["Node.js"] }];
    act(() => snapshot().updateSkills(skills));

    expect(snapshot().resume.skills).toEqual(skills);
    expect(snapshot().isDirty).toBe(true);
  });
});

describe("Resume slice — updateProjects()", () => {
  it("replaces the projects array and marks isDirty", () => {
    const projects = [
      {
        id: "p1",
        name: "Test Project",
        description: "A test.",
        stack: ["React"],
        date: "2024",
        points: [],
      },
    ];
    act(() => snapshot().updateProjects(projects));

    expect(snapshot().resume.projects).toEqual(projects);
    expect(snapshot().isDirty).toBe(true);
  });
});

describe("Resume slice — setIsEditing()", () => {
  it("sets isEditing to true", () => {
    act(() => snapshot().setIsEditing(true));
    expect(snapshot().isEditing).toBe(true);
  });

  it("sets isEditing back to false", () => {
    act(() => snapshot().setIsEditing(true));
    act(() => snapshot().setIsEditing(false));
    expect(snapshot().isEditing).toBe(false);
  });
});

describe("Resume slice — resetToSaved()", () => {
  it("restores resume to the seed data", () => {
    act(() => snapshot().updatePersonalInfo({ name: "Temp Name" }));
    act(() => snapshot().resetToSaved());

    expect(snapshot().resume.personalInfo.name).toBe(resumeData.personalInfo.name);
  });

  it("resets isDirty to false", () => {
    act(() => snapshot().updatePersonalInfo({ name: "Temp" }));
    expect(snapshot().isDirty).toBe(true);

    act(() => snapshot().resetToSaved());
    expect(snapshot().isDirty).toBe(false);
  });

  it("resets isEditing to false", () => {
    act(() => snapshot().setIsEditing(true));
    act(() => snapshot().resetToSaved());
    expect(snapshot().isEditing).toBe(false);
  });
});

describe("Resume slice — updateResume()", () => {
  it("partially merges the resume and marks isDirty", () => {
    const partial = { education: [] };
    act(() => snapshot().updateResume(partial));

    expect(snapshot().resume.education).toEqual([]);
    expect(snapshot().isDirty).toBe(true);
  });
});

describe("Resume slice — updateEducation()", () => {
  it("replaces the education array and marks isDirty", () => {
    const edu = [
      {
        id: "edu-test",
        institution: "Test Uni",
        degree: "B.S.",
        field: "CS",
        graduationDate: "2024",
        location: "NYC",
      },
    ];
    act(() => snapshot().updateEducation(edu));

    expect(snapshot().resume.education).toEqual(edu);
    expect(snapshot().isDirty).toBe(true);
  });
});

// ─── Auth slice — login() error path ─────────────────────────────────────────

describe("Auth slice — login() error path", () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  it("sets isLoading = false and rethrows on unexpected error", async () => {
    // Briefly override setTimeout to simulate a failure inside login
    const original = global.setTimeout;
    // @ts-expect-error — replace setTimeout to throw immediately
    global.setTimeout = (fn: () => void) => { throw new Error("timer failure"); };

    await expect(
      act(async () => { await snapshot().login("x@x.com", "pass"); })
    ).rejects.toThrow();

    global.setTimeout = original;
    // State should have isLoading reset to false
    expect(snapshot().isLoading).toBe(false);
  });
});

// ─── Selector hooks ───────────────────────────────────────────────────────────
// Each hook is just a one-liner; calling them covers the function.

describe("Selector hooks — Auth", () => {
  it("useIsAdmin returns isAdmin from store", () => {
    const { result } = renderHook(() => useIsAdmin());
    expect(result.current).toBe(false);
  });

  it("useCurrentUser returns user from store", () => {
    const { result } = renderHook(() => useCurrentUser());
    expect(result.current).toBeNull();
  });

  it("useAuthLoading returns isLoading from store", () => {
    const { result } = renderHook(() => useAuthLoading());
    expect(result.current).toBe(false);
  });

  it("useLogin returns the login function", () => {
    const { result } = renderHook(() => useLogin());
    expect(typeof result.current).toBe("function");
  });

  it("useLogout returns the logout function", () => {
    const { result } = renderHook(() => useLogout());
    expect(typeof result.current).toBe("function");
  });
});

describe("Selector hooks — Resume read", () => {
  it("useResume returns the resume object", () => {
    const { result } = renderHook(() => useResume());
    expect(result.current).toBeDefined();
    expect(result.current.personalInfo).toBeDefined();
  });

  it("usePersonalInfo returns personalInfo", () => {
    const { result } = renderHook(() => usePersonalInfo());
    expect(result.current.name).toBe(resumeData.personalInfo.name);
  });

  it("useExperience returns experience array", () => {
    const { result } = renderHook(() => useExperience());
    expect(Array.isArray(result.current)).toBe(true);
  });

  it("useEducation returns education array", () => {
    const { result } = renderHook(() => useEducation());
    expect(Array.isArray(result.current)).toBe(true);
  });

  it("useSkills returns skills array", () => {
    const { result } = renderHook(() => useSkills());
    expect(Array.isArray(result.current)).toBe(true);
  });

  it("useProjects returns projects array", () => {
    const { result } = renderHook(() => useProjects());
    expect(Array.isArray(result.current)).toBe(true);
  });

  it("useIsEditing returns isEditing", () => {
    const { result } = renderHook(() => useIsEditing());
    expect(result.current).toBe(false);
  });

  it("useIsDirty returns isDirty", () => {
    const { result } = renderHook(() => useIsDirty());
    expect(result.current).toBe(false);
  });
});

describe("Selector hooks — Resume actions", () => {
  it("useUpdatePersonalInfo returns a function", () => {
    const { result } = renderHook(() => useUpdatePersonalInfo());
    expect(typeof result.current).toBe("function");
  });

  it("useUpdateExperience returns a function", () => {
    const { result } = renderHook(() => useUpdateExperience());
    expect(typeof result.current).toBe("function");
  });

  it("useUpdateEducation returns a function", () => {
    const { result } = renderHook(() => useUpdateEducation());
    expect(typeof result.current).toBe("function");
  });

  it("useUpdateSkills returns a function", () => {
    const { result } = renderHook(() => useUpdateSkills());
    expect(typeof result.current).toBe("function");
  });

  it("useUpdateProjects returns a function", () => {
    const { result } = renderHook(() => useUpdateProjects());
    expect(typeof result.current).toBe("function");
  });

  it("useSetIsEditing returns a function", () => {
    const { result } = renderHook(() => useSetIsEditing());
    expect(typeof result.current).toBe("function");
  });

  it("useResetToSaved returns a function", () => {
    const { result } = renderHook(() => useResetToSaved());
    expect(typeof result.current).toBe("function");
  });
});

// ─── useResumeHistoryStore ─────────────────────────────────────────────────────

describe("useResumeHistoryStore", () => {
  function histSnap() {
    return useResumeHistoryStore.getState();
  }

  afterEach(() => {
    useResumeHistoryStore.setState({ past: [], future: [] });
  });

  it("initialises with empty past and future", () => {
    expect(histSnap().past).toEqual([]);
    expect(histSnap().future).toEqual([]);
  });

  it("push() prepends to past and clears future", () => {
    act(() => histSnap().push(resumeData));
    expect(histSnap().past).toHaveLength(1);
    expect(histSnap().future).toHaveLength(0);
  });

  it("push() multiple times keeps most-recent first", () => {
    const v2 = { ...resumeData, personalInfo: { ...resumeData.personalInfo, name: "v2" } };
    act(() => histSnap().push(resumeData));
    act(() => histSnap().push(v2));
    expect(histSnap().past[0]).toEqual(v2);
    expect(histSnap().past[1]).toEqual(resumeData);
  });

  it("undo() returns the top of past and moves current to future", () => {
    act(() => histSnap().push(resumeData));

    const current = { ...resumeData, personalInfo: { ...resumeData.personalInfo, name: "After" } };
    const restored = histSnap().undo(current);

    expect(restored).toEqual(resumeData);
    expect(histSnap().past).toHaveLength(0);
    expect(histSnap().future).toHaveLength(1);
    expect(histSnap().future[0]).toEqual(current);
  });

  it("undo() returns null when past is empty", () => {
    const result = histSnap().undo(resumeData);
    expect(result).toBeNull();
  });

  it("redo() returns the top of future and moves current to past", () => {
    act(() => histSnap().push(resumeData));
    const current = { ...resumeData, personalInfo: { ...resumeData.personalInfo, name: "After" } };
    histSnap().undo(current);   // moves resumeData→past, current→future

    const redone = histSnap().redo(resumeData);

    expect(redone).toEqual(current);
    expect(histSnap().past).toHaveLength(1);
    expect(histSnap().future).toHaveLength(0);
  });

  it("redo() returns null when future is empty", () => {
    const result = histSnap().redo(resumeData);
    expect(result).toBeNull();
  });

  it("clear() empties both past and future", () => {
    act(() => histSnap().push(resumeData));
    act(() => histSnap().clear());
    expect(histSnap().past).toHaveLength(0);
    expect(histSnap().future).toHaveLength(0);
  });
});

describe("useCanUndo / useCanRedo selectors", () => {
  afterEach(() => {
    useResumeHistoryStore.setState({ past: [], future: [] });
  });

  it("useCanUndo returns false when past is empty", () => {
    const { result } = renderHook(() => useCanUndo());
    expect(result.current).toBe(false);
  });

  it("useCanUndo returns true after a push", () => {
    act(() => useResumeHistoryStore.getState().push(resumeData));
    const { result } = renderHook(() => useCanUndo());
    expect(result.current).toBe(true);
  });

  it("useCanRedo returns false when future is empty", () => {
    const { result } = renderHook(() => useCanRedo());
    expect(result.current).toBe(false);
  });

  it("useCanRedo returns true after an undo", () => {
    act(() => useResumeHistoryStore.getState().push(resumeData));
    const current = { ...resumeData, personalInfo: { ...resumeData.personalInfo, name: "X" } };
    act(() => { useResumeHistoryStore.getState().undo(current); });
    const { result } = renderHook(() => useCanRedo());
    expect(result.current).toBe(true);
  });
});

