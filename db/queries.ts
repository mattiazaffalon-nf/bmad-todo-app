import { and, desc, eq, isNull } from "drizzle-orm";
import type { TodoCreateInput } from "@/lib/validation";
import { db } from "./client";
import { todos, type Todo } from "./schema";

const userIdFilter = (userId: string | null) =>
  userId === null ? isNull(todos.userId) : eq(todos.userId, userId);

export async function getTodos(userId: string | null): Promise<Todo[]> {
  return db.select().from(todos).where(userIdFilter(userId)).orderBy(desc(todos.createdAt));
}

export async function getTodoById(id: string, userId: string | null): Promise<Todo | null> {
  const [row] = await db
    .select()
    .from(todos)
    .where(and(eq(todos.id, id), userIdFilter(userId)));
  return row ?? null;
}

export async function updateTodo(
  id: string,
  patch: { completed: boolean },
  userId: string | null,
): Promise<Todo | null> {
  const [row] = await db
    .update(todos)
    .set({ completed: patch.completed })
    .where(and(eq(todos.id, id), userIdFilter(userId)))
    .returning();
  return row ?? null;
}

export async function deleteTodo(id: string, userId: string | null): Promise<number> {
  const result = await db
    .delete(todos)
    .where(and(eq(todos.id, id), userIdFilter(userId)))
    .returning();
  return result.length;
}

export async function createTodo(
  input: TodoCreateInput,
  userId: string | null,
): Promise<Todo> {
  const [inserted] = await db
    .insert(todos)
    .values({ ...input, userId })
    .onConflictDoNothing({ target: todos.id })
    .returning();

  if (inserted) return inserted;

  // Conflict path: another row with this id already exists. Return it.
  const existing = await getTodoById(input.id, userId);
  if (!existing) {
    throw new Error(
      `createTodo: insert was a no-op but no existing row found for id=${input.id}`,
    );
  }
  return existing;
}
