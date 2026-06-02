import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import AdminThemeProvider, { useAdminTheme } from "@/app/admin/_components/AdminThemeProvider";

// Mock next-themes
const mockSetTheme = jest.fn();
jest.mock("next-themes", () => ({
  useTheme: () => ({
    theme: "dark",
    setTheme: mockSetTheme,
  }),
}));

// Test consumer component
function TestConsumer() {
  const { theme, toggle } = useAdminTheme();
  return (
    <div>
      <span data-testid="theme-val">{theme}</span>
      <button onClick={toggle}>Toggle Theme</button>
    </div>
  );
}

describe("AdminThemeProvider", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    localStorage.clear();
    document.documentElement.className = "";
  });

  it("renders with dark theme by default", () => {
    render(
      <AdminThemeProvider>
        <TestConsumer />
      </AdminThemeProvider>
    );
    expect(screen.getByTestId("theme-val").textContent).toBe("dark");
    expect(document.documentElement.classList.contains("dark")).toBe(true);
  });

  it("reads theme from localStorage on mount", () => {
    localStorage.setItem("adminTheme", "light");
    render(
      <AdminThemeProvider>
        <TestConsumer />
      </AdminThemeProvider>
    );
    expect(screen.getByTestId("theme-val").textContent).toBe("light");
    expect(mockSetTheme).toHaveBeenCalledWith("light");
    expect(document.documentElement.classList.contains("dark")).toBe(false);
  });

  it("toggles theme and saves to localStorage and next-themes", () => {
    render(
      <AdminThemeProvider>
        <TestConsumer />
      </AdminThemeProvider>
    );
    const button = screen.getByRole("button", { name: /toggle theme/i });
    
    // Toggle dark -> light
    fireEvent.click(button);
    expect(screen.getByTestId("theme-val").textContent).toBe("light");
    expect(localStorage.getItem("adminTheme")).toBe("light");
    expect(mockSetTheme).toHaveBeenCalledWith("light");
    expect(document.documentElement.classList.contains("dark")).toBe(false);

    // Toggle light -> dark
    fireEvent.click(button);
    expect(screen.getByTestId("theme-val").textContent).toBe("dark");
    expect(localStorage.getItem("adminTheme")).toBe("dark");
    expect(mockSetTheme).toHaveBeenCalledWith("dark");
    expect(document.documentElement.classList.contains("dark")).toBe(true);
  });
});
