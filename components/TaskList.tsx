"use client";

import { useTodos } from "@/hooks/use-todos";
import { EmptyState } from "./EmptyState";
import { TaskItem } from "./TaskItem";

export function TaskList({ onDelete, onRetry }: { onDelete?: (id: string) => void; onRetry?: (id: string) => void }) {
  const { data: todos, isSuccess } = useTodos();

  if (isSuccess && todos && todos.length === 0) {
    return <EmptyState />;
  }

  if (!todos || todos.length === 0) {
    return null;
  }

  return (
    <ul id="task-list" role="list" className="w-full max-w-[640px] mx-auto">
      {todos.map((todo) => (
        <TaskItem key={todo.id} todo={todo} onDelete={onDelete} onRetry={onRetry} />
      ))}
    </ul>
  );
}
