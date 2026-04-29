import { Circle } from "lucide-react";
import type { OptimisticTodo } from "@/lib/validation";

export function TaskItem({ todo }: { todo: OptimisticTodo }) {
  return (
    <li role="listitem" className="min-h-[48px] py-3 px-6 flex items-center gap-3">
      <div className="w-[44px] h-[44px] flex items-center justify-center flex-shrink-0">
        <Circle size={24} />
      </div>
      <p className="flex-1 text-base text-foreground truncate leading-normal">
        {todo.description}
      </p>
      <div className="w-[44px] flex-shrink-0" />
    </li>
  );
}
