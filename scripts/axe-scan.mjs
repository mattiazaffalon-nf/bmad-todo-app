// One-off WCAG AA accessibility scan against a running app instance.
// Uses @playwright/test's chromium + @axe-core/playwright. No DB fixtures —
// scans whatever state the live app is in, then drives the UI through
// populated / completed / undo-toast states.
//
// Usage:
//   BASE_URL=http://localhost:3000 node scripts/axe-scan.mjs

import { chromium } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

const BASE = process.env.BASE_URL ?? "http://localhost:3000";
const TAGS = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"];
const VIEWPORTS = [
  { name: "desktop", width: 1280, height: 800 },
  { name: "mobile",  width: 390,  height: 844 },
];

const summary = [];

for (const viewport of VIEWPORTS) {
  const browser = await chromium.launch();
  const context = await browser.newContext({ viewport });
  const page = await context.newPage();

  const scan = async (label) => {
    const results = await new AxeBuilder({ page }).withTags(TAGS).analyze();
    const v = results.violations;
    summary.push({ viewport: viewport.name, state: label, violations: v.length, ids: v.map(x => x.id) });
    if (v.length) {
      console.log(`\n[${viewport.name} / ${label}] VIOLATIONS:`);
      for (const x of v) {
        console.log(`  - ${x.id} [${x.impact}] ${x.help} (nodes: ${x.nodes.length}) ${x.helpUrl}`);
      }
    } else {
      console.log(`[${viewport.name} / ${label}] OK — 0 violations`);
    }
  };

  await page.goto(BASE, { waitUntil: "networkidle" });
  await scan("initial");

  const input = page.getByRole("textbox", { name: /new task/i });
  await input.fill(`axe scan ${viewport.name} ${Date.now()}`);
  await input.press("Enter");
  await page.waitForResponse(r => r.url().endsWith("/api/todos") && r.request().method() === "POST" && r.ok());
  await page.getByRole("list").waitFor();
  await scan("populated");

  const firstRow = page.getByRole("listitem").first();
  await firstRow.getByRole("button", { name: /mark task complete/i }).click();
  await page.waitForResponse(r => /\/api\/todos\/[^/]+$/.test(r.url()) && r.request().method() === "PATCH" && r.ok());
  await scan("completed");

  await firstRow.getByRole("button", { name: /delete task/i }).click({ force: true });
  await page.getByText(/task deleted/i).waitFor();
  await scan("undo-toast");

  await browser.close();
}

console.log("\n=== SUMMARY ===");
for (const row of summary) {
  console.log(`${row.viewport.padEnd(8)} ${row.state.padEnd(12)} ${row.violations === 0 ? "OK" : "FAIL " + row.ids.join(",")}`);
}

const totalFail = summary.reduce((n, r) => n + r.violations, 0);
process.exit(totalFail === 0 ? 0 : 1);
