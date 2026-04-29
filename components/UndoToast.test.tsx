import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { UndoToast } from "./UndoToast";

describe("UndoToast", () => {
  it("renders 'Task deleted' label and 'Undo' button when visible", () => {
    render(<UndoToast visible={true} onUndo={vi.fn()} onDismiss={vi.fn()} />);
    expect(screen.getByText("Task deleted")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Undo" })).toBeInTheDocument();
  });

  it("has role=status with aria-live=polite", () => {
    render(<UndoToast visible={true} onUndo={vi.fn()} onDismiss={vi.fn()} />);
    const region = screen.getByRole("status");
    expect(region).toHaveAttribute("aria-live", "polite");
  });

  it("is opacity-0, pointer-events-none, and visibility:hidden when not visible", () => {
    render(<UndoToast visible={false} onUndo={vi.fn()} onDismiss={vi.fn()} />);
    const region = screen.getByRole("status", { hidden: true });
    expect(region.className).toContain("opacity-0");
    expect(region.className).toContain("pointer-events-none");
    expect(region.style.visibility).toBe("hidden");
  });

  it("calls onUndo when Undo button is clicked", () => {
    const onUndo = vi.fn();
    render(<UndoToast visible={true} onUndo={onUndo} onDismiss={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: "Undo" }));
    expect(onUndo).toHaveBeenCalledTimes(1);
  });

  it("calls onDismiss (not onUndo) when Escape is pressed", () => {
    const onUndo = vi.fn();
    const onDismiss = vi.fn();
    render(<UndoToast visible={true} onUndo={onUndo} onDismiss={onDismiss} />);
    fireEvent.keyDown(document, { key: "Escape" });
    expect(onDismiss).toHaveBeenCalledTimes(1);
    expect(onUndo).not.toHaveBeenCalled();
  });

  it("does not call onDismiss on Escape when not visible", () => {
    const onDismiss = vi.fn();
    render(<UndoToast visible={false} onUndo={vi.fn()} onDismiss={onDismiss} />);
    fireEvent.keyDown(document, { key: "Escape" });
    expect(onDismiss).not.toHaveBeenCalled();
  });
});
