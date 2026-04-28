// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { Todo } from "@/lib/validation";
import { TaskItem } from "./TaskItem";

const todo: Todo = {
  id: "11111111-1111-4111-8111-111111111111",
  description: "buy milk",
  completed: false,
  createdAt: "2026-04-28T12:00:00.000Z",
  userId: null,
};

describe("TaskItem", () => {
  it("renders description text", () => {
    render(<ul><TaskItem todo={todo} /></ul>);
    expect(screen.getByText("buy milk")).toBeInTheDocument();
  });

  it("has role='listitem'", () => {
    render(<ul><TaskItem todo={todo} /></ul>);
    expect(screen.getByRole("listitem")).toBeInTheDocument();
  });

  it("renders the Circle icon", () => {
    render(<ul><TaskItem todo={todo} /></ul>);
    // Lucide renders an SVG
    expect(document.querySelector("svg")).toBeInTheDocument();
  });

  it("description element has truncate class", () => {
    render(<ul><TaskItem todo={todo} /></ul>);
    const desc = screen.getByText("buy milk");
    expect(desc.className).toContain("truncate");
  });
});
