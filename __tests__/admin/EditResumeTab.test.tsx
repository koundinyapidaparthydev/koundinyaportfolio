/**
 * __tests__/admin/EditResumeTab.test.tsx
 *
 * Unit tests for the EditResumeTab admin component covering:
 *  - Loading state rendering
 *  - Form sections rendered
 *  - Action buttons (Save, Undo, Redo, Preview, Export)
 *  - Keyboard shortcuts: Cmd+S / Ctrl+S trigger the mutation
 */

// ─── DnD-Kit stubs ───────────────────────────────────────────────────────────

jest.mock("@dnd-kit/core", () => ({
  DndContext:       ({ children }: { children: React.ReactNode }) => children,
  closestCenter:    jest.fn(),
  KeyboardSensor:   class {},
  PointerSensor:    class {},
  useSensor:        jest.fn(() => ({})),
  useSensors:       jest.fn(() => []),
}));

jest.mock("@dnd-kit/sortable", () => ({
  SortableContext:              ({ children }: { children: React.ReactNode }) => children,
  sortableKeyboardCoordinates: jest.fn(),
  useSortable: () => ({
    attributes: {},
    listeners:  {},
    setNodeRef: jest.fn(),
    transform:  null,
    transition: null,
    isDragging: false,
  }),
  verticalListSortingStrategy: jest.fn(),
  arrayMove:                   jest.fn(),
}));

jest.mock("@dnd-kit/utilities", () => ({
  CSS: { Transform: { toString: () => "" } },
}));

// ─── Zod resolver stub ───────────────────────────────────────────────────────

jest.mock("@hookform/resolvers/zod", () => ({
  zodResolver: () => jest.fn(),
}));

// ─── react-hook-form stub ────────────────────────────────────────────────────

const mockHandleSubmit = jest.fn(
  (fn: (data: Record<string, unknown>) => Promise<void>) =>
    async () =>
      fn({
        personalInfo: {
          name: "Test",
          title: "Dev",
          email: "t@t.com",
          phone: "1",
          location: "NY",
          linkedin: "li",
          github: "gh",
          summary: "summary",
        },
        experience: [],
        projects:   [],
        skills:     [],
        education:  [],
      })
);

jest.mock("react-hook-form", () => ({
  useForm: () => ({
    register:  () => ({ ref: jest.fn(), name: "", onChange: jest.fn(), onBlur: jest.fn() }),
    handleSubmit: mockHandleSubmit,
    control:   {},
    formState: { isDirty: false, errors: {}, isSubmitting: false },
    reset:     jest.fn(),
    getValues: jest.fn(() => ({ experience: [], projects: [], skills: [], education: [] })),
    setValue:  jest.fn(),
  }),
  useFieldArray: () => ({ fields: [], append: jest.fn(), remove: jest.fn(), move: jest.fn() }),
  useWatch:  () => undefined,
  Controller: ({ render }: { render: (p: unknown) => React.ReactNode }) =>
    render({ field: {}, fieldState: {} }),
}));

// ─── Zustand store stubs ─────────────────────────────────────────────────────

const mockPushHistory = jest.fn();

jest.mock("@/lib/store", () => ({
  useResumeHistoryStore: (selector: (s: {
    push: jest.Mock;
    undo: (r: unknown) => null;
    redo: (r: unknown) => null;
  }) => unknown) =>
    selector({ push: mockPushHistory, undo: () => null, redo: () => null }),
  useCanUndo: () => false,
  useCanRedo: () => false,
}));

// ─── useResume hook stubs ─────────────────────────────────────────────────────

const mockMutateAsync = jest.fn().mockResolvedValue({});

const stubResume = {
  personalInfo: {
    name: "Test User",
    title: "Engineer",
    email: "test@test.com",
    phone: "555-0000",
    location: "NY",
    linkedin: "linkedin.com/in/test",
    github: "github.com/test",
    summary: "Summary here.",
  },
  experience: [],
  projects:   [],
  skills:     [],
  education:  [],
};

jest.mock("@/hooks/useResume", () => ({
  useResume:       () => ({ data: stubResume, isLoading: false, isError: false }),
  useUpdateResume: () => ({ mutateAsync: mockMutateAsync, isPending: false }),
}));

// ─── ResumePreview stub ───────────────────────────────────────────────────────

jest.mock(
  "@/app/admin/_components/ResumePreview",
  () => ({ __esModule: true, default: () => <div data-testid="resume-preview" /> })
);

// ─── framer-motion stub ───────────────────────────────────────────────────────

