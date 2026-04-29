"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Circle, CheckCircle2 } from "lucide-react";
import { useSwipeable } from "react-swipeable";
import type { OptimisticTodo } from "@/lib/validation";
import { useToggleTodo } from "@/hooks/use-toggle-todo";
import { useMediaQuery } from "@/hooks/use-media-query";

const SWIPE_PX_THRESHOLD = 80;

interface TaskItemProps {
  todo: OptimisticTodo;
  /** Wired by TodoListClient; called by Story 3.3's delete affordances. */
  onDelete?: (id: string) => void;
}

export function TaskItem({ todo }: TaskItemProps) {
  const toggleTodo = useToggleTodo();
  const enableSwipe = useMediaQuery("(max-width: 1023.98px) and (pointer: coarse)");
  const rowRef = useRef<HTMLLIElement | null>(null);
  const [dragX, setDragX] = useState(0);
  const [isDragging, setIsDragging] = useState(false);

  const handleToggle = () => {
    if (toggleTodo.isPending) return;
    toggleTodo.mutate({ id: todo.id, completed: !todo.completed });
  };

  const swipeHandlers = useSwipeable({
    onSwiping: (e) => {
      if (!enableSwipe) return;
      if (e.deltaX > 0) {
        setIsDragging(true);
        const max = rowRef.current?.clientWidth ?? 0;
        setDragX(Math.min(e.deltaX, max));
      }
    },
    onSwiped: (e) => {
      setIsDragging(false);
      if (!enableSwipe) {
        setDragX(0);
        return;
      }
      if (e.deltaX >= SWIPE_PX_THRESHOLD && e.dir === "Right") {
        handleToggle();
      }
      setDragX(0);
    },
    delta: SWIPE_PX_THRESHOLD,
    trackMouse: false,
  });

  // Compose rowRef with react-swipeable's callback ref so both receive the element.
  // swipeRef is stable across renders (react-swipeable creates it with useCallback([])).
  const { ref: swipeRef } = swipeHandlers;
  const setRefs = useCallback(
    (el: HTMLLIElement | null) => {
      rowRef.current = el;
      swipeRef?.(el);
    },
    [swipeRef],
  );

  // Reset drag on touchcancel (phone call, OS notification interrupts mid-gesture)
  useEffect(() => {
    const el = rowRef.current;
    if (!el || !enableSwipe) return;
    const reset = () => {
      setIsDragging(false);
      setDragX(0);
    };
    el.addEventListener("touchcancel", reset);
    return () => el.removeEventListener("touchcancel", reset);
  }, [enableSwipe]);

  return (
    <li
      role="listitem"
      ref={setRefs}
      data-task-id={todo.id}
      className="min-h-[48px] py-3 px-6 flex items-center gap-3 overflow-hidden"
    >
      <div
        style={{ transform: `translateX(${dragX}px)` }}
        className={[
          "flex items-center gap-3 flex-1",
          isDragging
            ? "transition-none"
            : "transition-transform duration-200 ease-in-out motion-reduce:transition-none",
        ].join(" ")}
      >
        <button
          type="button"
          aria-pressed={todo.completed}
          aria-label={todo.completed ? "Mark task incomplete" : "Mark task complete"}
          onClick={handleToggle}
          disabled={toggleTodo.isPending}
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
      </div>
    </li>
  );
}
