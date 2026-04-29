"use client";

import { useCallback, useEffect, useReducer, useRef } from "react";
import { useDeleteTodo } from "@/hooks/use-delete-todo";
import { UNDO_TIMEOUT_MS } from "@/lib/constants";
import { TaskInput } from "./TaskInput";
import { TaskList } from "./TaskList";
import { UndoToast } from "./UndoToast";

type ToastStatus = "idle" | "visible" | "dismissing";

type ToastAction = { type: "SHOW" } | { type: "UNDO" } | { type: "DISMISS" } | { type: "IDLE" };

function toastReducer(state: ToastStatus, action: ToastAction): ToastStatus {
  switch (action.type) {
    case "SHOW":
      return "visible";
    case "UNDO":
    case "DISMISS":
      return "dismissing";
    case "IDLE":
      return "idle";
    default:
      return state;
  }
}

export function TodoListClient() {
  const deleteTodo = useDeleteTodo();
  const [toastStatus, dispatch] = useReducer(toastReducer, "idle");
  const dismissTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Transition from dismissing → idle after the 200ms fade-out
  useEffect(() => {
    if (toastStatus !== "dismissing") return;
    const id = setTimeout(() => dispatch({ type: "IDLE" }), 200);
    return () => clearTimeout(id);
  }, [toastStatus]);

  // Clear pending dismiss timer on unmount
  useEffect(() => {
    return () => {
      if (dismissTimerRef.current !== null) {
        clearTimeout(dismissTimerRef.current);
        dismissTimerRef.current = null;
      }
    };
  }, []);

  const handleDelete = useCallback(
    (id: string) => {
      const list = document.getElementById("task-list");
      const rows = list ? Array.from(list.querySelectorAll<HTMLElement>("[data-task-id]")) : [];
      const idx = rows.findIndex((el) => el.dataset.taskId === id);

      deleteTodo.mutate(id);

      if (dismissTimerRef.current) clearTimeout(dismissTimerRef.current);

      dispatch({ type: "SHOW" });

      dismissTimerRef.current = setTimeout(() => {
        dispatch({ type: "DISMISS" });
      }, UNDO_TIMEOUT_MS);

      queueMicrotask(() => {
        const updatedList = document.getElementById("task-list");
        const updated = updatedList
          ? Array.from(updatedList.querySelectorAll<HTMLElement>("[data-task-id]"))
          : [];
        const target =
          updated[idx] ??
          updated[idx - 1] ??
          document.querySelector<HTMLElement>("#task-input");
        target?.focus();
      });
    },
    [deleteTodo],
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
          visible={toastStatus === "visible"}
          onUndo={handleUndo}
          onDismiss={handleDismiss}
        />
      </div>
      <TaskList onDelete={handleDelete} />
      <TaskInput />
    </div>
  );
}
