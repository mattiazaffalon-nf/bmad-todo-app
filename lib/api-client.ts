import { z } from "zod";
import { TodoApiSchema, type Todo, type TodoCreateInput } from "./validation";

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

  async createTodo(input: TodoCreateInput): Promise<Todo> {
    const res = await fetch("/api/todos", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(input),
    });
    if (!res.ok) throw new ApiError(res.status, `HTTP ${res.status}`);
    const body = z.object({ todo: TodoApiSchema }).parse(await res.json());
    return body.todo;
  },

  async toggleTodo(id: string, completed: boolean): Promise<Todo> {
    const res = await fetch(`/api/todos/${id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ completed }),
    });
    if (!res.ok) throw new ApiError(res.status, `HTTP ${res.status}`);
    const body = z.object({ todo: TodoApiSchema }).parse(await res.json());
    return body.todo;
  },
};
