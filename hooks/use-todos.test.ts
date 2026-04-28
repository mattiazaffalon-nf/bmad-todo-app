// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import React from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import * as apiClientModule from "@/lib/api-client";
import type { Todo } from "@/lib/validation";
import { useTodos } from "./use-todos";

vi.mock("@/lib/api-client", () => ({
  apiClient: { listTodos: vi.fn() },
}));

const mockTodos: Todo[] = [
  {
    id: "11111111-1111-4111-8111-111111111111",
    description: "buy milk",
    completed: false,
    createdAt: "2026-04-28T12:00:00.000Z",
    userId: null,
  },
];

const createWrapper = () => {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const Wrapper = ({ children }: { children: React.ReactNode }) =>
    React.createElement(QueryClientProvider, { client: queryClient }, children);
  Wrapper.displayName = "TestQueryClientWrapper";
  return Wrapper;
};

describe("useTodos", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("calls apiClient.listTodos and returns parsed todos", async () => {
    vi.mocked(apiClientModule.apiClient.listTodos).mockResolvedValueOnce(mockTodos);

    const { result } = renderHook(() => useTodos(), { wrapper: createWrapper() });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual(mockTodos);
    expect(apiClientModule.apiClient.listTodos).toHaveBeenCalledOnce();
  });

  it("uses queryKey ['todos']", async () => {
    vi.mocked(apiClientModule.apiClient.listTodos).mockResolvedValueOnce(mockTodos);

    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const Wrapper = ({ children }: { children: React.ReactNode }) =>
      React.createElement(QueryClientProvider, { client: queryClient }, children);
    Wrapper.displayName = "TestQueryClientWrapperLocal";

    const { result } = renderHook(() => useTodos(), { wrapper: Wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    const cachedData = queryClient.getQueryData(["todos"]);
    expect(cachedData).toEqual(mockTodos);
  });
});
