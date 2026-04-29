// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import type { Todo } from "@/lib/validation";
import { TaskList } from "./TaskList";

vi.mock("@/hooks/use-todos", () => ({
  useTodos: vi.fn(),
}));

vi.mock("@/hooks/use-toggle-todo", () => ({
  useToggleTodo: () => ({ mutate: vi.fn() }),
}));

vi.mock("react-swipeable", () => ({
  useSwipeable: vi.fn(() => ({ ref: vi.fn() })),
}));

beforeEach(() => {
  Object.defineProperty(window, "matchMedia", {
    writable: true,
    configurable: true,
    value: vi.fn().mockImplementation((query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  });
});

import { useTodos } from "@/hooks/use-todos";

const makeTodo = (id: string, description: string): Todo => ({
  id,
  description,
  completed: false,
  createdAt: "2026-04-28T12:00:00.000Z",
  userId: null,
});

describe("TaskList", () => {
  it("renders EmptyState when list is empty", () => {
    vi.mocked(useTodos).mockReturnValue({
      data: [],
      isSuccess: true,
      isPending: false,
    } as unknown as ReturnType<typeof useTodos>);

    render(<TaskList />);
    expect(document.getElementById("empty-state-hint")).toBeInTheDocument();
  });

  it("renders a ul with role='list' and N TaskItems when todos exist", () => {
    const todos = [
      makeTodo("33333333-3333-4333-8333-333333333333", "third"),
      makeTodo("22222222-2222-4222-8222-222222222222", "second"),
      makeTodo("11111111-1111-4111-8111-111111111111", "first"),
    ];
    vi.mocked(useTodos).mockReturnValue({
      data: todos,
      isSuccess: true,
      isPending: false,
    } as unknown as ReturnType<typeof useTodos>);

    render(<TaskList />);
    expect(screen.getByRole("list")).toBeInTheDocument();
    expect(screen.getAllByRole("listitem")).toHaveLength(3);
    // Newest-first order matches the provided array order
    const items = screen.getAllByRole("listitem");
    expect(items[0]).toHaveTextContent("third");
    expect(items[1]).toHaveTextContent("second");
    expect(items[2]).toHaveTextContent("first");
  });

  it("renders nothing while loading (no data yet)", () => {
    vi.mocked(useTodos).mockReturnValue({
      data: undefined,
      isSuccess: false,
      isPending: true,
    } as unknown as ReturnType<typeof useTodos>);

    const { container } = render(<TaskList />);
    expect(container.firstChild).toBeNull();
  });
});
