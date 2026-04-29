// @vitest-environment jsdom
import { render, screen, fireEvent } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { useSwipeable } from "react-swipeable";
import type { OptimisticTodo } from "@/lib/validation";
import { TaskItem } from "./TaskItem";

const mockMutate = vi.fn();
const mockDeleteFn = vi.fn();

vi.mock("@/hooks/use-toggle-todo", () => ({
  useToggleTodo: () => ({ mutate: mockMutate, isPending: false }),
}));

vi.mock("react-swipeable", () => ({
  useSwipeable: vi.fn(() => ({ ref: vi.fn() })),
}));

type MatchMediaConfig = boolean | { swipe?: boolean; reduceMotion?: boolean };

function mockMatchMedia(config: MatchMediaConfig) {
  const resolved =
    typeof config === "boolean"
      ? { swipe: config, reduceMotion: false }
      : { swipe: true, reduceMotion: false, ...config };
  Object.defineProperty(window, "matchMedia", {
    writable: true,
    configurable: true,
    value: vi.fn().mockImplementation((query: string) => ({
      matches: query.includes("prefers-reduced-motion") ? resolved.reduceMotion : resolved.swipe,
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
  mockDeleteFn.mockReset();
  vi.mocked(useSwipeable).mockClear();
  vi.mocked(useSwipeable).mockReturnValue({ ref: vi.fn() } as unknown as ReturnType<typeof useSwipeable>);
  mockMatchMedia(true); // default: mobile (swipe enabled, motion not reduced)
});

afterEach(() => {
  vi.useRealTimers();
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
    config.onSwiped?.({ deltaX: 30, dir: "Right" } as never);
    expect(mockMutate).not.toHaveBeenCalled();
  });

  it("swipe-left below lg does NOT invoke toggle mutate (routes to onDelete, not toggle)", () => {
    mockMatchMedia(true);
    render(<ul><TaskItem todo={todo} /></ul>);
    const config = vi.mocked(useSwipeable).mock.calls[0][0];
    config.onSwiped?.({ deltaX: -200, dir: "Left" } as never);
    expect(mockMutate).not.toHaveBeenCalled();
  });

  it("at lg+ viewport, swiping does not invoke toggle mutate (handlers gated)", () => {
    mockMatchMedia(false);
    render(<ul><TaskItem todo={todo} /></ul>);
    const config = vi.mocked(useSwipeable).mock.calls[0][0];
    config.onSwiped?.({ deltaX: 200, dir: "Right" } as never);
    expect(mockMutate).not.toHaveBeenCalled();
  });

  // --- Delete button (AC #1) ---

  it("trash button renders with aria-label='Delete task'", () => {
    render(<ul><TaskItem todo={todo} /></ul>);
    expect(screen.getByRole("button", { name: /delete task/i })).toBeInTheDocument();
  });

  it("clicking trash button calls onDelete with todo.id at lg+ viewport (independent of swipe gate)", () => {
    mockMatchMedia(false); // lg+ — swipe disabled, but trash button must still work
    render(<ul><TaskItem todo={todo} onDelete={mockDeleteFn} /></ul>);
    fireEvent.click(screen.getByRole("button", { name: /delete task/i }));
    expect(mockDeleteFn).toHaveBeenCalledWith(todo.id);
  });

  // --- Keyboard Delete (AC #3) ---

  it("Delete key on focused <li> row calls onDelete", () => {
    render(<ul><TaskItem todo={todo} onDelete={mockDeleteFn} /></ul>);
    const row = screen.getByRole("listitem");
    fireEvent.keyDown(row, { key: "Delete" });
    expect(mockDeleteFn).toHaveBeenCalledWith(todo.id);
  });

  it("Delete key does NOT call onDelete when onDelete prop is absent", () => {
    render(<ul><TaskItem todo={todo} /></ul>);
    const row = screen.getByRole("listitem");
    // Should not throw even if onDelete is undefined
    expect(() => fireEvent.keyDown(row, { key: "Delete" })).not.toThrow();
  });

  // --- Swipe-left delete (AC #2) ---

  it("swipe-left past threshold at base viewport calls onDelete after 300ms", () => {
    vi.useFakeTimers();
    mockMatchMedia({ swipe: true, reduceMotion: false });
    render(<ul><TaskItem todo={todo} onDelete={mockDeleteFn} /></ul>);
    const config = vi.mocked(useSwipeable).mock.calls[0][0];
    config.onSwiped?.({ deltaX: -200, dir: "Left" } as never);
    expect(mockDeleteFn).not.toHaveBeenCalled(); // not yet
    vi.advanceTimersByTime(300);
    expect(mockDeleteFn).toHaveBeenCalledWith(todo.id);
  });

  it("swipe-left with prefers-reduced-motion calls onDelete immediately (no animation delay)", () => {
    vi.useFakeTimers();
    mockMatchMedia({ swipe: true, reduceMotion: true });
    render(<ul><TaskItem todo={todo} onDelete={mockDeleteFn} /></ul>);
    const config = vi.mocked(useSwipeable).mock.calls[0][0];
    config.onSwiped?.({ deltaX: -200, dir: "Left" } as never);
    vi.advanceTimersByTime(0);
    expect(mockDeleteFn).toHaveBeenCalledWith(todo.id);
  });

  it("swipe-left below threshold does NOT call onDelete", () => {
    vi.useFakeTimers();
    mockMatchMedia({ swipe: true });
    render(<ul><TaskItem todo={todo} onDelete={mockDeleteFn} /></ul>);
    const config = vi.mocked(useSwipeable).mock.calls[0][0];
    config.onSwiped?.({ deltaX: -30, dir: "Left" } as never);
    vi.advanceTimersByTime(1000);
    expect(mockDeleteFn).not.toHaveBeenCalled();
  });

  it("swipe-left at lg+ viewport does NOT call onDelete (swipe gate disabled)", () => {
    vi.useFakeTimers();
    mockMatchMedia({ swipe: false }); // lg+ — swipe disabled
    render(<ul><TaskItem todo={todo} onDelete={mockDeleteFn} /></ul>);
    const config = vi.mocked(useSwipeable).mock.calls[0][0];
    config.onSwiped?.({ deltaX: -200, dir: "Left" } as never);
    vi.advanceTimersByTime(1000);
    expect(mockDeleteFn).not.toHaveBeenCalled();
  });
});
