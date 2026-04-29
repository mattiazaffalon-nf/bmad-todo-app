import { test, expect, devices } from "@playwright/test";
import { cleanupTodos, seedTodo } from "./fixtures/test-db";

test.use({ ...devices["iPhone 14"] });

test.beforeEach(async () => {
  await cleanupTodos();
});

test("Journey 4 mobile: swipe-left → UndoToast → wait 5 s → task permanently deleted", async ({
  page,
}) => {
  await page.clock.install();

  const id = "88888888-8888-4888-8888-888888888888";
  await seedTodo(id, "delete me mobile");

  await page.goto("/");

  const row = page.getByRole("listitem").filter({ hasText: "delete me mobile" });
  await expect(row).toBeVisible();

  const box = await row.boundingBox();
  if (!box) throw new Error("row has no bounding box");

  const startX = box.x + box.width - 20;
  const startY = box.y + box.height / 2;
  const endX = box.x + 10;

  await page.evaluate(
    ({ startX, startY, endX, steps }) => {
      const target = document.elementFromPoint(startX, startY);
      if (!target) throw new Error("no element at swipe start point");
      const fire = (type: string, x: number, y: number) => {
        const touch = { identifier: 0, target, clientX: x, clientY: y, pageX: x, pageY: y };
        const ev = new Event(type, { bubbles: true, cancelable: true });
        const list = type === "touchend" ? [] : [touch];
        Object.defineProperty(ev, "touches", { value: list });
        Object.defineProperty(ev, "targetTouches", { value: list });
        Object.defineProperty(ev, "changedTouches", { value: [touch] });
        target.dispatchEvent(ev);
      };
      fire("touchstart", startX, startY);
      for (let i = 1; i <= steps; i++) {
        fire("touchmove", startX + ((endX - startX) * i) / steps, startY);
      }
      fire("touchend", endX, startY);
    },
    { startX, startY, endX, steps: 10 },
  );

  await expect(page.getByText("Task deleted")).toBeVisible({ timeout: 3000 });

  const deletePromise = page.waitForResponse(
    (r) => /\/api\/todos\/[^/]+$/.test(r.url()) && r.request().method() === "DELETE",
    { timeout: 5000 },
  );

  await page.clock.fastForward(6000);

  const deleteResponse = await deletePromise;
  expect(deleteResponse.status()).toBe(204);

  await page.reload();
  await expect(page.getByText("delete me mobile")).not.toBeVisible();
});
