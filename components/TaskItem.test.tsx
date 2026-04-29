// @vitest-environment jsdom
import { render, screen, fireEvent } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import type { OptimisticTodo } from "@/lib/validation";
import { TaskItem } from "./TaskItem";

const mockMutate = vi.fn();

vi.mock("@/hooks/use-toggle-todo", () => ({
  useToggleTodo: () => ({ mutate: mockMutate }),
}));

beforeEach(() => {
  mockMutate.mockReset();
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
    // fireEvent.keyDown on a <button> does not auto-fire click in JSDOM,
    // but browsers do — the contract is satisfied by being a <button>.
    fireEvent.keyDown(btn, { key: "Enter" });
    fireEvent.keyDown(btn, { key: " " });
  });
});
