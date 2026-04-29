"use client";

import { TaskInput } from "./TaskInput";
import { TaskList } from "./TaskList";

export function TodoListClient() {
  return (
    <div className="w-full flex flex-col flex-1 pb-24 lg:pb-0">
      <TaskInput />
      <TaskList />
    </div>
  );
}
