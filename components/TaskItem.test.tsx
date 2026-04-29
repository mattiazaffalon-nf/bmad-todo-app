// @vitest-environment jsdom
import { render, screen, fireEvent } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { useSwipeable } from "react-swipeable";
import type { OptimisticTodo } from "@/lib/validation";
import { TaskItem } from "./TaskItem";

const mockMutate = vi.fn();

vi.mock("@/hooks/use-toggle-todo", () => ({
  useToggleTodo: () => ({ mutate: mockMutate, isPending: false }),
}));

vi.mock("react-swipeable", () => ({
  useSwipeable: vi.fn(() => ({ ref: vi.fn() })),
}));

function mockMatchMedia(matches: boolean) {
  Object.defineProperty(window, "matchMedia", {
    writable: true,
    configurable: true,
    value: vi.fn().mockImplementation((query: string) => ({
      matches,
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

beforeEach(() => {
  mockMutate.mockReset();
  vi.mocked(useSwipeable).mockClear();
  vi.mocked(useSwipeable).mockReturnValue({ ref: vi.fn() } as unknown as ReturnType<typeof useSwipeable>);
  mockMatchMedia(true); // default: mobile (swipe enabled)
});

const todo: OptimisticTodo = {
  id: "11111111-1111-4111-8111-111111111111",
  description: "buy milk",
  completed: false,
  createdAt: "2026-04-28T12:00:00.000Z",
  userId: null,
};

const completedTodo: OptimisticTodo = { ...todo, completed: true };

describe("TaskItem", () => {
  it("renders description text", () => {
    render(<ul><TaskItem todo={todo} /></ul>);
    expect(screen.getByText("buy milk")).toBeInTheDocument();
  });

  it("has role='listitem'", () => {
    render(<ul><TaskItem todo={todo} /></ul>);
    expect(screen.getByRole("listitem")).toBeInTheDocument();
  });

  it("renders the Circle icon for active todo", () => {
    render(<ul><TaskItem todo={todo} /></ul>);
    expect(document.querySelector("svg")).toBeInTheDocument();
  });

  it("description element has truncate class", () => {
    render(<ul><TaskItem todo={todo} /></ul>);
    const desc = screen.getByText("buy milk");
    expect(desc.className).toContain("truncate");
  });

  it("clicking checkbox calls mutate with completed: true for active todo", () => {
    render(<ul><TaskItem todo={todo} /></ul>);
    fireEvent.click(screen.getByRole("button", { name: /mark task complete/i }));
    expect(mockMutate).toHaveBeenCalledOnce();
    expect(mockMutate).toHaveBeenCalledWith({ id: todo.id, completed: true });
  });

  it("clicking checkbox calls mutate with completed: false for completed todo", () => {
    render(<ul><TaskItem todo={completedTodo} /></ul>);
    fireEvent.click(screen.getByRole("button", { name: /mark task incomplete/i }));
    expect(mockMutate).toHaveBeenCalledOnce();
    expect(mockMutate).toHaveBeenCalledWith({ id: todo.id, completed: false });
  });

  it("completed todo renders with line-through on description", () => {
    render(<ul><TaskItem todo={completedTodo} /></ul>);
    const desc = screen.getByText("buy milk");
    expect(desc.className).toContain("line-through");
    expect(desc.className).toContain("text-foreground-muted");
  });

  it("active todo renders without line-through on description", () => {
    render(<ul><TaskItem todo={todo} /></ul>);
    const desc = screen.getByText("buy milk");
    expect(desc.className).not.toContain("line-through");
    expect(desc.className).toContain("text-foreground");
  });

  it("checkbox has aria-pressed=false for active todo", () => {
    render(<ul><TaskItem todo={todo} /></ul>);
    const btn = screen.getByRole("button", { name: /mark task complete/i });
    expect(btn).toHaveAttribute("aria-pressed", "false");
  });

  it("checkbox has aria-pressed=true for completed todo", () => {
    render(<ul><TaskItem todo={completedTodo} /></ul>);
    const btn = screen.getByRole("button", { name: /mark task incomplete/i });
    expect(btn).toHaveAttribute("aria-pressed", "true");
  });

  it("checkbox is a <button> element so Enter/Space natively trigger click (a11y contract)", () => {
    render(<ul><TaskItem todo={todo} /></ul>);
    const btn = screen.getByRole("button", { name: /mark task complete/i });
    expect(btn.tagName).toBe("BUTTON");
    fireEvent.keyDown(btn, { key: "Enter" });
    fireEvent.keyDown(btn, { key: " " });
  });

  it("swipe-right past threshold below lg invokes mutate with toggled completed", () => {
    mockMatchMedia(true);
    render(<ul><TaskItem todo={todo} /></ul>);
    const config = vi.mocked(useSwipeable).mock.calls[0][0];
    expect(config.delta).toBe(80);
    config.onSwiped?.({ deltaX: 200, dir: "Right" } as never);
    expect(mockMutate).toHaveBeenCalledOnce();
    expect(mockMutate).toHaveBeenCalledWith({ id: todo.id, completed: true });
  });

  it("swipe-right below threshold below lg does NOT invoke mutate", () => {
    mockMatchMedia(true);
    render(<ul><TaskItem todo={todo} /></ul>);
    const config = vi.mocked(useSwipeable).mock.calls[0][0];
    // deltaX 30 is below the 80px threshold; clientWidth in jsdom is 0 so the 40%-width branch is also below
    config.onSwiped?.({ deltaX: 30, dir: "Right" } as never);
    expect(mockMutate).not.toHaveBeenCalled();
  });

  it("swipe-left below lg does NOT invoke mutate (only swipe-right wired)", () => {
    mockMatchMedia(true);
    render(<ul><TaskItem todo={todo} /></ul>);
    const config = vi.mocked(useSwipeable).mock.calls[0][0];
    config.onSwiped?.({ deltaX: -200, dir: "Left" } as never);
    expect(mockMutate).not.toHaveBeenCalled();
  });

  it("at lg+ viewport, swiping does not invoke mutate (handlers gated)", () => {
    mockMatchMedia(false);
    render(<ul><TaskItem todo={todo} /></ul>);
    const config = vi.mocked(useSwipeable).mock.calls[0][0];
    // Even if the host element invokes onSwiped (defensively), the gate short-circuits
    config.onSwiped?.({ deltaX: 200, dir: "Right" } as never);
    expect(mockMutate).not.toHaveBeenCalled();
  });
});
