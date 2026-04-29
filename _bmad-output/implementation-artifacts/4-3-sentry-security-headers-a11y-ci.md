# Story 4.3: Wire Sentry, security headers, and the full CI accessibility pipeline

Status: ready-for-dev

## Story

As a maintainer,
I want production error reporting, security headers, and automated accessibility checks gating every PR,
So that the app is observable, safe to expose to the internet, and protected from accessibility regressions.

## Acceptance Criteria

**AC #1 — Sentry initialization**
- `@sentry/nextjs` installed (pnpm package).
- `sentry.client.config.ts`, `sentry.server.config.ts`, `sentry.edge.config.ts` created at the project root.
- `instrumentation.ts` at project root registers Sentry server + edge SDKs for App Router.
- Client config uses `NEXT_PUBLIC_SENTRY_DSN`; server/edge config uses `SENTRY_DSN`.
- Sentry is **disabled in development** unless `NEXT_PUBLIC_SENTRY_ENABLED=true` is explicitly set.
- `next.config.ts` is wrapped with `withSentryConfig(nextConfig, { silent: true })`.
- DSN values are NOT committed — added to Vercel environment variables (production + preview).

**AC #2 — Top-level error boundary**
- `app/error.tsx` exists and is a `"use client"` component.
- Renders a minimal fallback that matches the muted UI tone: no alarming red, simple message consistent with the app's calm aesthetic (e.g., same `text-foreground-muted` + small centered layout as `EmptyState`).
- Accepts `error: Error & { digest?: string }` and `reset: () => void` props as required by Next.js App Router.
- Calls `Sentry.captureException(error)` in a `useEffect` so the error flows to Sentry.
- Does NOT use Dialog/AlertDialog (UX policy).

**AC #3 — Security headers (NFR10)**
- `next.config.ts` exports an `async headers()` function returning headers for path `"/(.*)"`.
- Headers set:
  - `Strict-Transport-Security: max-age=63072000; includeSubDomains; preload`
  - `X-Frame-Options: DENY`
  - `X-Content-Type-Options: nosniff`
  - `Referrer-Policy: strict-origin-when-cross-origin`
  - `Content-Security-Policy` — see Dev Notes for the scoped v1 policy string.
- Verified present via curl against a deployed Vercel preview.

**AC #4 — FR17: Shared `lib/api-errors.ts` helper**
- `lib/api-errors.ts` is created with typed builders: `validationFailed`, `notFound`, `internalError` — same signatures as the existing `_lib/responses.ts`.
- `app/api/todos/route.ts` and `app/api/todos/[id]/route.ts` import from `@/lib/api-errors` (not the old `_lib/responses`).
- `app/api/todos/_lib/responses.ts` is deleted (no longer needed).
- `pnpm typecheck` passes.

**AC #5 — Fix dangling `aria-describedby` in `TaskInput`**
- `components/TaskInput.tsx` line 33: `aria-describedby="empty-state-hint"` is removed from the input element.
- The `empty-state-hint` element in `EmptyState` is not referenced by any ARIA attribute at runtime when tasks are present.
- `pnpm test` still passes.

**AC #6 — jsx-a11y rules upgraded to `error` (NFR14)**
- `eslint.config.mjs` adds a rule block that overrides all `jsx-a11y/*` rules already set to `warn` by `eslint-config-next` to `error`.
- `pnpm lint` passes (no jsx-a11y warnings remain; all are either already-passing or upgraded-and-passing).

**AC #7 — `e2e/a11y.spec.ts` covers all journey states (UX-DR23)**
- A "populated list" scan is added: seed two tasks, navigate, run axe-core → zero violations.
- Existing scans retained: empty state, completed-task, UndoToast visible, post-deletion, failed-sync.
- All scans use `.withTags(["wcag2a","wcag2aa","wcag21a","wcag21aa"])`.
- All scans report zero violations.

**AC #8 — GitHub Actions CI workflow**
- `.github/workflows/ci.yml` created.
- Triggers on `pull_request` (all branches) and `push` to `main`.
- Steps: checkout → install (pnpm) → lint → typecheck → test → test:e2e.
- `pnpm` cache enabled (uses `actions/cache` or `pnpm/action-setup` with `cache: 'pnpm'`).
- E2E step sets `BASE_URL` to the Vercel preview URL; see Dev Notes for the wait-for-deployment approach.
- All five steps must pass; any failure blocks merge.

