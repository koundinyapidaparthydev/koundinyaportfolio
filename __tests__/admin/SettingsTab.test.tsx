import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import SettingsTab from "@/app/admin/_components/SettingsTab";

// Helper to fill a password input by its autocomplete attribute
function fillInput(autocomplete: string, value: string) {
  const input = document.querySelector<HTMLInputElement>(
    `input[autocomplete="${autocomplete}"]`
  );
  if (!input) throw new Error(`Input with autocomplete="${autocomplete}" not found`);
  fireEvent.change(input, { target: { value } });
}

function submitForm() {
  fireEvent.click(screen.getByRole("button", { name: /update password/i }));
}

describe("SettingsTab", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Reset fetch mock
    (global as { fetch?: unknown }).fetch = undefined;
  });

  it("renders three password inputs and the submit button", () => {
    render(<SettingsTab />);
    expect(
      document.querySelector('input[autocomplete="current-password"]')
    ).toBeTruthy();
    expect(
      document.querySelectorAll('input[autocomplete="new-password"]').length
    ).toBe(2);
    expect(
      screen.getByRole("button", { name: /update password/i })
    ).toBeTruthy();
  });

  it("shows 'Current password is required' when submitting with empty fields", async () => {
    render(<SettingsTab />);
    submitForm();
    await waitFor(() => {
      expect(screen.getByText("Current password is required")).toBeTruthy();
    });
  });

  it("shows 'at least 8 characters' error when new password is too short", async () => {
    render(<SettingsTab />);
    fillInput("current-password", "correctpass");
    fillInput("new-password", "short");
    submitForm();
    await waitFor(() => {
      expect(
        screen.getByText("New password must be at least 8 characters")
      ).toBeTruthy();
    });
  });

  it("shows 'Passwords do not match' when confirmPassword differs", async () => {
    render(<SettingsTab />);
    fillInput("current-password", "correctpass");
    fillInput("new-password", "newpassword123");
    // confirmPassword is the second input with autocomplete="new-password"
    const confirmInput = document.querySelectorAll<HTMLInputElement>(
      'input[autocomplete="new-password"]'
    )[1];
    fireEvent.change(confirmInput, { target: { value: "differentpass" } });
    submitForm();
    await waitFor(() => {
      expect(screen.getByText("Passwords do not match")).toBeTruthy();
    });
  });

  it("calls fetch with correct payload on valid submission", async () => {
    const mockFetch = jest.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({}),
    });
    global.fetch = mockFetch as typeof global.fetch;

    render(<SettingsTab />);
    fillInput("current-password", "currentpass123");
    fillInput("new-password", "newpassword123");
    const confirmInput = document.querySelectorAll<HTMLInputElement>(
      'input[autocomplete="new-password"]'
    )[1];
    fireEvent.change(confirmInput, { target: { value: "newpassword123" } });
    submitForm();

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith(
        "/api/auth/password",
        expect.objectContaining({
          method: "PATCH",
          body: JSON.stringify({
            currentPassword: "currentpass123",
            newPassword: "newpassword123",
          }),
        })
      );
    });
  });

  it("shows success toast on a successful password change", async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({}),
    }) as typeof global.fetch;

    render(<SettingsTab />);
    fillInput("current-password", "currentpass123");
    fillInput("new-password", "newpassword123");
    const confirmInput = document.querySelectorAll<HTMLInputElement>(
      'input[autocomplete="new-password"]'
    )[1];
    fireEvent.change(confirmInput, { target: { value: "newpassword123" } });
    submitForm();

    await waitFor(() => {
      expect(screen.getByText("Password changed successfully.")).toBeTruthy();
    });
  });

  it("shows error toast when the API returns a non-OK response", async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      json: () => Promise.resolve({ error: "Incorrect current password" }),
    }) as typeof global.fetch;

    render(<SettingsTab />);
    fillInput("current-password", "wrongpass123");
    fillInput("new-password", "newpassword123");
    const confirmInput = document.querySelectorAll<HTMLInputElement>(
      'input[autocomplete="new-password"]'
    )[1];
    fireEvent.change(confirmInput, { target: { value: "newpassword123" } });
    submitForm();

    await waitFor(() => {
      expect(screen.getByText("Incorrect current password")).toBeTruthy();
    });
  });
});
