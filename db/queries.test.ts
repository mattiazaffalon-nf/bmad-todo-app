import { sql } from "drizzle-orm";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { db } from "./client";
import { createTodo, getTodoById, getTodos } from "./queries";

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
});