**AC #9 — Quality gates**
- `pnpm lint` clean.
- `pnpm typecheck` clean.
- `pnpm test` all green.
- `pnpm build` clean (Sentry `withSentryConfig` wraps the build without errors even when DSN env vars are absent).
- No changes to `db/**`.

## Tasks / Subtasks

- [ ] **Task 1: Install and configure Sentry (AC #1)**
  - [ ] `pnpm add @sentry/nextjs`
  - [ ] Create `sentry.client.config.ts`:
    ```ts
    import * as Sentry from "@sentry/nextjs";
    const enabled = process.env.NODE_ENV !== "development" ||
      process.env.NEXT_PUBLIC_SENTRY_ENABLED === "true";
    Sentry.init({
      dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
      enabled,
      tracesSampleRate: 1,
    });
    ```
  - [ ] Create `sentry.server.config.ts`:
    ```ts
    import * as Sentry from "@sentry/nextjs";
    const enabled = process.env.NODE_ENV !== "development" ||
      process.env.NEXT_PUBLIC_SENTRY_ENABLED === "true";
    Sentry.init({
      dsn: process.env.SENTRY_DSN,
      enabled,
      tracesSampleRate: 1,
    });
    ```
  - [ ] Create `sentry.edge.config.ts` (same pattern as server, uses `SENTRY_DSN`)
  - [ ] Create `instrumentation.ts` at project root:
    ```ts
    export async function register() {
      if (process.env.NEXT_RUNTIME === "nodejs") {
        await import("./sentry.server.config");
      }
      if (process.env.NEXT_RUNTIME === "edge") {
        await import("./sentry.edge.config");
      }
    }
    ```
  - [ ] Wrap `next.config.ts` with `withSentryConfig`:
    ```ts
    import { withSentryConfig } from "@sentry/nextjs";
    import type { NextConfig } from "next";
    const nextConfig: NextConfig = { /* existing config + headers */ };
    export default withSentryConfig(nextConfig, { silent: true, disableLogger: true });
    ```
  - [ ] `pnpm typecheck` passes

- [ ] **Task 2: Create `app/error.tsx` (AC #2)**
  - [ ] Create `app/error.tsx`:
    ```tsx
    "use client";
    import { useEffect } from "react";
    import * as Sentry from "@sentry/nextjs";
    interface ErrorProps { error: Error & { digest?: string }; reset: () => void; }
    export default function Error({ error, reset }: ErrorProps) {
      useEffect(() => { Sentry.captureException(error); }, [error]);
      return (
        <div className="flex flex-col items-center justify-center min-h-[50vh] gap-4 text-foreground-muted">
          <p className="text-base">Something went wrong.</p>
          <button
            type="button"
            onClick={reset}
            className="text-sm underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
          >
            Try again
          </button>
        </div>
      );
    }
    ```
  - [ ] `pnpm typecheck` passes

- [ ] **Task 3: Add security headers to `next.config.ts` (AC #3)**
  - [ ] Add `async headers()` to `nextConfig` before wrapping with `withSentryConfig`:
    ```ts
    const securityHeaders = [
      { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
      { key: "X-Frame-Options", value: "DENY" },
      { key: "X-Content-Type-Options", value: "nosniff" },
      { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
      {
        key: "Content-Security-Policy",
        value: [
          "default-src 'self'",
          "script-src 'self' 'unsafe-inline'",  // see Dev Notes — nonce upgrade deferred
          "style-src 'self' 'unsafe-inline'",
          "img-src 'self' data:",
          "font-src 'self'",
          "connect-src 'self' https://*.sentry.io https://*.ingest.sentry.io",
          "frame-ancestors 'none'",
        ].join("; "),
      },
    ];
    const nextConfig: NextConfig = {
      async headers() {
        return [{ source: "/(.*)", headers: securityHeaders }];
      },
    };
    ```
  - [ ] `pnpm build` still passes
  - [ ] Note: See Dev Notes on why `unsafe-inline` is retained for v1 scripts/styles; nonce-based CSP is deferred

- [ ] **Task 4: Create `lib/api-errors.ts` and migrate route handlers (AC #4)**
  - [ ] Create `lib/api-errors.ts`:
    ```ts
    export const validationFailed = (message: string) =>
      Response.json({ code: "validation_failed", message }, { status: 400 });
    export const notFound = (message: string) =>
      Response.json({ code: "not_found", message }, { status: 404 });
    export const internalError = () =>
      Response.json({ code: "internal_error", message: "Something went wrong" }, { status: 500 });
    ```
  - [ ] Update `app/api/todos/route.ts`: replace `import { ... } from "./_lib/responses"` with `import { ... } from "@/lib/api-errors"`
  - [ ] Update `app/api/todos/[id]/route.ts`: replace `import { ... } from "../_lib/responses"` with `import { ... } from "@/lib/api-errors"`
  - [ ] Delete `app/api/todos/_lib/responses.ts` and `app/api/todos/_lib/` directory (if empty)
  - [ ] `pnpm typecheck` passes

- [ ] **Task 5: Fix dangling `aria-describedby` in `TaskInput` (AC #5)**
  - [ ] In `components/TaskInput.tsx`, remove `aria-describedby="empty-state-hint"` from the `<input>` element
  - [ ] Verify `pnpm test` still passes
  - [ ] Verify axe-core scan of populated state won't flag this (see Task 7)

- [ ] **Task 6: Tighten jsx-a11y rules to `error` (AC #6)**
  - [ ] In `eslint.config.mjs`, add a rule block after the existing blocks:
    ```js
    {
      rules: {
        "jsx-a11y/alt-text": "error",
        "jsx-a11y/aria-props": "error",
        "jsx-a11y/aria-proptypes": "error",
        "jsx-a11y/aria-unsupported-elements": "error",
        "jsx-a11y/role-has-required-aria-props": "error",
        "jsx-a11y/role-supports-aria-props": "error",
      },
    },
    ```
  - [ ] `pnpm lint` passes — fix any newly-surfaced violations before committing
  - [ ] Do NOT silence rules via inline `// eslint-disable` comments unless the violation is provably a false positive and documented

- [ ] **Task 7: Extend `e2e/a11y.spec.ts` with populated-list scan (AC #7)**
  - [ ] Add test seeding two tasks (stable UUIDs `cccccccc-...` and `dddddddd-...`) before goto:
    ```ts
    test("a11y: populated list has zero axe violations", async ({ page }) => {
      const id1 = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
      const id2 = "dddddddd-dddd-4ddd-8ddd-dddddddddddd";
      await seedTodo(id1, "first task");
      await seedTodo(id2, "second task");
      await page.goto("/");
      await expect(page.getByRole("list")).toBeVisible();
      const results = await new AxeBuilder({ page })
        .withTags(["wcag2a","wcag2aa","wcag21a","wcag21aa"])
        .analyze();
      expect(results.violations).toEqual([]);
    });
    ```
  - [ ] `pnpm test:e2e` passes all a11y scans

- [ ] **Task 8: Create `.github/workflows/ci.yml` (AC #8)**
  - [ ] Create `.github/` and `.github/workflows/` directories
  - [ ] Write `ci.yml` — see Dev Notes for the full YAML template
  - [ ] E2E step: for PRs, use `BASE_URL` pointing to the Vercel preview deployment (see Dev Notes for the wait-for-deployment strategy)

- [ ] **Task 9: Quality gates (AC #9)**
  - [ ] `pnpm lint` — clean
  - [ ] `pnpm typecheck` — clean
  - [ ] `pnpm test` — all green
  - [ ] `pnpm build` — clean (no Sentry errors even without DSN vars set)

## Dev Notes

### `@sentry/nextjs` v8+ and Next.js 16 App Router

For App Router, Sentry v8 requires `instrumentation.ts` at the project root (alongside `app/`). This file is loaded by Next.js's instrumentation hook (`experimental.instrumentationHook` was required in older Next.js — in Next.js 15+/16 it is enabled by default). It registers the server and edge SDKs before any route is handled.

The three config files (`sentry.client.config.ts`, `sentry.server.config.ts`, `sentry.edge.config.ts`) are loaded by the respective Sentry webpack plugins injected by `withSentryConfig`. These are **not** imported manually — they are auto-injected at build time.

`withSentryConfig` wraps the entire Next.js config. Because `next.config.ts` exports the wrapped version, the `headers()` function must live inside the `nextConfig` object passed to `withSentryConfig`, not the outer wrapper.

Install: `pnpm add @sentry/nextjs`. No separate `@sentry/react` or `@sentry/node` needed — `@sentry/nextjs` re-exports them.

When `SENTRY_DSN` / `NEXT_PUBLIC_SENTRY_DSN` env vars are absent (e.g., during local dev or CI `pnpm build`), Sentry initializes with `dsn: undefined` which is valid and silently disables event sending.

### Content Security Policy — v1 pragmatics

Next.js 16 App Router injects inline `<script>` tags for:
- Hydration data payloads (`__NEXT_DATA__`)
- Dynamic imports loading via `<script type="module">`
- Client component hydration bootstrapping

A **strict no-`unsafe-inline`** CSP requires nonce-based CSP via Next.js middleware (see https://nextjs.org/docs/app/building-your-application/configuring/content-security-policy). This is non-trivial and constitutes its own story.

**v1 decision**: retain `unsafe-inline` for `script-src` and `style-src` in the initial implementation. The other four headers (HSTS, X-Frame-Options, X-Content-Type-Options, Referrer-Policy) provide meaningful protection. The CSP header is still set — it restricts `connect-src` to `'self'` plus Sentry's ingestion endpoints, `frame-ancestors 'none'` (DENY equivalent in CSP), `img-src 'self' data:`, and `font-src 'self'`. Document the nonce upgrade as a deferred item.

**Sentry `connect-src`**: Sentry v8 uses `fetch` to post to `https://*.ingest.sentry.io`. Add this to `connect-src`. The tunnel route (optional, for ad-blocker bypass) can be omitted for v1.

### `lib/api-errors.ts` — import graph compliance

`lib/` is on the allowed path from `app/api/**`. The AGENTS.md import graph shows:
```
app/api/* → db/queries.ts → db/client.ts
```
There is no restriction on `app/api/*` importing from `lib/`. The `no-restricted-imports` ESLint rules only block `components/`, `hooks/`, `db/` from crossing boundaries — not `lib/`.

After migration, `app/api/todos/_lib/` directory should be deleted entirely. The `route.test.ts` files import the route module directly and do not import from `_lib/responses` — check before deleting.

### Fix `aria-describedby` dangling reference

In `components/TaskInput.tsx` line 33, the input has `aria-describedby="empty-state-hint"`. The `empty-state-hint` id lives on a `<p>` inside `EmptyState`. When tasks are present, `EmptyState` is unmounted and `empty-state-hint` does not exist in the DOM. The axe-core rule `aria-valid-attr-value` catches this in the populated-list scan.

Fix: simply remove `aria-describedby="empty-state-hint"` from the input. The input's `aria-label="New task"` (or `placeholder`) already provides sufficient accessible name without `aria-describedby`. The empty-state hint text is decorative guidance visible near the input — screen readers read it as normal prose in the `<p>` element.

Deferred-work note for this issue was written in Story 2.1's review. This story resolves it.

### jsx-a11y rules already active

`eslint-config-next` (bundled `eslint-plugin-jsx-a11y` v6.10.2) already runs these rules at `warn` level via `eslint-config-next/core-web-vitals`:
- `jsx-a11y/alt-text`, `aria-props`, `aria-proptypes`, `aria-unsupported-elements`, `role-has-required-aria-props`, `role-supports-aria-props`

The upgrade in `eslint.config.mjs` just overrides severity from `"warn"` to `"error"`. ESLint flat config applies rules last-wins, so adding a later block with `"error"` overrides the earlier `"warn"`.

Run `pnpm lint` immediately after upgrading to surface any new violations. The only known pre-existing violation is the `aria-describedby` dangling reference (Task 5 must be done before or alongside Task 6).

### GitHub Actions CI workflow

Full `ci.yml` template:

```yaml
name: CI

on:
  push:
    branches: [main]
  pull_request:

jobs:
  ci:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - uses: pnpm/action-setup@v4
        with:
          version: 9

      - uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: pnpm

      - name: Install dependencies
        run: pnpm install --frozen-lockfile

      - name: Lint
        run: pnpm lint

      - name: Type-check
        run: pnpm typecheck

      - name: Unit tests
        run: pnpm test

      - name: Install Playwright browsers
        run: pnpm exec playwright install --with-deps chromium

      - name: E2E tests
        run: pnpm test:e2e
        env:
          DATABASE_URL: ${{ secrets.DATABASE_URL }}
          BASE_URL: ${{ steps.vercel-deploy.outputs.preview-url || '' }}
```

**E2E against Vercel preview — v1 approach**: For the initial CI workflow, run E2E against localhost (`pnpm dev` via Playwright's `webServer` config). The `BASE_URL` is left unset; Playwright's `webServer` block spins up the local server. This requires `DATABASE_URL` as a GitHub Actions secret pointing to the Neon dev branch.

Full Vercel-preview E2E integration (using `amondnet/vercel-action` or Vercel's GitHub app deployment URL) is a non-trivial setup that requires `VERCEL_TOKEN`, `VERCEL_ORG_ID`, `VERCEL_PROJECT_ID` secrets plus a deployment-wait step. Defer this to a separate infrastructure story and document it in `deferred-work.md`.

**Required GitHub Actions secrets** (document in PR description):
- `DATABASE_URL` — the Neon dev branch connection string, same as `.env.local`

### Previous story learnings

- **Story 4.2**: `retryDelete` is a plain `useCallback` async in `useDeleteTodo` — not `useMutation`. New library additions follow the same pattern.
- **Story 4.1**: `ErrorIndicator` was built with `onRetry` + `retrying` props. The `app/error.tsx` boundary is a different layer — coarse-grained, not per-task.
- **Story 3.2**: `"use client"` is required for components using hooks (`useEffect`, `useState`). `app/error.tsx` uses `useEffect` → must be `"use client"`.
- **Naming**: `app/error.tsx` is special — Next.js App Router's reserved file convention. Do not rename. Export must be `default`.
- **Build script**: `pnpm build` runs `drizzle-kit migrate && next build`. The CI unit-test step runs Vitest only; the build step is separate from test.
- **Import graph**: `lib/api-errors.ts` lives in `lib/` — same layer as `lib/validation.ts`, `lib/api-client.ts`, `lib/constants.ts`. `app/api/**` may freely import from `lib/`.

### Files changed in this story

```
package.json                                     # MODIFIED — @sentry/nextjs added
pnpm-lock.yaml                                   # MODIFIED — lockfile update
next.config.ts                                   # MODIFIED — withSentryConfig + headers()
instrumentation.ts                               # NEW — App Router Sentry registration
sentry.client.config.ts                          # NEW
sentry.server.config.ts                          # NEW
sentry.edge.config.ts                            # NEW
app/
└── error.tsx                                    # NEW — top-level error boundary
lib/
└── api-errors.ts                                # NEW — shared error builders (replaces _lib/responses.ts)
app/api/todos/
├── route.ts                                     # MODIFIED — import from @/lib/api-errors
├── [id]/route.ts                                # MODIFIED — import from @/lib/api-errors
└── _lib/responses.ts                            # DELETED
components/
└── TaskInput.tsx                                # MODIFIED — remove aria-describedby
eslint.config.mjs                               # MODIFIED — jsx-a11y rules → error
e2e/
└── a11y.spec.ts                                 # MODIFIED — add populated-list scan
.github/
└── workflows/
    └── ci.yml                                   # NEW
```

No changes to: `db/**`, `hooks/**`, `components/` (except TaskInput), `lib/validation.ts`, `lib/constants.ts`, `lib/api-client.ts`.

## Dev Agent Record

### Agent Model Used

claude-sonnet-4-6

### Debug Log References

### Completion Notes List

### File List
