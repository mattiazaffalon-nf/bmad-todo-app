import { test, expect } from "@playwright/test";
import { cleanupTodos, seedTodo } from "./fixtures/test-db";

test.beforeEach(async () => {
  await cleanupTodos();
});

test("Journey 1: first-time capture persists across reload", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator("#empty-state-hint")).toBeVisible();

  const input = page.getByRole("textbox", { name: /new task/i });
  await input.fill("buy groceries");

  const responsePromise = page.waitForResponse((r) => r.url().includes("/api/todos") && r.request().method() === "POST");
  await input.press("Enter");
  await responsePromise;

  await expect(page.getByRole("list")).toContainText("buy groceries");

  await page.reload();
  await expect(page.getByRole("list")).toContainText("buy groceries");
});

test("Journey 2: new task prepends above existing seed todo", async ({ page }) => {
  const seedId = "22222222-2222-4222-8222-222222222222";
  await seedTodo(seedId, "existing task");

  await page.goto("/");
  await expect(page.getByRole("list")).toContainText("existing task");

  const input = page.getByRole("textbox", { name: /new task/i });
  await input.fill("new task");
  await input.press("Enter");

  const items = page.getByRole("listitem");
  await expect(items.first()).toContainText("new task");
  await expect(items.nth(1)).toContainText("existing task");
});
