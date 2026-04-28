import { useQuery, type UseQueryResult } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";
import type { Todo } from "@/lib/validation";

export function useTodos(): UseQueryResult<Todo[]> {
  return useQuery({
    queryKey: ["todos"],
    queryFn: () => apiClient.listTodos(),
    staleTime: Infinity,
  });
}
