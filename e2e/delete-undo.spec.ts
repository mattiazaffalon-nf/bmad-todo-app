import { test, expect } from "@playwright/test";
import { cleanupTodos, seedTodo } from "./fixtures/test-db";

test.beforeEach(async () => {
  await cleanupTodos();
});

// ---------------------------------------------------------------------------
// Desktop Journey 4
// ---------------------------------------------------------------------------

test("Journey 4 desktop: hover trash → click → UndoToast appears → Undo restores task", async ({
  page,
}) => {
  await page.clock.install();

  const id = "77777777-7777-4777-8777-777777777777";
  await seedTodo(id, "delete me desktop");

  const deleteRequests: string[] = [];
  page.on("request", (r) => {
    if (/\/api\/todos\/[^/]+$/.test(r.url()) && r.method() === "DELETE") {
      deleteRequests.push(r.url());
    }
  });

  await page.goto("/");

  const row = page.getByRole("listitem").filter({ hasText: "delete me desktop" });
  await expect(row).toBeVisible();

  // Delete button is always in DOM (opacity-0); click with force to bypass visibility check
  await row.getByRole("button", { name: /delete task/i }).click({ force: true });

  // UndoToast must appear
  await expect(page.getByText("Task deleted")).toBeVisible();
  await expect(page.getByRole("button", { name: /^undo$/i })).toBeVisible();

  // Task is optimistically removed
  await expect(row).not.toBeVisible();

  // Click Undo
  await page.getByRole("button", { name: /^undo$/i }).click();

  // Toast fades
  await expect(page.getByText("Task deleted")).not.toBeVisible({ timeout: 500 });

  // Task is restored
  await expect(page.getByRole("listitem").filter({ hasText: "delete me desktop" })).toBeVisible();

  // DELETE was never fired to the server
  expect(deleteRequests).toHaveLength(0);
});

test("Journey 4 desktop: delete → wait 5 s → DELETE fires → reload → task gone", async ({
  page,
}) => {
  await page.clock.install();

  const id = "99999999-9999-4999-8999-999999999999";
  await seedTodo(id, "permanent delete");

  await page.goto("/");

  const row = page.getByRole("listitem").filter({ hasText: "permanent delete" });
  await expect(row).toBeVisible();

  await row.getByRole("button", { name: /delete task/i }).click({ force: true });
  await expect(page.getByText("Task deleted")).toBeVisible();

  // Set up DELETE listener before advancing clock so it doesn't miss the request
  const deletePromise = page.waitForResponse(
    (r) => /\/api\/todos\/[^/]+$/.test(r.url()) && r.request().method() === "DELETE",
    { timeout: 5000 },
  );

  // Skip past the 5 s undo window
  await page.clock.fastForward(6000);

  const deleteResponse = await deletePromise;
  expect(deleteResponse.status()).toBe(204);

  // Reload: task must be gone from server
  await page.reload();
  await expect(page.getByText("permanent delete")).not.toBeVisible();
});

