#!/usr/bin/env node
// Smoke test: assert app/globals.css declares the v1 design tokens with the documented
// values and exposes them via @theme inline mappings. Catches accidental token drift
// before later stories build on the wrong values. Full Vitest setup arrives in Story 1.2.

import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const cssPath = resolve(here, "..", "app", "globals.css");
const css = readFileSync(cssPath, "utf8").toLowerCase();

const REQUIRED_DECLARATIONS = [
  ["--bg", "#fafafa"],
  ["--surface", "#ffffff"],
  ["--foreground", "#18181b"],
  ["--foreground-muted", "#71717a"],
  ["--border-subtle", "#e4e4e7"],
  ["--accent", "#4f46e5"],
  ["--accent-foreground", "#ffffff"],
  ["--error-foreground", "#b45309"],
  ["--space-1", "4px"],
  ["--space-2", "8px"],
  ["--space-3", "12px"],
  ["--space-4", "16px"],
  ["--space-6", "24px"],
  ["--space-8", "32px"],
];

const REQUIRED_THEME_MAPPINGS = [
  ["--color-background", "var(--bg)"],
  ["--color-surface", "var(--surface)"],
  ["--color-foreground", "var(--foreground)"],
  ["--color-foreground-muted", "var(--foreground-muted)"],
  ["--color-border-subtle", "var(--border-subtle)"],
  ["--color-accent", "var(--accent)"],
  ["--color-accent-foreground", "var(--accent-foreground)"],
  ["--color-error-foreground", "var(--error-foreground)"],
];

const errors = [];

for (const [name, value] of REQUIRED_DECLARATIONS) {
  const needle = `${name}: ${value};`;
  if (!css.includes(needle)) {
    errors.push(`Missing or wrong declaration: ${needle}`);
  }
}

for (const [name, value] of REQUIRED_THEME_MAPPINGS) {
  const needle = `${name}: ${value};`;
  if (!css.includes(needle)) {
    errors.push(`Missing @theme mapping: ${needle}`);
  }
}

if (errors.length > 0) {
  console.error("Design-token smoke test FAILED:");
  for (const err of errors) console.error("  - " + err);
  process.exit(1);
}

console.log(
  `Design tokens OK — ${REQUIRED_DECLARATIONS.length} declarations and ${REQUIRED_THEME_MAPPINGS.length} @theme mappings verified.`,
);
