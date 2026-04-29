"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Circle, CheckCircle2, Trash2 } from "lucide-react";
import { useSwipeable } from "react-swipeable";
import type { OptimisticTodo } from "@/lib/validation";
import { useToggleTodo } from "@/hooks/use-toggle-todo";
import { useMediaQuery } from "@/hooks/use-media-query";
import { ErrorIndicator } from "./ErrorIndicator";

const SWIPE_PX_THRESHOLD = 80;

interface TaskItemProps {
  todo: OptimisticTodo;
  onDelete?: (id: string) => void;
}

export function TaskItem({ todo, onDelete }: TaskItemProps) {
  const toggleTodo = useToggleTodo();
  const enableSwipe = useMediaQuery("(max-width: 1023.98px) and (pointer: coarse)");
  const reduceMotion = useMediaQuery("(prefers-reduced-motion: reduce)");
  const rowRef = useRef<HTMLLIElement | null>(null);
  const exitTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [dragX, setDragX] = useState(0);
  const [isDragging, setIsDragging] = useState(false);

  useEffect(() => {
    return () => {
      if (exitTimerRef.current !== null) {
        clearTimeout(exitTimerRef.current);
        exitTimerRef.current = null;
      }
    };
  }, []);

  const handleToggle = () => {
    if (toggleTodo.isPending) return;
    toggleTodo.mutate({ id: todo.id, completed: !todo.completed });
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLLIElement>) => {
    if (e.key === "Delete" && !e.nativeEvent.isComposing) {
      onDelete?.(todo.id);
    }
  };

  const swipeHandlers = useSwipeable({
    onSwiping: (e) => {
      if (!enableSwipe) return;
      if (e.deltaX > 0) {
        setIsDragging(true);
        const max = rowRef.current?.clientWidth ?? 0;
        setDragX(Math.min(e.deltaX, max));
      } else if (e.deltaX < 0) {
        setIsDragging(true);
        const max = rowRef.current?.clientWidth ?? 0;
        setDragX(Math.max(e.deltaX, -max));
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
      } else if (e.dir === "Left" && Math.abs(e.deltaX) >= SWIPE_PX_THRESHOLD) {
        if (exitTimerRef.current !== null) return;
        const clientWidth = rowRef.current?.clientWidth ?? 300;
        if (!reduceMotion) {
          setDragX(-clientWidth);
        }
        exitTimerRef.current = setTimeout(() => {
          exitTimerRef.current = null;
          onDelete?.(todo.id);
        }, reduceMotion ? 0 : 300);
        return;
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
      tabIndex={-1}
      data-task-id={todo.id}
      onKeyDown={handleKeyDown}
      className="group min-h-[48px] py-3 px-6 flex items-center gap-3 overflow-hidden relative"
    >
      {/* Trash icon panel — sits behind the sliding content, revealed on swipe-left */}
      <div className="absolute inset-y-0 right-0 flex items-center px-6 bg-surface">
        <Trash2 size={20} className="text-error-foreground" aria-hidden="true" />
      </div>

      <div
        style={{ transform: `translateX(${dragX}px)` }}
        className={[
          "flex items-center gap-3 flex-1 bg-background",
          isDragging
            ? "transition-none"
            : dragX < 0
              ? "transition-transform duration-300 ease-in motion-reduce:transition-none"
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
        {todo.syncStatus === "failed" && (
          <ErrorIndicator onRetry={() => {}} retrying={false} />
        )}
        <button
          type="button"
          aria-label="Delete task"
          onClick={() => onDelete?.(todo.id)}
          className="w-[44px] h-[44px] flex items-center justify-center flex-shrink-0 opacity-0 [@media(hover:hover)]:group-hover:opacity-100 focus-visible:opacity-100 transition-opacity duration-200 motion-reduce:transition-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
        >
          <Trash2 size={20} />
        </button>
      </div>
    </li>
  );
}
