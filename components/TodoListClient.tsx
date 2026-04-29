"use client";

import { useCallback, useEffect, useReducer, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useDeleteTodo } from "@/hooks/use-delete-todo";
import { UNDO_TIMEOUT_MS } from "@/lib/constants";
import type { OptimisticTodo } from "@/lib/validation";
import { TaskInput } from "./TaskInput";
import { TaskList } from "./TaskList";
import { UndoToast } from "./UndoToast";

type ToastStatus = "idle" | "visible" | "dismissing";

type ToastState = {
  status: ToastStatus;
  pendingId: string | null;
  previousSnapshot: OptimisticTodo[] | null;
};

type ToastAction =
  | { type: "SHOW"; pendingId: string; previousSnapshot: OptimisticTodo[] }
  | { type: "UNDO" }
  | { type: "DISMISS" }
  | { type: "IDLE" };

function toastReducer(state: ToastState, action: ToastAction): ToastState {
  switch (action.type) {
    case "SHOW":
      return { status: "visible", pendingId: action.pendingId, previousSnapshot: action.previousSnapshot };
    case "UNDO":
      return { status: "dismissing", pendingId: null, previousSnapshot: null };
    case "DISMISS":
      return { ...state, status: "dismissing", pendingId: null, previousSnapshot: null };
    case "IDLE":
      return { status: "idle", pendingId: null, previousSnapshot: null };
    default:
      return state;
  }
}

const INITIAL_STATE: ToastState = { status: "idle", pendingId: null, previousSnapshot: null };

export function TodoListClient() {
  const queryClient = useQueryClient();
  const deleteTodo = useDeleteTodo();
  const [toastState, dispatch] = useReducer(toastReducer, INITIAL_STATE);
  const dismissTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Transition from dismissing → idle after the 200ms fade-out
  useEffect(() => {
    if (toastState.status !== "dismissing") return;
    const id = setTimeout(() => dispatch({ type: "IDLE" }), 200);
    return () => clearTimeout(id);
  }, [toastState.status]);

  const handleDelete = useCallback(
    (id: string) => {
      // Collect focusable rows before the optimistic remove so we know what to focus next
      const rows = Array.from(document.querySelectorAll<HTMLElement>("[data-task-id]"));
      const idx = rows.findIndex((el) => el.dataset.taskId === id);

      const previous = queryClient.getQueryData<OptimisticTodo[]>(["todos"]) ?? [];

      deleteTodo.mutate(id);

      // Cancel any in-flight auto-dismiss timer (cross-fade: let previous DELETE complete)
      if (dismissTimerRef.current) clearTimeout(dismissTimerRef.current);

      dispatch({ type: "SHOW", pendingId: id, previousSnapshot: previous });

      // Auto-dismiss the toast in sync with the DELETE timer
      dismissTimerRef.current = setTimeout(() => {
        dispatch({ type: "DISMISS" });
      }, UNDO_TIMEOUT_MS);

      // Move focus after React re-renders the optimistic update
      queueMicrotask(() => {
        const updated = Array.from(document.querySelectorAll<HTMLElement>("[data-task-id]"));
        const target =
          updated[idx] ??
          updated[idx - 1] ??
          document.querySelector<HTMLElement>("#task-input");
        target?.focus();
      });
    },
    [deleteTodo, queryClient],
  );

  const handleUndo = useCallback(() => {
    if (dismissTimerRef.current) {
      clearTimeout(dismissTimerRef.current);
      dismissTimerRef.current = null;
    }
    deleteTodo.undo();
    dispatch({ type: "UNDO" });
  }, [deleteTodo]);

  const handleDismiss = useCallback(() => {
    if (dismissTimerRef.current) {
      clearTimeout(dismissTimerRef.current);
      dismissTimerRef.current = null;
    }
    dispatch({ type: "DISMISS" });
  }, []);

  return (
    <div className="w-full flex flex-col flex-1 pb-24 lg:pb-0">
      <div className="flex justify-center py-2">
        <UndoToast
          visible={toastState.status === "visible"}
          onUndo={handleUndo}
          onDismiss={handleDismiss}
        />
      </div>
      <TaskList onDelete={handleDelete} />
      <TaskInput />
    </div>
  );
}
