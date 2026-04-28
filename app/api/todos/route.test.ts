// @vitest-environment node
import { sql } from "drizzle-orm";
import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { db } from "@/db/client";
import * as queries from "@/db/queries";
import { GET, POST } from "./route";

const uuid = () => crypto.randomUUID();
const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

const post = (body: unknown) =>
  POST(
    new Request("http://localhost/api/todos", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: typeof body === "string" ? body : JSON.stringify(body),
    }),
  );

describe("app/api/todos route handlers", () => {
  beforeEach(async () => {
    await db.execute(sql`TRUNCATE TABLE todos`);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  afterAll(async () => {
    const client = (db as unknown as { $client: { end?: () => Promise<void> } }).$client;
    await client.end?.();
  });

  describe("GET /api/todos", () => {
    it("returns 200 with an empty list when no todos exist", async () => {
      const res = await GET();
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body).toEqual({ todos: [] });
    });

    it("returns todos newest-first with ISO 8601 createdAt strings and camelCase fields", async () => {
      const first = uuid();
      const second = uuid();
      const third = uuid();

      await queries.createTodo({ id: first, description: "first" }, null);
      await sleep(10);
      await queries.createTodo({ id: second, description: "second" }, null);
      await sleep(10);
      await queries.createTodo({ id: third, description: "third" }, null);

      const res = await GET();
      expect(res.status).toBe(200);
      const body = await res.json();

      expect(body.todos).toHaveLength(3);
      expect(body.todos.map((t: { id: string }) => t.id)).toEqual([third, second, first]);

      const top = body.todos[0];
      expect(top).toMatchObject({
        id: third,
        description: "third",
        completed: false,
        userId: null,
      });
      // createdAt is a parseable ISO 8601 string with timezone (the trailing "Z" or "+00:00").
      expect(typeof top.createdAt).toBe("string");
      expect(Number.isNaN(Date.parse(top.createdAt))).toBe(false);
      expect(top.createdAt).toMatch(/[T].+(Z|[+-]\d{2}:\d{2})$/);
    });

    it("returns 500 when the query layer throws", async () => {
      const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
      vi.spyOn(queries, "getTodos").mockRejectedValueOnce(new Error("boom"));

      const res = await GET();
      expect(res.status).toBe(500);
      const body = await res.json();
      expect(body).toEqual({ code: "internal_error", message: "Something went wrong" });
      expect(errorSpy).toHaveBeenCalled();
    });
  });

  describe("POST /api/todos", () => {
    it("creates a new todo and returns 201 with the row", async () => {
      const id = uuid();
      const res = await post({ id, description: "buy milk" });
      expect(res.status).toBe(201);
      const body = await res.json();
      expect(body.todo).toMatchObject({
        id,
        description: "buy milk",
        completed: false,
        userId: null,
      });
      expect(typeof body.todo.createdAt).toBe("string");
      expect(Number.isNaN(Date.parse(body.todo.createdAt))).toBe(false);

      const persisted = await queries.getTodos(null);
      expect(persisted).toHaveLength(1);
      expect(persisted[0].id).toBe(id);
    });

    it("is idempotent on duplicate id: second POST returns 200 with the existing row", async () => {
      const id = uuid();
      const description = "buy milk";

      const first = await post({ id, description });
      expect(first.status).toBe(201);
      const firstBody = await first.json();

      const second = await post({ id, description });
      expect(second.status).toBe(200);
      const secondBody = await second.json();

      expect(secondBody.todo.id).toBe(firstBody.todo.id);
      expect(secondBody.todo.description).toBe(firstBody.todo.description);
      expect(secondBody.todo.createdAt).toBe(firstBody.todo.createdAt);

      const rows = await queries.getTodos(null);
      expect(rows).toHaveLength(1);
    });

    it("idempotent path returns the original row even if the retry body differs", async () => {
      const id = uuid();
      const first = await post({ id, description: "original" });
      expect(first.status).toBe(201);

      const second = await post({ id, description: "replacement" });
      expect(second.status).toBe(200);
      const body = await second.json();
      expect(body.todo.description).toBe("original");
    });

    it("returns 400 validation_failed for a non-uuid id", async () => {
      const res = await post({ id: "not-a-uuid", description: "buy milk" });
      expect(res.status).toBe(400);
      const body = await res.json();
      expect(body.code).toBe("validation_failed");
      expect(typeof body.message).toBe("string");
    });

    it("returns 400 validation_failed for an empty description", async () => {
      const res = await post({ id: uuid(), description: "" });
      expect(res.status).toBe(400);
      const body = await res.json();
      expect(body.code).toBe("validation_failed");
    });

    it("returns 400 validation_failed for a whitespace-only description", async () => {
      const res = await post({ id: uuid(), description: "   " });
      expect(res.status).toBe(400);
      const body = await res.json();
      expect(body.code).toBe("validation_failed");
    });

    it("returns 400 validation_failed for description > 280 chars", async () => {
      const res = await post({ id: uuid(), description: "x".repeat(281) });
      expect(res.status).toBe(400);
      const body = await res.json();
      expect(body.code).toBe("validation_failed");
    });

    it("returns 400 validation_failed for missing fields", async () => {
      const res = await post({});
      expect(res.status).toBe(400);
      const body = await res.json();
      expect(body.code).toBe("validation_failed");
    });

    it("returns 400 validation_failed for wrong field types (id as number, description as boolean)", async () => {
      const res = await post({ id: 123, description: true });
      expect(res.status).toBe(400);
      const body = await res.json();
      expect(body.code).toBe("validation_failed");
    });

    it("returns 400 validation_failed when the body is not valid JSON", async () => {
      const res = await POST(
        new Request("http://localhost/api/todos", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: "{not json",
        }),
      );
      expect(res.status).toBe(400);
      const body = await res.json();
      expect(body.code).toBe("validation_failed");
    });

    it("does not touch the DB on validation failure", async () => {
      const insertSpy = vi.spyOn(queries, "createTodo");
      const res = await post({ id: "not-a-uuid", description: "" });
      expect(res.status).toBe(400);
      expect(insertSpy).not.toHaveBeenCalled();
      const rows = await queries.getTodos(null);
      expect(rows).toHaveLength(0);
    });

    it("returns 500 internal_error when the DB layer throws", async () => {
      const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
      vi.spyOn(queries, "getTodoById").mockResolvedValueOnce(null);
      vi.spyOn(queries, "createTodo").mockRejectedValueOnce(new Error("boom"));

      const res = await post({ id: uuid(), description: "buy milk" });
      expect(res.status).toBe(500);
      const body = await res.json();
      expect(body).toEqual({ code: "internal_error", message: "Something went wrong" });
      expect(errorSpy).toHaveBeenCalled();
    });
  });
});
