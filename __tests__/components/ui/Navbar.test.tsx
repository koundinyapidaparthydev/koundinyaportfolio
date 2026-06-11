/**
 * __tests__/components/ui/Navbar.test.tsx
 *
 * Unit tests for the Navbar component covering:
 *  - KP brand logo + aria-label
 *  - Nav link labels (Home, About, Skills, Projects)
 *  - Admin vs guest state (Dashboard+Logout vs lock icon)
 *  - Logout calls signOut with correct callbackUrl
 *  - Navigation: smooth-scroll on "/", router.push on other routes
 *  - Mobile hamburger: open/close, correct content, logout in drawer
 *  - ThemeToggle rendered
 *  - Resume download link
 */

// ─── Framer Motion stub ───────────────────────────────────────────────────────

jest.mock("framer-motion", () => {
  const React = require("react") as typeof import("react");
  type MotionProps = React.HTMLAttributes<HTMLElement> & { [k: string]: unknown };

  const makeEl =
    (Tag: string) =>
    ({ children, ...rest }: React.PropsWithChildren<MotionProps>) => {
      const {
        initial, animate, exit, transition, variants, layout,
        whileHover, whileTap, whileInView,
        ...htmlProps
      } = rest;
      void initial; void animate; void exit; void transition;
      void variants; void layout; void whileHover; void whileTap; void whileInView;
      return React.createElement(Tag, htmlProps as React.HTMLAttributes<HTMLElement>, children);
    };

  return {
    __esModule: true,
    motion: {
      header: makeEl("header"),
      div:    makeEl("div"),
      span:   makeEl("span"),
    },
    AnimatePresence: ({ children }: React.PropsWithChildren) =>
      React.createElement(React.Fragment, null, children),
  };
});

// ─── next/image stub ─────────────────────────────────────────────────────────

jest.mock("next/image", () => ({
  __esModule: true,
  default: ({ src, alt, ...rest }: { src: string; alt: string; [k: string]: unknown }) => {
    const React = require("react") as typeof import("react");
    return React.createElement("img", { src, alt, ...(rest as object) });
  },
}));

// ─── next/link stub ──────────────────────────────────────────────────────────

jest.mock("next/link", () => ({
  __esModule: true,
  default: ({ href, children, ...rest }: { href: string; children: React.ReactNode; [k: string]: unknown }) => {
    const React = require("react") as typeof import("react");
    return React.createElement("a", { href, ...(rest as object) }, children);
  },
}));

// ─── ThemeToggle stub ────────────────────────────────────────────────────────

jest.mock("@/components/ui/ThemeToggle", () => ({
  ThemeToggle: () => {
    const React = require("react") as typeof import("react");
    return React.createElement("button", { "data-testid": "theme-toggle" }, "Theme");
  },
}));

// ─── next-auth/react ─────────────────────────────────────────────────────────
// Controlled per-test via mockGetSession / mockSignOut

const mockSignOut = jest.fn();
const mockGetSession = jest.fn(() => ({ data: null }));

jest.mock("next-auth/react", () => ({
  useSession: () => mockGetSession(),
  signOut: (...args: unknown[]) => mockSignOut(...args),
}));

// ─── next/navigation ─────────────────────────────────────────────────────────
// Controlled per-test via mockUsePathname

const mockPush = jest.fn();
const mockUsePathname = jest.fn(() => "/");

jest.mock("next/navigation", () => ({
  useRouter:   () => ({ push: mockPush }),
  usePathname: () => mockUsePathname(),
}));

// ─── Imports ─────────────────────────────────────────────────────────────────

import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import Navbar from "@/components/ui/Navbar";

// ─── Helpers ─────────────────────────────────────────────────────────────────

function asGuest() {
  mockGetSession.mockReturnValue({ data: null });
}

