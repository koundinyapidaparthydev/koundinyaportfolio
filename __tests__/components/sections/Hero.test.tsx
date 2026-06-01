/**
 * __tests__/components/sections/Hero.test.tsx
 *
 * Unit tests for the Hero section component.
 * Framer Motion and useTypewriter are mocked so we render plain HTML.
 */

// ─── Module mocks ─────────────────────────────────────────────────────────────

// Framer Motion — replace animated components with plain HTML equivalents
jest.mock("framer-motion", () => {
  const React = require("react") as typeof import("react");
  type MotionProps = React.HTMLAttributes<HTMLElement> & { [k: string]: unknown };

  const makeEl =
    (Tag: string) =>
    ({ children, ...rest }: React.PropsWithChildren<MotionProps>) => {
      // Strip Framer-specific props that are not valid HTML attributes
      const {
        initial, animate, exit, transition, variants,
        whileHover, whileTap, whileFocus, whileInView,
        layout, layoutId, drag, dragConstraints, dragElastic,
        onAnimationComplete, onAnimationStart,
        ...htmlProps
      } = rest;
      void initial; void animate; void exit; void transition; void variants;
      void whileHover; void whileTap; void whileFocus; void whileInView;
      void layout; void layoutId; void drag; void dragConstraints; void dragElastic;
      void onAnimationComplete; void onAnimationStart;
      return React.createElement(Tag, htmlProps as React.HTMLAttributes<HTMLElement>, children);
    };

  return {
    __esModule: true,
    motion: {
      h1:  makeEl("h1"),
      h2:  makeEl("h2"),
      h3:  makeEl("h3"),
      div: makeEl("div"),
      p:   makeEl("p"),
      span: makeEl("span"),
      a:   makeEl("a"),
      section: makeEl("section"),
      ul:  makeEl("ul"),
      li:  makeEl("li"),
    },
    AnimatePresence: ({ children }: React.PropsWithChildren) => React.createElement(React.Fragment, null, children),
    useAnimation: () => ({ start: jest.fn(), stop: jest.fn() }),
    useReducedMotion: () => false,
  };
});

// useTypewriter — always return a deterministic string in tests
jest.mock("@/hooks/useTypewriter", () => ({
  useTypewriter: () => "Full-Stack Engineer",
}));

// ─── Imports ──────────────────────────────────────────────────────────────────

import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import Hero from "@/components/sections/Hero";
import type { PersonalInfo } from "@/types/resume";

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const mockPersonalInfo: PersonalInfo = {
  name: "Jane Smith",
  title: "Engineer",
  email: "jane@example.com",
  phone: "555-1234",
  location: "New York, NY",
  linkedin: "linkedin.com/in/jsmith",
  github: "github.com/jsmith",
  summary:
    "An experienced engineer who builds scalable systems. Expert in React and Node.js.",
};

