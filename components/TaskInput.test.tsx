import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { TaskInput } from "./TaskInput";

const mockMutate = vi.fn();

vi.mock("@/hooks/use-create-todo", () => ({
  useCreateTodo: () => ({ mutate: mockMutate }),
}));

beforeEach(() => {
  mockMutate.mockReset();
});

describe("TaskInput", () => {
  it("is auto-focused on mount", () => {
    render(<TaskInput />);
    expect(document.activeElement).toBe(screen.getByRole("textbox", { name: /new task/i }));
  });

  it("send button is hidden when input is empty", () => {
    render(<TaskInput />);
    const btn = screen.getByRole("button", { name: /add task/i });
    expect(btn).toHaveClass("opacity-0");
  });

  it("send button is visible when input has non-whitespace content", () => {
    render(<TaskInput />);
    const input = screen.getByRole("textbox", { name: /new task/i });
    fireEvent.change(input, { target: { value: "hello" } });
    const btn = screen.getByRole("button", { name: /add task/i });
    expect(btn).not.toHaveClass("opacity-0");
  });

  it("silently truncates input beyond 280 chars", () => {
    render(<TaskInput />);
    const input = screen.getByRole("textbox", { name: /new task/i });
    fireEvent.change(input, { target: { value: "a".repeat(300) } });
    expect((input as HTMLInputElement).value).toHaveLength(280);
  });

  it("pressing Enter with valid input calls mutate and clears the input", () => {
    render(<TaskInput />);
    const input = screen.getByRole("textbox", { name: /new task/i });
    fireEvent.change(input, { target: { value: "buy milk" } });
    fireEvent.keyDown(input, { key: "Enter" });
    expect(mockMutate).toHaveBeenCalledOnce();
    expect(mockMutate).toHaveBeenCalledWith(
      expect.objectContaining({ description: "buy milk" }),
    );
    expect((input as HTMLInputElement).value).toBe("");
  });

  it("pressing Enter on empty input does NOT call mutate", () => {
    render(<TaskInput />);
    const input = screen.getByRole("textbox", { name: /new task/i });
    fireEvent.keyDown(input, { key: "Enter" });
    expect(mockMutate).not.toHaveBeenCalled();
  });

  it("pressing Enter on whitespace-only input does NOT call mutate", () => {
    render(<TaskInput />);
    const input = screen.getByRole("textbox", { name: /new task/i });
    fireEvent.change(input, { target: { value: "   " } });
    fireEvent.keyDown(input, { key: "Enter" });
    expect(mockMutate).not.toHaveBeenCalled();
  });
});
