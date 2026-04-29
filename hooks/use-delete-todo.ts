"use client";

import { useCallback, useEffect, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";
import { UNDO_TIMEOUT_MS } from "@/lib/constants";
import type { OptimisticTodo } from "@/lib/validation";

export function useDeleteTodo() {
  const queryClient = useQueryClient();
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const snapshotRef = useRef<OptimisticTodo[] | null>(null);

  useEffect(() => {
    return () => {
      if (timerRef.current !== null) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
    };
  }, []);

  const mutate = useCallback(
    (id: string) => {
      void queryClient.cancelQueries({ queryKey: ["todos"] });
      const previous = queryClient.getQueryData<OptimisticTodo[]>(["todos"]) ?? [];
      queryClient.setQueryData<OptimisticTodo[]>(["todos"], (old = []) =>
        old.filter((t) => t.id !== id),
      );
      snapshotRef.current = previous;

      timerRef.current = setTimeout(async () => {
        timerRef.current = null;
        try {
          await apiClient.deleteTodo(id);
        } catch {
          queryClient.setQueryData<OptimisticTodo[]>(["todos"], (old = []) => {
            const restoredTodo = previous.find((t) => t.id === id);
            if (!restoredTodo) return old;
            return [...old, { ...restoredTodo, syncStatus: "failed" as const }];
          });
        }
      }, UNDO_TIMEOUT_MS);
    },
    [queryClient],
  );

  const undo = useCallback(() => {
    if (timerRef.current !== null) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    if (snapshotRef.current !== null) {
      queryClient.setQueryData<OptimisticTodo[]>(["todos"], snapshotRef.current);
      snapshotRef.current = null;
    }
  }, [queryClient]);

  return { mutate, undo };
}
