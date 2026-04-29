import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";
import type { TodoCreateInput, OptimisticTodo } from "@/lib/validation";

export function useCreateTodo() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: TodoCreateInput) => apiClient.createTodo(input),
    onMutate: async (input) => {
      await queryClient.cancelQueries({ queryKey: ["todos"] });
      const previous = queryClient.getQueryData<OptimisticTodo[]>(["todos"]);
      queryClient.setQueryData<OptimisticTodo[]>(["todos"], (old = []) => [
        {
          ...input,
          completed: false,
          createdAt: new Date().toISOString(),
          userId: null,
          syncStatus: "pending",
        },
        ...old,
      ]);
      return { previous };
    },
    onError: (_err, input) => {
      queryClient.setQueryData<OptimisticTodo[]>(["todos"], (old = []) =>
        old.map((t) => (t.id === input.id ? { ...t, syncStatus: "failed" as const } : t)),
      );
    },
    onSuccess: (serverTodo, input) => {
      queryClient.setQueryData<OptimisticTodo[]>(["todos"], (old = []) =>
        old.map((t) => (t.id === input.id ? { ...serverTodo, syncStatus: "idle" } : t)),
      );
    },
    retry: false,
  });
}