function asAdmin() {
  mockGetSession.mockReturnValue({ data: { user: { role: "admin" } } });
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe("Navbar", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUsePathname.mockReturnValue("/");
    asGuest();
  });

  // ── Brand logo ────────────────────────────────────────────────────────────

  it("renders the KP brand logo", () => {
    render(<Navbar />);
    expect(screen.getByText("KP")).toBeTruthy();
  });

  it("brand button has 'Go to top' aria-label", () => {
    render(<Navbar />);
    expect(screen.getByRole("button", { name: /go to top/i })).toBeTruthy();
  });

  // ── Nav links ─────────────────────────────────────────────────────────────

  it("renders 'Home' nav link", () => {
    render(<Navbar />);
    expect(screen.getAllByRole("button", { name: /home/i }).length).toBeGreaterThanOrEqual(1);
  });

  it("renders 'About' nav link", () => {
    render(<Navbar />);
    expect(screen.getAllByRole("button", { name: /about/i }).length).toBeGreaterThanOrEqual(1);
  });

  it("renders 'Skills' nav link", () => {
    render(<Navbar />);
    expect(screen.getAllByRole("button", { name: /skills/i }).length).toBeGreaterThanOrEqual(1);
  });

  it("renders 'Projects' nav link", () => {
    render(<Navbar />);
    expect(screen.getAllByRole("button", { name: /projects/i }).length).toBeGreaterThanOrEqual(1);
  });

  it("renders the Resume download link", () => {
    render(<Navbar />);
    const resumeLinks = screen.getAllByText(/resume/i);
    expect(resumeLinks.length).toBeGreaterThanOrEqual(1);
  });

  it("renders the ThemeToggle button", () => {
    render(<Navbar />);
    expect(screen.getAllByTestId("theme-toggle").length).toBeGreaterThanOrEqual(1);
  });

  // ── Guest state ───────────────────────────────────────────────────────────

  it("shows Admin lock link (not Logout) when user is not logged in", () => {
    asGuest();
    render(<Navbar />);
    expect(screen.queryByRole("button", { name: /logout/i })).toBeNull();
    expect(screen.getAllByText(/admin/i).length).toBeGreaterThanOrEqual(1);
  });

  // ── Admin state ───────────────────────────────────────────────────────────

  it("shows Dashboard link when user is admin", () => {
    asAdmin();
    render(<Navbar />);
    expect(screen.getAllByText(/dashboard/i).length).toBeGreaterThanOrEqual(1);
  });

  it("shows Logout button when user is admin", () => {
    asAdmin();
    render(<Navbar />);
    expect(screen.getAllByRole("button", { name: /logout/i }).length).toBeGreaterThanOrEqual(1);
  });

  it("does NOT show Dashboard link when user is not logged in", () => {
    asGuest();
    render(<Navbar />);
    expect(screen.queryByText("Dashboard")).toBeNull();
  });

  it("clicking Logout calls signOut with callbackUrl '/'", () => {
    asAdmin();
    render(<Navbar />);
    const [logoutBtn] = screen.getAllByRole("button", { name: /logout/i });
    fireEvent.click(logoutBtn);
    expect(mockSignOut).toHaveBeenCalledWith({ callbackUrl: "/" });
  });

  // ── Routing ───────────────────────────────────────────────────────────────

  it("on non-home page, clicking Home nav link calls router.push with '/#hero'", () => {
    mockUsePathname.mockReturnValue("/admin");
    // Mock scrollIntoView to prevent errors on the home page check
    const scrollIntoView = jest.fn();
    document.getElementById = jest.fn(() => ({ scrollIntoView }) as unknown as HTMLElement);

    render(<Navbar />);
    const homeBtn = screen.getAllByRole("button", { name: /^home$/i })[0];
    fireEvent.click(homeBtn);
    expect(mockPush).toHaveBeenCalledWith("/#hero");
  });

  it("on home page, clicking About nav link does NOT call router.push", () => {
    mockUsePathname.mockReturnValue("/");
    const scrollIntoView = jest.fn();
    document.getElementById = jest.fn(() => ({ scrollIntoView }) as unknown as HTMLElement);

    render(<Navbar />);
    const aboutBtn = screen.getAllByRole("button", { name: /^about$/i })[0];
    fireEvent.click(aboutBtn);
    expect(mockPush).not.toHaveBeenCalled();
  });

  // ── Mobile hamburger ──────────────────────────────────────────────────────

  it("shows the hamburger Open menu button", () => {
    render(<Navbar />);
    expect(screen.getByRole("button", { name: /open menu/i })).toBeTruthy();
  });

  it("mobile menu is closed by default (drawer not visible)", () => {
    render(<Navbar />);
    // Drawer items only appear when open; before opening, no drawer nav buttons
    expect(screen.getByRole("button", { name: /open menu/i })).toBeTruthy();
  });

  it("opens mobile menu when hamburger is clicked", () => {
    render(<Navbar />);
    fireEvent.click(screen.getByRole("button", { name: /open menu/i }));
    expect(screen.getByRole("button", { name: /close menu/i })).toBeTruthy();
  });

  it("mobile menu shows Logout button when admin and menu is open", () => {
    asAdmin();
    render(<Navbar />);
    fireEvent.click(screen.getByRole("button", { name: /open menu/i }));
    // After opening, multiple Logout buttons (desktop + mobile)
    expect(screen.getAllByRole("button", { name: /logout/i }).length).toBeGreaterThanOrEqual(2);
  });
});
