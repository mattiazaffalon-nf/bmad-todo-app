import { z } from "zod";
import { TodoApiSchema, type Todo } from "./validation";

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

async function fetchJson<T>(url: string, schema: z.ZodType<T>): Promise<T> {
  const res = await fetch(url);
  if (!res.ok) {
    throw new ApiError(res.status, `HTTP ${res.status}`);
  }
  return schema.parse(await res.json());
}

export const apiClient = {
  async listTodos(): Promise<Todo[]> {
    const body = await fetchJson("/api/todos", z.object({ todos: z.array(TodoApiSchema) }));
    return body.todos;
  },
};
