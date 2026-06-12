import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import AdminSidebar from "@/app/admin/_components/Sidebar";

// Note: AdminSidebar renders nav items TWICE (desktop aside + mobile nav strip)
// so getAllByRole / getAllByText must be used where text appears in both.

const onSelect = jest.fn();

describe("AdminSidebar", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("renders all nav labels", () => {
    render(<AdminSidebar activeTab="overview" onSelect={onSelect} />);
    expect(screen.getAllByText("Overview").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("Edit Resume").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("Visitors").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("Settings").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("Discoveries").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("Jobs").length).toBeGreaterThanOrEqual(1);
  });

  it("renders the Preview live site link", () => {
    render(<AdminSidebar activeTab="overview" onSelect={onSelect} />);
    expect(screen.getAllByText("Preview live site").length).toBeGreaterThanOrEqual(1);
  });

  it("calls onSelect with 'overview' when the Overview button is clicked", () => {
    render(<AdminSidebar activeTab="settings" onSelect={onSelect} />);
    fireEvent.click(screen.getAllByRole("button", { name: /overview/i })[0]);
    expect(onSelect).toHaveBeenCalledWith("overview");
  });

  it("calls onSelect with 'visitors' when the Visitors button is clicked", () => {
    render(<AdminSidebar activeTab="overview" onSelect={onSelect} />);
    fireEvent.click(screen.getAllByRole("button", { name: /visitors/i })[0]);
    expect(onSelect).toHaveBeenCalledWith("visitors");
  });

  it("calls onSelect with 'settings' when the Settings button is clicked", () => {
    render(<AdminSidebar activeTab="overview" onSelect={onSelect} />);
    fireEvent.click(screen.getAllByRole("button", { name: /settings/i })[0]);
    expect(onSelect).toHaveBeenCalledWith("settings");
  });

  it("calls onSelect with 'edit-resume' when the Edit Resume button is clicked", () => {
    render(<AdminSidebar activeTab="overview" onSelect={onSelect} />);
    fireEvent.click(screen.getAllByRole("button", { name: /edit resume/i })[0]);
    expect(onSelect).toHaveBeenCalledWith("edit-resume");
  });

  it("calls onSelect with 'all-jobs' when the Jobs button is clicked", () => {
    render(<AdminSidebar activeTab="overview" onSelect={onSelect} />);
    fireEvent.click(screen.getAllByRole("button", { name: /^jobs$/i })[0]);
    expect(onSelect).toHaveBeenCalledWith("all-jobs");
  });

  it("lists Jobs immediately after Overview in nav order", () => {
    render(<AdminSidebar activeTab="overview" onSelect={onSelect} />);
    const labels = screen
      .getAllByRole("button")
      .map((btn) => btn.textContent?.trim())
      .filter(Boolean);
    const overviewIdx = labels.indexOf("Overview");
    const jobsIdx = labels.indexOf("Jobs");
    const discoveriesIdx = labels.indexOf("Discoveries");
    expect(jobsIdx).toBeGreaterThan(overviewIdx);
    expect(discoveriesIdx).toBeGreaterThan(jobsIdx);
  });
});
