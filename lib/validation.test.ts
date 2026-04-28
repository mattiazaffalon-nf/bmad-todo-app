import { describe, expect, it } from "vitest";
import { TodoApiSchema, TodoCreateSchema, TodoUpdateSchema } from "./validation";

describe("TodoCreateSchema", () => {
  const validId = "11111111-1111-4111-8111-111111111111";

  it("accepts a valid payload", () => {
    const result = TodoCreateSchema.safeParse({ id: validId, description: "buy milk" });
    expect(result.success).toBe(true);
  });

  it("trims surrounding whitespace from description", () => {
    const result = TodoCreateSchema.safeParse({ id: validId, description: "  buy milk  " });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.description).toBe("buy milk");
  });

  it("rejects an empty description", () => {
    const result = TodoCreateSchema.safeParse({ id: validId, description: "" });
    expect(result.success).toBe(false);
  });

  it("rejects a whitespace-only description (after trim)", () => {
    const result = TodoCreateSchema.safeParse({ id: validId, description: "   " });
    expect(result.success).toBe(false);
  });

  it("rejects a description over 280 chars", () => {
    const result = TodoCreateSchema.safeParse({ id: validId, description: "x".repeat(281) });
    expect(result.success).toBe(false);
  });

  it("accepts a description of exactly 280 chars", () => {
    const result = TodoCreateSchema.safeParse({ id: validId, description: "x".repeat(280) });
    expect(result.success).toBe(true);
  });

  it("rejects a non-uuid id", () => {
    const result = TodoCreateSchema.safeParse({ id: "not-a-uuid", description: "buy milk" });
    expect(result.success).toBe(false);
  });

  it("rejects missing id", () => {
    const result = TodoCreateSchema.safeParse({ description: "buy milk" });
    expect(result.success).toBe(false);
  });

  it("rejects missing description", () => {
    const result = TodoCreateSchema.safeParse({ id: validId });
    expect(result.success).toBe(false);
  });

  it("rejects wrong types", () => {
    const result = TodoCreateSchema.safeParse({ id: 123, description: 456 });
    expect(result.success).toBe(false);
  });
});

describe("TodoUpdateSchema", () => {
  it("accepts { completed: true }", () => {
    const result = TodoUpdateSchema.safeParse({ completed: true });
    expect(result.success).toBe(true);
  });

  it("accepts { completed: false }", () => {
    const result = TodoUpdateSchema.safeParse({ completed: false });
    expect(result.success).toBe(true);
  });

  it("rejects non-boolean completed", () => {
    const result = TodoUpdateSchema.safeParse({ completed: "yes" });
    expect(result.success).toBe(false);
  });

  it("rejects missing completed", () => {
    const result = TodoUpdateSchema.safeParse({});
    expect(result.success).toBe(false);
  });
});

describe("TodoApiSchema", () => {
  const validTodo = {
    id: "11111111-1111-4111-8111-111111111111",
    description: "buy milk",
    completed: false,
    createdAt: "2026-04-28T12:00:00.000Z",
    userId: null,
  };

  it("accepts a valid response object", () => {
    const result = TodoApiSchema.safeParse(validTodo);
    expect(result.success).toBe(true);
  });

  it("accepts nullable userId", () => {
    const result = TodoApiSchema.safeParse({ ...validTodo, userId: null });
    expect(result.success).toBe(true);
  });

  it("accepts a uuid userId", () => {
    const result = TodoApiSchema.safeParse({
      ...validTodo,
      userId: "22222222-2222-4222-8222-222222222222",
    });
    expect(result.success).toBe(true);
  });

  it("rejects a non-string createdAt (Date object)", () => {
    const result = TodoApiSchema.safeParse({ ...validTodo, createdAt: new Date() });
    expect(result.success).toBe(false);
  });

  it("rejects missing fields", () => {
    const { description, completed, createdAt, userId } = validTodo;
    const result = TodoApiSchema.safeParse({ description, completed, createdAt, userId });
    expect(result.success).toBe(false);
  });
});

