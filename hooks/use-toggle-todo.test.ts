import { renderHook, act, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createElement } from "react";
import { useToggleTodo } from "./use-toggle-todo";
import { apiClient } from "@/lib/api-client";
import type { OptimisticTodo } from "@/lib/validation";

vi.mock("@/lib/api-client", () => ({
  apiClient: {
    listTodos: vi.fn(),
    createTodo: vi.fn(),
    toggleTodo: vi.fn(),
  },
}));

const TEST_ID = "11111111-1111-4111-8111-111111111111";
const SERVER_TODO: OptimisticTodo = {
  id: TEST_ID,
  description: "test",
  completed: true,
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
  vi.mocked(apiClient.toggleTodo).mockReset();
});

describe("useToggleTodo", () => {
  it("onMutate optimistically flips completed and sets syncStatus pending", async () => {
    const existing: OptimisticTodo = { ...SERVER_TODO, completed: false, syncStatus: "idle" };
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    queryClient.setQueryData<OptimisticTodo[]>(["todos"], [existing]);
    vi.mocked(apiClient.toggleTodo).mockImplementation(() => new Promise(() => {}));

    const { result } = renderHook(() => useToggleTodo(), {
      wrapper: createWrapper(queryClient),
    });

    act(() => {
      result.current.mutate({ id: TEST_ID, completed: true });
    });

    await waitFor(() => {
      const data = queryClient.getQueryData<OptimisticTodo[]>(["todos"]);
      expect(data?.[0]?.completed).toBe(true);
      expect(data?.[0]?.syncStatus).toBe("pending");
    });
  });

  it("onError marks the entry syncStatus:'failed' keeping intended completed value (task stays in list)", async () => {
    const existing: OptimisticTodo = { ...SERVER_TODO, completed: false, syncStatus: "idle" };
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    queryClient.setQueryData<OptimisticTodo[]>(["todos"], [existing]);

    let rejectMutation!: (err: Error) => void;
    vi.mocked(apiClient.toggleTodo).mockImplementation(
      () => new Promise((_resolve, reject) => { rejectMutation = reject; }),
    );

    const { result } = renderHook(() => useToggleTodo(), {
      wrapper: createWrapper(queryClient),
    });

    act(() => {
      result.current.mutate({ id: TEST_ID, completed: true });
    });

    await waitFor(() => {
      const data = queryClient.getQueryData<OptimisticTodo[]>(["todos"]);
      expect(data?.[0]?.syncStatus).toBe("pending");
    });

    act(() => {
      rejectMutation(new Error("fail"));
    });

    await waitFor(() => expect(result.current.isError).toBe(true));

    const data = queryClient.getQueryData<OptimisticTodo[]>(["todos"]);
    // Entry stays in the list (not rolled back) with failed status and intended completed value
    expect(data).toHaveLength(1);
    expect(data?.[0]?.syncStatus).toBe("failed");
    expect(data?.[0]?.completed).toBe(true); // intended value preserved
  });

  it("onSuccess replaces cache entry with server response and syncStatus idle", async () => {
    const existing: OptimisticTodo = { ...SERVER_TODO, completed: false, syncStatus: "idle" };
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    queryClient.setQueryData<OptimisticTodo[]>(["todos"], [existing]);
    vi.mocked(apiClient.toggleTodo).mockResolvedValue(SERVER_TODO);

    const { result } = renderHook(() => useToggleTodo(), {
      wrapper: createWrapper(queryClient),
    });

    act(() => {
      result.current.mutate({ id: TEST_ID, completed: true });
    });

    await waitFor(() => result.current.isSuccess);

    const data = queryClient.getQueryData<OptimisticTodo[]>(["todos"]);
    expect(data?.[0]).toEqual({ ...SERVER_TODO, syncStatus: "idle" });
  });
});
