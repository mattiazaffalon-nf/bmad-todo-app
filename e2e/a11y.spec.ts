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
