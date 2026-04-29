import { test, expect } from "@playwright/test";
import { cleanupTodos } from "./fixtures/test-db";

test.beforeEach(async () => {
  await cleanupTodos();
});

test("Journey 5: create failure shows ErrorIndicator; retry after network restore persists task", async ({ page }) => {
  await page.goto("/");

  // Abort only the next POST to /api/todos
  await page.route("**/api/todos", (route) => {
    if (route.request().method() === "POST") {
      void route.abort();
    } else {
      void route.continue();
    }
  }, { times: 1 });

  const input = page.getByRole("textbox", { name: /new task/i });
  await input.fill("my recovery task");
  await input.press("Enter");

  // ErrorIndicator should appear inline
  await expect(page.getByRole("button", { name: /couldn't save/i })).toBeVisible();

  // Network is restored (times: 1 auto-unregistered)
  // Click retry
  await page.getByRole("button", { name: /couldn't save/i }).click();

  // ErrorIndicator disappears on success
  await expect(page.getByRole("button", { name: /couldn't save/i })).not.toBeVisible({ timeout: 10000 });

  // Task is visible in the list
  await expect(page.getByRole("list")).toContainText("my recovery task");

  // Reload confirms persistence
  await page.reload();
  await expect(page.getByRole("list")).toContainText("my recovery task");
});

test("Journey 5 bonus: during create failure, user can still add another task independently", async ({ page }) => {
  await page.goto("/");

  // Abort only the next POST
  await page.route("**/api/todos", (route) => {
    if (route.request().method() === "POST") {
      void route.abort();
    } else {
      void route.continue();
    }
  }, { times: 1 });

  const input = page.getByRole("textbox", { name: /new task/i });
  await input.fill("failing task");
  await input.press("Enter");

  await expect(page.getByRole("button", { name: /couldn't save/i })).toBeVisible();

  // Type and submit a second task — network is now restored
  await input.fill("independent task");
  const responsePromise = page.waitForResponse(
    (r) => r.url().includes("/api/todos") && r.request().method() === "POST",
  );
  await input.press("Enter");
  await responsePromise;

  // Second task has no error indicator
  const items = page.getByRole("listitem");
  await expect(items).toHaveCount(2);

  // The failed task has an ErrorIndicator; the successful one does not
  const errorButtons = page.getByRole("button", { name: /couldn't save/i });
  await expect(errorButtons).toHaveCount(1);

  // Reload confirms the successfully-created task persists independently
  await page.reload();
  await expect(page.getByRole("list")).toContainText("independent task");
});
