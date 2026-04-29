import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";
import type { OptimisticTodo } from "@/lib/validation";

export function useToggleTodo() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, completed }: { id: string; completed: boolean }) =>
      apiClient.toggleTodo(id, completed),
    onMutate: async ({ id, completed }) => {
      await queryClient.cancelQueries({ queryKey: ["todos"] });
      const previous = queryClient.getQueryData<OptimisticTodo[]>(["todos"]);
      queryClient.setQueryData<OptimisticTodo[]>(["todos"], (old = []) =>
        old.map((t) => (t.id === id ? { ...t, completed, syncStatus: "pending" } : t)),
      );
      return { previous };
    },
    onError: (_err, variables) => {
      queryClient.setQueryData<OptimisticTodo[]>(["todos"], (old = []) =>
        old.map((t) => (t.id === variables.id ? { ...t, syncStatus: "failed" as const, failedMutation: "toggle" as const } : t)),
      );
    },
    onSuccess: (serverTodo, { id }) => {
      queryClient.setQueryData<OptimisticTodo[]>(["todos"], (old = []) =>
        old.map((t) => (t.id === id ? { ...serverTodo, syncStatus: "idle" } : t)),
      );
    },
    retry: false,
  });
}
