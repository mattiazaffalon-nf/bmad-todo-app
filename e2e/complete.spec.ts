import { test, expect, devices } from "@playwright/test";
import { cleanupTodos, seedTodo } from "./fixtures/test-db";

test.use({ ...devices["iPhone 14"] });

test.beforeEach(async () => {
  await cleanupTodos();
});

test("Journey 3: tap-to-complete on mobile viewport", async ({ page }) => {
  const id = "44444444-4444-4444-8444-444444444444";
  await seedTodo(id, "tap me");
  await page.goto("/");

  const row = page.getByRole("listitem").filter({ hasText: "tap me" });
  await expect(row).toBeVisible();

  const checkbox = row.getByRole("button", { name: /mark task complete/i });
  const patchPromise = page.waitForResponse(
    (r) => /\/api\/todos\/[^/]+$/.test(r.url()) && r.request().method() === "PATCH",
  );
  await checkbox.click();
  await patchPromise;

  await expect(row.locator("p")).toHaveClass(/line-through/);

  const patchPromise2 = page.waitForResponse(
    (r) => /\/api\/todos\/[^/]+$/.test(r.url()) && r.request().method() === "PATCH",
  );
  await row.getByRole("button", { name: /mark task incomplete/i }).click();
  await patchPromise2;

  await expect(row.locator("p")).not.toHaveClass(/line-through/);
});

test("Journey 3: swipe-right-to-complete on mobile viewport", async ({ page }) => {
  const id = "55555555-5555-4555-8555-555555555555";
  await seedTodo(id, "swipe me");
  await page.goto("/");

  const row = page.getByRole("listitem").filter({ hasText: "swipe me" });
  await expect(row).toBeVisible();

  const box = await row.boundingBox();
  if (!box) throw new Error("row has no bounding box");

  const startX = box.x + 8;
  const startY = box.y + box.height / 2;
  const endX = box.x + box.width * 0.85;

  // react-swipeable v7 listens for native touchstart/touchmove/touchend via addEventListener.
  // WebKit blocks `new TouchEvent(...)` ("Illegal constructor") but allows `new Event(...)`
  // with touch arrays attached as properties. Dispatch that to simulate the gesture.
  const patchPromise = page.waitForResponse(
    (r) => /\/api\/todos\/[^/]+$/.test(r.url()) && r.request().method() === "PATCH",
  );
  await page.evaluate(
    async ({ startX, startY, endX, endY, steps }) => {
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
        const x = startX + ((endX - startX) * i) / steps;
        fire("touchmove", x, startY);
        await new Promise((r) => setTimeout(r, 8));
      }
      fire("touchend", endX, endY);
    },
    { startX, startY, endX, endY: startY, steps: 10 },
  );
  await patchPromise;

  await expect(row.locator("p")).toHaveClass(/line-through/);
});
