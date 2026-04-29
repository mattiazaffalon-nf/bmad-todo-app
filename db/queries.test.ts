// @vitest-environment node
import { sql } from "drizzle-orm";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { db } from "./client";
import { createTodo, deleteTodo, getTodoById, getTodos, updateTodo } from "./queries";

const uuid = () => crypto.randomUUID();
const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

describe("db/queries", () => {
  beforeEach(async () => {
    await db.execute(sql`TRUNCATE TABLE todos`);
  });

  afterAll(async () => {
    // Drizzle's node-postgres adapter holds a Pool internally; close it so vitest exits.
    // Using $client to access the underlying pg.Pool.
    const client = (db as unknown as { $client: { end?: () => Promise<void> } }).$client;
    await client.end?.();
  });

  it("createTodo inserts a row that getTodos returns", async () => {
    const id = uuid();
    const created = await createTodo({ id, description: "buy milk" }, null);

    expect(created.id).toBe(id);
    expect(created.description).toBe("buy milk");
    expect(created.completed).toBe(false);
    expect(created.userId).toBeNull();
    expect(created.createdAt).toBeInstanceOf(Date);
    expect(Date.now() - created.createdAt.getTime()).toBeLessThan(5000);

    const rows = await getTodos(null);
    expect(rows).toHaveLength(1);
    expect(rows[0].id).toBe(id);
  });

  it("getTodos returns rows newest-first", async () => {
    const first = uuid();
    const second = uuid();
    const third = uuid();

    await createTodo({ id: first, description: "first" }, null);
    await sleep(10);
    await createTodo({ id: second, description: "second" }, null);
    await sleep(10);
    await createTodo({ id: third, description: "third" }, null);

    const rows = await getTodos(null);
    expect(rows.map((r) => r.id)).toEqual([third, second, first]);
  });

  it("createTodo is idempotent on duplicate id", async () => {
    const id = uuid();
    const first = await createTodo({ id, description: "buy milk" }, null);
    const second = await createTodo({ id, description: "buy milk" }, null);

    expect(second.id).toBe(first.id);
    expect(second.description).toBe(first.description);
    expect(second.createdAt.getTime()).toBe(first.createdAt.getTime());

    const rows = await getTodos(null);
    expect(rows).toHaveLength(1);
  });

  it("createTodo idempotent path returns the original row even when retried with a different description", async () => {
    const id = uuid();
    const first = await createTodo({ id, description: "original" }, null);
    const second = await createTodo({ id, description: "replacement" }, null);

    expect(second.id).toBe(first.id);
    expect(second.description).toBe("original");

    const rows = await getTodos(null);
    expect(rows).toHaveLength(1);
    expect(rows[0].description).toBe("original");
  });

  it("getTodoById returns the row when it exists", async () => {
    const id = uuid();
    await createTodo({ id, description: "buy milk" }, null);

    const row = await getTodoById(id, null);
    expect(row).not.toBeNull();
    expect(row?.id).toBe(id);
  });

  it("getTodoById returns null when no row exists", async () => {
    const row = await getTodoById(uuid(), null);
    expect(row).toBeNull();
  });

  it("updateTodo flips completed and returns the updated row", async () => {
    const id = uuid();
    await createTodo({ id, description: "buy milk" }, null);

    const updated = await updateTodo(id, { completed: true }, null);
    expect(updated).not.toBeNull();
    expect(updated?.id).toBe(id);
    expect(updated?.completed).toBe(true);

    const persisted = await getTodoById(id, null);
    expect(persisted?.completed).toBe(true);
  });

  it("updateTodo returns null when no row matches the supplied id", async () => {
    const result = await updateTodo(uuid(), { completed: true }, null);
    expect(result).toBeNull();
  });

  it("updateTodo is idempotent: same payload twice returns the same completed state", async () => {
    const id = uuid();
    await createTodo({ id, description: "buy milk" }, null);

    const first = await updateTodo(id, { completed: true }, null);
    const second = await updateTodo(id, { completed: true }, null);

    expect(first?.completed).toBe(true);
    expect(second?.completed).toBe(true);
    expect(second?.id).toBe(first?.id);
  });

  it("updateTodo only mutates the targeted row", async () => {
    const a = uuid();
    const b = uuid();
    await createTodo({ id: a, description: "a" }, null);
    await createTodo({ id: b, description: "b" }, null);

    await updateTodo(a, { completed: true }, null);

    const rowB = await getTodoById(b, null);
    expect(rowB?.completed).toBe(false);
  });

  it("deleteTodo removes the row and returns 1", async () => {
    const id = uuid();
    await createTodo({ id, description: "to delete" }, null);

    const affected = await deleteTodo(id, null);
    expect(affected).toBe(1);

    const persisted = await getTodoById(id, null);
    expect(persisted).toBeNull();
  });

  it("deleteTodo returns 0 when no row matches the supplied id", async () => {
    const affected = await deleteTodo(uuid(), null);
    expect(affected).toBe(0);
  });

  it("deleteTodo only removes the targeted row", async () => {
    const a = uuid();
    const b = uuid();
    await createTodo({ id: a, description: "a" }, null);
    await createTodo({ id: b, description: "b" }, null);

    await deleteTodo(a, null);

    const rowB = await getTodoById(b, null);
    expect(rowB).not.toBeNull();
    expect(rowB?.id).toBe(b);
  });
});
