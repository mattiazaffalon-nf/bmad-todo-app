import { desc, eq, isNull } from "drizzle-orm";
import { db } from "./client";
import { todos, type Todo, type TodoInsert } from "./schema";

export type TodoCreateInput = Pick<TodoInsert, "id" | "description">;

export async function getTodos(userId: string | null): Promise<Todo[]> {
  const userIdMatch = userId === null ? isNull(todos.userId) : eq(todos.userId, userId);
  return db.select().from(todos).where(userIdMatch).orderBy(desc(todos.createdAt));
}

export async function createTodo(
  input: TodoCreateInput,
  userId: string | null,
): Promise<Todo> {
  const [row] = await db
    .insert(todos)
    .values({ ...input, userId })
    .returning();
  return row;
}
