import { useQuery, type UseQueryResult } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";
import type { OptimisticTodo } from "@/lib/validation";

export function useTodos(): UseQueryResult<OptimisticTodo[]> {
  return useQuery({
    queryKey: ["todos"],
    queryFn: () => apiClient.listTodos(),
    staleTime: Infinity,
  });
}