function renderHero(info: PersonalInfo = mockPersonalInfo) {
  return render(<Hero personalInfo={info} />);
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("Hero component", () => {
  // ── Heading ──────────────────────────────────────────────────────────────────

  it("renders the name via aria-label on the heading", () => {
    renderHero();
    expect(screen.getByRole("heading", { name: "Jane Smith" })).toBeInTheDocument();
  });

  it("renders each character of the name as an individual element", () => {
    renderHero();
    // Every non-space letter in the name should appear in the DOM
    const chars = "Jane Smith".replace(/ /g, "");
    const heading = screen.getByRole("heading", { name: "Jane Smith" });
    chars.split("").forEach((char) => {
      expect(heading.textContent?.replace(/\u00A0/g, " ")).toContain(char);
    });
  });

  // ── Typewriter subtitle ───────────────────────────────────────────────────────

  it("renders the typewriter container with aria-live='polite'", () => {
    renderHero();
    const live = screen.getByRole("generic", { name: /role:/i });
    expect(live).toHaveAttribute("aria-live", "polite");
  });

  it("renders the mocked role string from useTypewriter", () => {
    renderHero();
    expect(screen.getByText(/Full-Stack Engineer/)).toBeInTheDocument();
  });

  it("labels the typewriter container with the current role", () => {
    renderHero();
    expect(
      screen.getByRole("generic", { name: "Role: Full-Stack Engineer" })
    ).toBeInTheDocument();
  });

  // ── Bio / summary ─────────────────────────────────────────────────────────────

  it("renders the first sentence of the summary as the bio line", () => {
    renderHero();
    // First sentence ends before the period
    expect(
      screen.getByText(/An experienced engineer who builds scalable systems/i)
    ).toBeInTheDocument();
  });

  it("truncates a long first sentence to 117 chars and appends '…'", () => {
    const longSentence =
      "This is an extremely long first sentence that exceeds one hundred and twenty characters in total length so it must be truncated by the bio calculation logic";
    const altInfo: PersonalInfo = {
      ...mockPersonalInfo,
      summary: longSentence + ". Second sentence.",
    };
    renderHero(altInfo);
    // The rendered bio should end with the ellipsis character
    const bioEl = screen.getByText(/…$/);
    expect(bioEl.textContent).toHaveLength(118); // 117 chars + "…"
  });

  // ── CTA buttons ───────────────────────────────────────────────────────────────

  it("renders the 'View my work' button", () => {
    renderHero();
    expect(screen.getByRole("button", { name: /view my work/i })).toBeInTheDocument();
  });

  it("renders the 'Download resume' link with the correct href", () => {
    renderHero();
    const link = screen.getByRole("link", { name: /download resume/i });
    expect(link).toHaveAttribute("href", "/api/resume/pdf");
  });

  it("renders the download link with the download attribute", () => {
    renderHero();
    const link = screen.getByRole("link", { name: /download resume/i });
    expect(link).toHaveAttribute("download");
  });

  // ── Scroll interaction ────────────────────────────────────────────────────────

  it("calls scrollIntoView when 'View my work' is clicked", () => {
    const mockScrollIntoView = jest.fn();
    const mockProjectsEl = { scrollIntoView: mockScrollIntoView } as unknown as HTMLElement;
    jest.spyOn(document, "getElementById").mockImplementation((id) => {
      if (id === "projects") return mockProjectsEl;
      return null;
    });

    renderHero();
    fireEvent.click(screen.getByRole("button", { name: /view my work/i }));

    expect(document.getElementById).toHaveBeenCalledWith("projects");
    expect(mockScrollIntoView).toHaveBeenCalledWith({ behavior: "smooth" });

    jest.restoreAllMocks();
  });

  it("'Scroll down' aria-label button is in the document", () => {
    renderHero();
    expect(screen.getByRole("button", { name: /scroll down/i })).toBeInTheDocument();
  });

  // ── Accessibility ─────────────────────────────────────────────────────────────

  it("the particle field is aria-hidden", () => {
    renderHero();
    const hidden = document
      .querySelectorAll('[aria-hidden="true"]');
    expect(hidden.length).toBeGreaterThan(0);
  });

  // ── Name prop edge cases ──────────────────────────────────────────────────────

  it("renders a different name when a different personalInfo is passed", () => {
    const altInfo: PersonalInfo = { ...mockPersonalInfo, name: "Alice Wonder" };
    renderHero(altInfo);
    expect(screen.getByRole("heading", { name: "Alice Wonder" })).toBeInTheDocument();
  });

  it("does not throw when 'View my work' is clicked and the projects section is absent", () => {
    // getElementById returns null → optional chain ?.scrollIntoView must not throw
    jest.spyOn(document, "getElementById").mockReturnValue(null);

    renderHero();
    expect(() =>
      fireEvent.click(screen.getByRole("button", { name: /view my work/i }))
    ).not.toThrow();

    jest.restoreAllMocks();
  });
});
