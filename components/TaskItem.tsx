import { Circle, CheckCircle2 } from "lucide-react";
import type { OptimisticTodo } from "@/lib/validation";
import { useToggleTodo } from "@/hooks/use-toggle-todo";

export function TaskItem({ todo }: { todo: OptimisticTodo }) {
  const toggleTodo = useToggleTodo();

  return (
    <li role="listitem" className="min-h-[48px] py-3 px-6 flex items-center gap-3">
      <button
        type="button"
        aria-pressed={todo.completed}
        aria-label={todo.completed ? "Mark task incomplete" : "Mark task complete"}
        onClick={() => toggleTodo.mutate({ id: todo.id, completed: !todo.completed })}
        className="w-[44px] h-[44px] flex items-center justify-center flex-shrink-0 rounded-full focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
      >
        {todo.completed ? (
          <CheckCircle2 size={24} className="text-accent fill-accent" />
        ) : (
          <Circle size={24} />
        )}
      </button>
      <p
        className={[
          "flex-1 text-base truncate leading-normal",
          "transition-colors duration-200 ease-in-out motion-reduce:transition-none",
          todo.completed ? "text-foreground-muted line-through" : "text-foreground",
        ].join(" ")}
      >
        {todo.description}
      </p>
      <div className="w-[44px] flex-shrink-0" />
    </li>
  );
}
