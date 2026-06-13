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
    render(<AdminSidebar activeTab="all-jobs" onSelect={onSelect} />);
    expect(screen.queryByText("Overview")).not.toBeInTheDocument();
    expect(screen.queryByText("Visitors")).not.toBeInTheDocument();
    expect(screen.queryByText("Settings")).not.toBeInTheDocument();
    expect(screen.queryByText("Preview live site")).not.toBeInTheDocument();
    expect(screen.getAllByText("Edit Resume").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("Jobs").length).toBeGreaterThanOrEqual(1);
    expect(screen.queryByText("Discoveries")).not.toBeInTheDocument();
  });

  it("calls onSelect with 'edit-resume' when the Edit Resume button is clicked", () => {
    render(<AdminSidebar activeTab="all-jobs" onSelect={onSelect} />);
    fireEvent.click(screen.getAllByRole("button", { name: /edit resume/i })[0]);
    expect(onSelect).toHaveBeenCalledWith("edit-resume");
  });

  it("calls onSelect with 'all-jobs' when the Jobs button is clicked", () => {
    render(<AdminSidebar activeTab="edit-resume" onSelect={onSelect} />);
    fireEvent.click(screen.getAllByRole("button", { name: /^jobs$/i })[0]);
    expect(onSelect).toHaveBeenCalledWith("all-jobs");
  });

  it("lists Jobs first in nav order", () => {
    render(<AdminSidebar activeTab="all-jobs" onSelect={onSelect} />);
    const labels = screen
      .getAllByRole("button")
      .map((btn) => btn.textContent?.trim())
      .filter(Boolean);
    const jobsIdx = labels.indexOf("Jobs");
    const editResumeIdx = labels.indexOf("Edit Resume");
    expect(jobsIdx).toBeGreaterThanOrEqual(0);
    expect(editResumeIdx).toBeGreaterThan(jobsIdx);
  });
});
