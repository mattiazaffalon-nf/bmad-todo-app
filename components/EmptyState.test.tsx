// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { EmptyState } from "./EmptyState";

describe("EmptyState", () => {
  it("has aria-live='polite'", () => {
    render(<EmptyState />);
    const container = document.getElementById("empty-state-hint");
    expect(container).toHaveAttribute("aria-live", "polite");
  });

  it("has stable id='empty-state-hint'", () => {
    render(<EmptyState />);
    expect(document.getElementById("empty-state-hint")).toBeInTheDocument();
  });

  it("renders mobile copy", () => {
    render(<EmptyState />);
    expect(screen.getByText("Tap to add your first task")).toBeInTheDocument();
  });

  it("renders desktop copy", () => {
    render(<EmptyState />);
    expect(screen.getByText("Type a task and press Enter")).toBeInTheDocument();
  });
});