jest.mock("framer-motion", () => {
  const React = require("react") as typeof import("react");
  type P = React.HTMLAttributes<HTMLElement> & { [k: string]: unknown };
  const makeEl = (Tag: string) =>
    ({ children, ...rest }: React.PropsWithChildren<P>) => {
      const { initial, animate, exit, transition, variants, layout, ...hp } = rest;
      void initial; void animate; void exit; void transition; void variants; void layout;
      return React.createElement(Tag, hp as React.HTMLAttributes<HTMLElement>, children);
    };
  return {
    __esModule: true,
    motion:      { div: makeEl("div"), span: makeEl("span"), header: makeEl("header") },
    AnimatePresence: ({ children }: React.PropsWithChildren) =>
      React.createElement(React.Fragment, null, children),
  };
});

// ─── Imports ─────────────────────────────────────────────────────────────────

import React from "react";
import { render, screen, fireEvent, act } from "@testing-library/react";
import EditResumeTab from "@/app/admin/_components/EditResumeTab";

// ─── Tests ───────────────────────────────────────────────────────────────────

describe("EditResumeTab", () => {
  beforeEach(() => jest.clearAllMocks());

  it("renders without crashing", () => {
    const { container } = render(<EditResumeTab />);
    expect(container).toBeTruthy();
  });

  it("renders the main form element", () => {
    render(<EditResumeTab />);
    expect(document.querySelector("form")).toBeTruthy();
  });

  it("renders the Personal Info collapsible section", () => {
    render(<EditResumeTab />);
    expect(screen.getByText(/personal info/i)).toBeTruthy();
  });

  it("renders the Experience collapsible section", () => {
    render(<EditResumeTab />);
    expect(screen.getByText(/experience/i)).toBeTruthy();
  });

  it("renders the Projects collapsible section", () => {
    render(<EditResumeTab />);
    expect(screen.getByText(/projects/i)).toBeTruthy();
  });

  it("renders the Skills collapsible section", () => {
    render(<EditResumeTab />);
    expect(screen.getByText(/^skills$/i)).toBeTruthy();
  });

  it("renders the Education collapsible section", () => {
    render(<EditResumeTab />);
    expect(screen.getByText(/education/i)).toBeTruthy();
  });

  it("renders the Save button in the toolbar", () => {
    render(<EditResumeTab />);
    // The toolbar has a "Save" button. Edits are only persisted on explicit
    // save (click or Cmd+S); there is no auto-save.
    expect(screen.getByRole("button", { name: /^save$/i })).toBeTruthy();
  });

  it("renders the Undo button", () => {
    render(<EditResumeTab />);
    expect(screen.getByRole("button", { name: /undo/i })).toBeTruthy();
  });

  it("renders the Redo button", () => {
    render(<EditResumeTab />);
    expect(screen.getByRole("button", { name: /redo/i })).toBeTruthy();
  });

  it("renders the Export JSON button", () => {
    render(<EditResumeTab />);
    expect(screen.getByRole("button", { name: /export json/i })).toBeTruthy();
  });

  it("renders the Preview toggle button", () => {
    render(<EditResumeTab />);
    // The preview button may show "Preview" or have a title attribute
    const btn = screen.queryByRole("button", { name: /preview/i }) ??
                document.querySelector("[title*='preview' i], button[aria-label*='preview' i]");
    expect(btn ?? screen.getByText(/preview/i)).toBeTruthy();
  });

  it("Cmd+S triggers the mutation (calls mutateAsync)", async () => {
    render(<EditResumeTab />);
    await act(async () => {
      fireEvent.keyDown(window, { metaKey: true, key: "s", bubbles: true });
      // Let all microtasks (async handleSubmit callback) settle
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(mockMutateAsync).toHaveBeenCalled();
  });

  it("Ctrl+S triggers the mutation (calls mutateAsync)", async () => {
    render(<EditResumeTab />);
    await act(async () => {
      fireEvent.keyDown(window, { ctrlKey: true, key: "s", bubbles: true });
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(mockMutateAsync).toHaveBeenCalled();
  });

  it("clicking the Save button triggers the mutation", async () => {
    render(<EditResumeTab />);
    const saveBtn = screen.getByRole("button", { name: /^save$/i });
    await act(async () => {
      fireEvent.click(saveBtn);
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(mockMutateAsync).toHaveBeenCalled();
  });

  it("does not auto-save while typing", () => {
    jest.useFakeTimers();
    render(<EditResumeTab />);
    act(() => {
      jest.advanceTimersByTime(1000);
    });
    expect(mockMutateAsync).not.toHaveBeenCalled();
    jest.useRealTimers();
  });
});
