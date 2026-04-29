"use client";

import { useState } from "react";
import { Send } from "lucide-react";
import { useCreateTodo } from "@/hooks/use-create-todo";

export function TaskInput() {
  const [value, setValue] = useState("");
  const { mutate } = useCreateTodo();

  function handleSubmit() {
    const trimmed = value.trim();
    if (!trimmed) return;
    mutate({ id: crypto.randomUUID(), description: trimmed });
    setValue("");
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter" && !e.nativeEvent.isComposing) {
      handleSubmit();
    }
  }

  const hasContent = value.trim().length > 0;

  return (
    <div className="fixed bottom-0 left-0 right-0 z-10 bg-surface border-t border-border-subtle px-4 py-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] lg:static lg:border-none lg:bg-transparent lg:px-0 lg:py-0 lg:pb-0 w-full max-w-[640px] lg:mx-auto">
      <div className="relative flex items-center gap-2">
        <input
          id="task-input"
          autoFocus
          aria-label="New task"
          className="flex-1 text-base text-foreground bg-transparent outline-none placeholder:text-foreground-muted"
          placeholder="Add a task…"
          value={value}
          onChange={(e) => setValue(e.target.value.slice(0, 280))}
          onKeyDown={handleKeyDown}
        />
        <button
          type="button"
          aria-label="Add task"
          onClick={handleSubmit}
          tabIndex={hasContent ? 0 : -1}
          className={`w-[44px] h-[44px] flex items-center justify-center text-accent motion-safe:transition-opacity duration-150 ${hasContent ? "opacity-100" : "opacity-0 pointer-events-none"}`}
        >
          <Send size={20} />
        </button>
      </div>
    </div>
  );
}
