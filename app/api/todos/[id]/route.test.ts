// @vitest-environment node
import { sql } from "drizzle-orm";
import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { db } from "@/db/client";
import * as queries from "@/db/queries";
import { DELETE, PATCH } from "./route";

const uuid = () => crypto.randomUUID();

const del = (id: string) =>
  DELETE(
    new Request(`http://localhost/api/todos/${id}`, { method: "DELETE" }),
    { params: Promise.resolve({ id }) } as never,
  );

const patch = (id: string, body: unknown) =>
  PATCH(
    new Request(`http://localhost/api/todos/${id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: typeof body === "string" ? body : JSON.stringify(body),
    }),
    { params: Promise.resolve({ id }) } as never,
  );

describe("app/api/todos/[id] route handlers", () => {
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

  describe("PATCH /api/todos/[id]", () => {
    it("flips completed from false to true and returns 200 with the updated row", async () => {
      const id = uuid();
      await queries.createTodo({ id, description: "buy milk" }, null);

      const res = await patch(id, { completed: true });
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.todo).toMatchObject({
        id,
        description: "buy milk",
        completed: true,
        userId: null,
      });
      expect(typeof body.todo.createdAt).toBe("string");
      expect(Number.isNaN(Date.parse(body.todo.createdAt))).toBe(false);
    });

    it("flips completed from true to false and returns 200 with the updated row", async () => {
      const id = uuid();
      await queries.createTodo({ id, description: "buy milk" }, null);
      await queries.updateTodo(id, { completed: true }, null);

      const res = await patch(id, { completed: false });
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.todo.completed).toBe(false);
    });

    it("is idempotent: same payload twice returns 200 with identical bodies", async () => {
      const id = uuid();
      await queries.createTodo({ id, description: "buy milk" }, null);

      const first = await patch(id, { completed: true });
      const second = await patch(id, { completed: true });

      expect(first.status).toBe(200);
      expect(second.status).toBe(200);
      const firstBody = await first.json();
      const secondBody = await second.json();
      expect(secondBody.todo).toEqual(firstBody.todo);
    });

    it("returns 404 not_found when no row matches the supplied id", async () => {
      const res = await patch(uuid(), { completed: true });
      expect(res.status).toBe(404);
      const body = await res.json();
      expect(body).toEqual({ code: "not_found", message: "Todo not found" });
    });

    it("returns 400 validation_failed for a malformed id route param and does not touch the DB", async () => {
      const updateSpy = vi.spyOn(queries, "updateTodo");
      const res = await patch("not-a-uuid", { completed: true });
      expect(res.status).toBe(400);
      const body = await res.json();
      expect(body.code).toBe("validation_failed");
      expect(updateSpy).not.toHaveBeenCalled();
    });

    it("returns 400 validation_failed for a non-boolean completed field", async () => {
      const id = uuid();
      await queries.createTodo({ id, description: "buy milk" }, null);

      const res = await patch(id, { completed: "yes" });
      expect(res.status).toBe(400);
      const body = await res.json();
      expect(body.code).toBe("validation_failed");
    });

    it("returns 400 validation_failed for a missing completed field", async () => {
      const id = uuid();
      await queries.createTodo({ id, description: "buy milk" }, null);

      const res = await patch(id, {});
      expect(res.status).toBe(400);
      const body = await res.json();
      expect(body.code).toBe("validation_failed");
    });

    it("returns 400 validation_failed for completed = 1 (number, not boolean)", async () => {
      const id = uuid();
      await queries.createTodo({ id, description: "buy milk" }, null);

      const res = await patch(id, { completed: 1 });
      expect(res.status).toBe(400);
      const body = await res.json();
      expect(body.code).toBe("validation_failed");
    });

    it("returns 400 validation_failed when the body is not valid JSON", async () => {
      const id = uuid();
      const res = await PATCH(
        new Request(`http://localhost/api/todos/${id}`, {
          method: "PATCH",
          headers: { "content-type": "application/json" },
          body: "{not json",
        }),
        { params: Promise.resolve({ id }) } as never,
      );
      expect(res.status).toBe(400);
      const body = await res.json();
      expect(body.code).toBe("validation_failed");
    });

    it("returns 500 internal_error when the DB layer throws", async () => {
      const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
      vi.spyOn(queries, "updateTodo").mockRejectedValueOnce(new Error("boom"));

      const id = uuid();
      const res = await patch(id, { completed: true });
      expect(res.status).toBe(500);
      const body = await res.json();
      expect(body).toEqual({ code: "internal_error", message: "Something went wrong" });
      expect(errorSpy).toHaveBeenCalled();
    });
  });

  describe("DELETE /api/todos/[id]", () => {
    it("removes a row and returns 204", async () => {
      const id = uuid();
      await queries.createTodo({ id, description: "to delete" }, null);
      const res = await del(id);
      expect(res.status).toBe(204);
    });

    it("returns 204 for an already-deleted id (idempotent)", async () => {
      const id = uuid();
      await queries.createTodo({ id, description: "to delete" }, null);
      await del(id);
      const res = await del(id);
      expect(res.status).toBe(204);
    });

    it("returns 400 validation_failed for a malformed id and does not touch the DB", async () => {
      const deleteSpy = vi.spyOn(queries, "deleteTodo");
      const res = await del("not-a-uuid");
      expect(res.status).toBe(400);
      const body = await res.json();
      expect(body.code).toBe("validation_failed");
      expect(deleteSpy).not.toHaveBeenCalled();
    });

    it("returns 500 internal_error when the DB layer throws", async () => {
      const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
      vi.spyOn(queries, "deleteTodo").mockRejectedValueOnce(new Error("boom"));
      const res = await del(uuid());
      expect(res.status).toBe(500);
      const body = await res.json();
      expect(body).toEqual({ code: "internal_error", message: "Something went wrong" });
      expect(errorSpy).toHaveBeenCalled();
    });
  });
});
