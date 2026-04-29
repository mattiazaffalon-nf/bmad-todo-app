import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { cleanupTodos, seedTodo } from "./fixtures/test-db";

test.beforeEach(async () => {
  await cleanupTodos();
});

test("a11y: empty state has zero axe violations", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator("#empty-state-hint")).toBeVisible();

  const results = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
    .analyze();

  expect(results.violations).toEqual([]);
});

test("a11y: completed-task state has zero axe violations", async ({ page }) => {
  const id = "66666666-6666-4666-8666-666666666666";
  await seedTodo(id, "axe scan target");
  await page.goto("/");

  const row = page.getByRole("listitem").filter({ hasText: "axe scan target" });
  await expect(row).toBeVisible();

  const patchPromise = page.waitForResponse(
    (r) => /\/api\/todos\/[^/]+$/.test(r.url()) && r.request().method() === "PATCH",
  );
  await row.getByRole("button", { name: /mark task complete/i }).click();
  await patchPromise;

  await expect(row.locator("p")).toHaveClass(/line-through/);

  const results = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
    .analyze();

  expect(results.violations).toEqual([]);
});

test("a11y: UndoToast visible state has zero axe violations", async ({ page }) => {
  const id = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
  await seedTodo(id, "axe delete toast target");
  await page.goto("/");

  const row = page.getByRole("listitem").filter({ hasText: "axe delete toast target" });
  await expect(row).toBeVisible();

  await row.getByRole("button", { name: /delete task/i }).click({ force: true });
  await expect(page.getByText("Task deleted")).toBeVisible();

  const results = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
    .analyze();

  expect(results.violations).toEqual([]);
});

test("a11y: post-deletion focus state has zero axe violations", async ({ page }) => {
  await page.clock.install();

  const id = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
  await seedTodo(id, "axe post-delete target");
  await page.goto("/");

  const row = page.getByRole("listitem").filter({ hasText: "axe post-delete target" });
  await expect(row).toBeVisible();

  await row.getByRole("button", { name: /delete task/i }).click({ force: true });
  await expect(page.getByText("Task deleted")).toBeVisible();

  // Advance past the undo window so the toast clears
  await page.clock.fastForward(6000);
  await expect(page.getByText("Task deleted")).not.toBeVisible({ timeout: 2000 });

  const results = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
    .analyze();

  expect(results.violations).toEqual([]);
});

test("a11y: failed-sync task with ErrorIndicator has zero axe violations", async ({ page }) => {
  // Abort the next POST to put a task in syncStatus: failed
  await page.route("**/api/todos", (route) => {
    if (route.request().method() === "POST") {
      void route.abort();
    } else {
      void route.continue();
    }
  }, { times: 1 });

  await page.goto("/");

  const input = page.getByRole("textbox", { name: /new task/i });
  await input.fill("axe error indicator target");
  await input.press("Enter");

  await expect(page.getByRole("button", { name: /couldn't save/i })).toBeVisible();

  const results = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
    .analyze();

  await page.unroute("**/api/todos");

  expect(results.violations).toEqual([]);
});
