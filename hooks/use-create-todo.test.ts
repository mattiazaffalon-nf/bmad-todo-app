import { renderHook, act, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createElement } from "react";
import { useCreateTodo } from "./use-create-todo";
import { apiClient } from "@/lib/api-client";
import type { OptimisticTodo } from "@/lib/validation";

vi.mock("@/lib/api-client", () => ({
  apiClient: {
    listTodos: vi.fn(),
    createTodo: vi.fn(),
  },
}));

const TEST_ID = "11111111-1111-4111-8111-111111111111";
const SERVER_TODO: OptimisticTodo = {
  id: TEST_ID,
  description: "test",
  completed: false,
  createdAt: "2026-04-28T00:00:00.000Z",
  userId: null,
};

function createWrapper(queryClient: QueryClient) {
  const Wrapper = ({ children }: { children: React.ReactNode }) =>
    createElement(QueryClientProvider, { client: queryClient }, children);
  Wrapper.displayName = "TestWrapper";
  return Wrapper;
}

beforeEach(() => {
  vi.mocked(apiClient.createTodo).mockReset();
});

describe("useCreateTodo", () => {
  it("onMutate prepends optimistic entry with syncStatus pending", async () => {
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    queryClient.setQueryData<OptimisticTodo[]>(["todos"], []);
    vi.mocked(apiClient.createTodo).mockImplementation(() => new Promise(() => {}));

    const { result } = renderHook(() => useCreateTodo(), {
      wrapper: createWrapper(queryClient),
    });

    act(() => {
      result.current.mutate({ id: TEST_ID, description: "test" });
    });

    await waitFor(() => {
      const data = queryClient.getQueryData<OptimisticTodo[]>(["todos"]);
      expect(data?.[0]?.syncStatus).toBe("pending");
    });
  });

  it("onError restores previous cache snapshot", async () => {
    const existing: OptimisticTodo = { ...SERVER_TODO, id: "existing", description: "existing" };
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    queryClient.setQueryData<OptimisticTodo[]>(["todos"], [existing]);

    let rejectMutation!: (err: Error) => void;
    vi.mocked(apiClient.createTodo).mockImplementation(
      () => new Promise((_resolve, reject) => { rejectMutation = reject; }),
    );

    const { result } = renderHook(() => useCreateTodo(), {
      wrapper: createWrapper(queryClient),
    });

    act(() => {
      result.current.mutate({ id: TEST_ID, description: "test" });
    });

    await waitFor(() => {
      const data = queryClient.getQueryData<OptimisticTodo[]>(["todos"]);
      expect(data?.[0]?.syncStatus).toBe("pending");
      expect(data).toHaveLength(2);
    });

    act(() => {
      rejectMutation(new Error("fail"));
    });

    await waitFor(() => expect(result.current.isError).toBe(true));

    const data = queryClient.getQueryData<OptimisticTodo[]>(["todos"]);
    expect(data).toEqual([existing]);
  });

  it("onSuccess replaces optimistic entry with server response and syncStatus idle", async () => {
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    queryClient.setQueryData<OptimisticTodo[]>(["todos"], []);
    vi.mocked(apiClient.createTodo).mockResolvedValue(SERVER_TODO);

    const { result } = renderHook(() => useCreateTodo(), {
      wrapper: createWrapper(queryClient),
    });

    act(() => {
      result.current.mutate({ id: TEST_ID, description: "test" });
    });

    await waitFor(() => result.current.isSuccess);

    const data = queryClient.getQueryData<OptimisticTodo[]>(["todos"]);
    expect(data?.[0]).toEqual({ ...SERVER_TODO, syncStatus: "idle" });
  });
});
