import { renderHook, act } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createElement } from "react";
import { useDeleteTodo } from "./use-delete-todo";
import { apiClient } from "@/lib/api-client";
import type { OptimisticTodo } from "@/lib/validation";
import { UNDO_TIMEOUT_MS } from "@/lib/constants";

vi.mock("@/lib/api-client", () => ({
  apiClient: {
    listTodos: vi.fn(),
    createTodo: vi.fn(),
    toggleTodo: vi.fn(),
    deleteTodo: vi.fn(),
  },
}));

const TEST_ID = "22222222-2222-4222-8222-222222222222";
const EXISTING_TODO: OptimisticTodo = {
  id: TEST_ID,
  description: "task to delete",
  completed: false,
  createdAt: "2026-04-29T00:00:00.000Z",
  userId: null,
  syncStatus: "idle",
};

function createWrapper(queryClient: QueryClient) {
  const Wrapper = ({ children }: { children: React.ReactNode }) =>
    createElement(QueryClientProvider, { client: queryClient }, children);
  Wrapper.displayName = "TestWrapper";
  return Wrapper;
}

function makeQueryClient() {
  return new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.mocked(apiClient.deleteTodo).mockReset();
});

afterEach(() => {
  vi.useRealTimers();
});

describe("useDeleteTodo", () => {
  it("mutate optimistically removes the todo from cache immediately", () => {
    const queryClient = makeQueryClient();
    queryClient.setQueryData<OptimisticTodo[]>(["todos"], [EXISTING_TODO]);

    const { result } = renderHook(() => useDeleteTodo(), {
      wrapper: createWrapper(queryClient),
    });

    act(() => {
      result.current.mutate(TEST_ID);
    });

    const data = queryClient.getQueryData<OptimisticTodo[]>(["todos"]);
    expect(data).toEqual([]);
  });

  it("undo restores the cache snapshot and clears the timer", async () => {
    const queryClient = makeQueryClient();
    queryClient.setQueryData<OptimisticTodo[]>(["todos"], [EXISTING_TODO]);
    vi.mocked(apiClient.deleteTodo).mockResolvedValue();

    const { result } = renderHook(() => useDeleteTodo(), {
      wrapper: createWrapper(queryClient),
    });

    act(() => {
      result.current.mutate(TEST_ID);
    });

    act(() => {
      result.current.undo();
    });

    const data = queryClient.getQueryData<OptimisticTodo[]>(["todos"]);
    expect(data).toEqual([EXISTING_TODO]);

    // Advance timer — DELETE should NOT have fired
    await act(async () => {
      vi.advanceTimersByTime(UNDO_TIMEOUT_MS + 100);
    });

    expect(apiClient.deleteTodo).not.toHaveBeenCalled();
  });

  it("fires apiClient.deleteTodo after UNDO_TIMEOUT_MS when not undone", async () => {
    const queryClient = makeQueryClient();
    queryClient.setQueryData<OptimisticTodo[]>(["todos"], [EXISTING_TODO]);
    vi.mocked(apiClient.deleteTodo).mockResolvedValue();

    const { result } = renderHook(() => useDeleteTodo(), {
      wrapper: createWrapper(queryClient),
    });

    act(() => {
      result.current.mutate(TEST_ID);
    });

    await act(async () => {
      vi.advanceTimersByTime(UNDO_TIMEOUT_MS);
    });

    expect(apiClient.deleteTodo).toHaveBeenCalledWith(TEST_ID);
    expect(apiClient.deleteTodo).toHaveBeenCalledTimes(1);
  });

  it("on DELETE failure after timeout, re-adds todo with syncStatus: failed", async () => {
    const queryClient = makeQueryClient();
    queryClient.setQueryData<OptimisticTodo[]>(["todos"], [EXISTING_TODO]);
    vi.mocked(apiClient.deleteTodo).mockRejectedValue(new Error("network error"));

    const { result } = renderHook(() => useDeleteTodo(), {
      wrapper: createWrapper(queryClient),
    });

    act(() => {
      result.current.mutate(TEST_ID);
    });

    // Cache is empty right after optimistic remove
    expect(queryClient.getQueryData<OptimisticTodo[]>(["todos"])).toEqual([]);

    await act(async () => {
      vi.advanceTimersByTime(UNDO_TIMEOUT_MS);
    });

    const data = queryClient.getQueryData<OptimisticTodo[]>(["todos"]);
    expect(data).toHaveLength(1);
    expect(data?.[0]?.id).toBe(TEST_ID);
    expect(data?.[0]?.syncStatus).toBe("failed");
    expect(data?.[0]?.failedMutation).toBe("delete");
  });

  it("retryDelete sets syncStatus pending then removes entry on success", async () => {
    const failedTodo: OptimisticTodo = { ...EXISTING_TODO, syncStatus: "failed", failedMutation: "delete" };
    const queryClient = makeQueryClient();
    queryClient.setQueryData<OptimisticTodo[]>(["todos"], [failedTodo]);
    vi.mocked(apiClient.deleteTodo).mockResolvedValue();

    const { result } = renderHook(() => useDeleteTodo(), {
      wrapper: createWrapper(queryClient),
    });

    await act(async () => {
      await result.current.retryDelete(TEST_ID);
    });

    expect(apiClient.deleteTodo).toHaveBeenCalledWith(TEST_ID);
    const data = queryClient.getQueryData<OptimisticTodo[]>(["todos"]);
    expect(data).toEqual([]);
  });

  it("retryDelete sets syncStatus failed with failedMutation delete on repeated failure", async () => {
    const failedTodo: OptimisticTodo = { ...EXISTING_TODO, syncStatus: "failed", failedMutation: "delete" };
    const queryClient = makeQueryClient();
    queryClient.setQueryData<OptimisticTodo[]>(["todos"], [failedTodo]);
    vi.mocked(apiClient.deleteTodo).mockRejectedValue(new Error("still failing"));

    const { result } = renderHook(() => useDeleteTodo(), {
      wrapper: createWrapper(queryClient),
    });

    await act(async () => {
      await result.current.retryDelete(TEST_ID);
    });

    const data = queryClient.getQueryData<OptimisticTodo[]>(["todos"]);
    expect(data?.[0]?.syncStatus).toBe("failed");
    expect(data?.[0]?.failedMutation).toBe("delete");
  });

  it("second mutate while first timer is pending does not cancel the first timer", async () => {
    const SECOND_ID = "33333333-3333-4333-8333-333333333333";
    const secondTodo: OptimisticTodo = {
      ...EXISTING_TODO,
      id: SECOND_ID,
      description: "second task",
    };
    const queryClient = makeQueryClient();
    queryClient.setQueryData<OptimisticTodo[]>(["todos"], [EXISTING_TODO, secondTodo]);
    vi.mocked(apiClient.deleteTodo).mockResolvedValue();

    const { result } = renderHook(() => useDeleteTodo(), {
      wrapper: createWrapper(queryClient),
    });

    act(() => {
      result.current.mutate(TEST_ID);
    });

    // Second delete at 2s into the 5s window
    act(() => {
      vi.advanceTimersByTime(2000);
      result.current.mutate(SECOND_ID);
    });

    // At 5s mark (3s after second mutate) — first timer fires
    await act(async () => {
      vi.advanceTimersByTime(3000);
    });

    expect(apiClient.deleteTodo).toHaveBeenCalledWith(TEST_ID);

    // At 7s total — second timer fires
    await act(async () => {
      vi.advanceTimersByTime(2000);
    });

    expect(apiClient.deleteTodo).toHaveBeenCalledWith(SECOND_ID);
    expect(apiClient.deleteTodo).toHaveBeenCalledTimes(2);
  });
});
