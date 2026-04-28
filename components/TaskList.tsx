"use client";

import { useTodos } from "@/hooks/use-todos";
import { EmptyState } from "./EmptyState";
import { TaskItem } from "./TaskItem";

export function TaskList() {
  const { data: todos, isSuccess } = useTodos();

  if (isSuccess && todos && todos.length === 0) {
    return <EmptyState />;
  }

  if (!todos || todos.length === 0) {
    return null;
  }

  return (
    <ul role="list" className="w-full max-w-[640px] mx-auto">
      {todos.map((todo) => (
        <TaskItem key={todo.id} todo={todo} />
      ))}
    </ul>
  );
}
