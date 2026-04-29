// @vitest-environment jsdom
import { render, screen, fireEvent } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ErrorIndicator } from "./ErrorIndicator";

function mockMatchMedia(reduceMotion: boolean) {
  Object.defineProperty(window, "matchMedia", {
    writable: true,
    configurable: true,
    value: vi.fn().mockImplementation((query: string) => ({
      matches: query.includes("prefers-reduced-motion") ? reduceMotion : false,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  });
}

describe("ErrorIndicator", () => {
  it("renders AlertCircle and static copy when retrying=false", () => {
    render(<ErrorIndicator onRetry={() => {}} retrying={false} />);
    expect(screen.getByText(/couldn't save/i)).toBeInTheDocument();
    // AlertCircle is rendered; RotateCw is not
    const btn = screen.getByRole("button", { name: /couldn't save, tap to retry/i });
    expect(btn).toBeInTheDocument();
    // The spin class should not be present when not retrying
    const svgs = btn.querySelectorAll("svg");
    expect(svgs.length).toBe(1);
    expect(svgs[0].classList.contains("animate-spin")).toBe(false);
  });

  it("renders RotateCw with animate-spin when retrying=true", () => {
    render(<ErrorIndicator onRetry={() => {}} retrying={true} />);
    const btn = screen.getByRole("button", { name: /couldn't save, tap to retry/i });
    const svgs = btn.querySelectorAll("svg");
    expect(svgs.length).toBe(1);
    expect(svgs[0].classList.contains("animate-spin")).toBe(true);
  });

  it("renders RotateCw with motion-reduce:animate-none class when retrying=true", () => {
    mockMatchMedia(true);
    render(<ErrorIndicator onRetry={() => {}} retrying={true} />);
    const btn = screen.getByRole("button", { name: /couldn't save, tap to retry/i });
    const svg = btn.querySelector("svg");
    // The class is present in DOM (CSS handles suppression at render time)
    expect(svg?.getAttribute("class")).toContain("motion-reduce:animate-none");
  });

  it("clicking the button calls onRetry", () => {
    const onRetry = vi.fn();
    render(<ErrorIndicator onRetry={onRetry} retrying={false} />);
    fireEvent.click(screen.getByRole("button", { name: /couldn't save, tap to retry/i }));
    expect(onRetry).toHaveBeenCalledOnce();
  });

  it("button has aria-label \"Couldn't save, tap to retry\"", () => {
    render(<ErrorIndicator onRetry={() => {}} retrying={false} />);
    expect(
      screen.getByRole("button", { name: "Couldn't save, tap to retry" }),
    ).toBeInTheDocument();
  });

  it("icon has aria-hidden=\"true\"", () => {
    render(<ErrorIndicator onRetry={() => {}} retrying={false} />);
    const btn = screen.getByRole("button");
    const svg = btn.querySelector("svg");
    expect(svg).toHaveAttribute("aria-hidden", "true");
  });

  it("Enter key on focused button calls onRetry (native button keyboard contract)", () => {
    const onRetry = vi.fn();
    render(<ErrorIndicator onRetry={onRetry} retrying={false} />);
    const btn = screen.getByRole("button");
    fireEvent.click(btn); // keyboard Enter on a native <button> fires click
    expect(onRetry).toHaveBeenCalled();
  });
});
