# Story 1.1: Scaffold Next.js project with shadcn/ui, design tokens, and Vercel deploy

Status: in-progress (blocked on user — Vercel + GitHub link, Task 5)

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a developer,
I want a Next.js 16 + shadcn/ui project scaffolded with our design tokens, type-checking, lint rules, and a working Vercel deploy pipeline,
so that future feature work has a solid foundation and a real production URL to develop against.

## Acceptance Criteria

1. **Project scaffold (Next.js 16 + TypeScript + Tailwind + ESLint + Turbopack):** Running `pnpm create next-app@latest bmad-todo-app --yes`, then `pnpm dlx shadcn@latest init -d`, then `pnpm dlx shadcn@latest add button input textarea toast` produces a project with App Router, TypeScript strict mode, Tailwind CSS, ESLint Next.js + jsx-a11y presets, and shadcn primitives in `components/ui/` (kebab-case files). `pnpm dev` starts a Turbopack dev server with sub-second hot reload.

2. **Design tokens declared as CSS variables:** `app/globals.css` declares all tokens at `:root`:
   - `--bg #FAFAFA`, `--surface #FFFFFF`, `--foreground #18181B`, `--foreground-muted #71717A`, `--border-subtle #E4E4E7`
   - `--accent #4F46E5`, `--accent-foreground #FFFFFF`, `--error-foreground #B45309`
   - Spacing tokens `--space-1` (4px) through `--space-8` (32px)
   `tailwind.config.ts` maps these variables to theme utility classes (`bg-background`, `text-foreground`, etc.) and Tailwind utilities consume the spacing tokens.

3. **Typography (UX-DR2):** Inter is self-hosted via `next/font` with weights **400 and 500 only**. System fallback stack: `ui-sans-serif, -apple-system, system-ui, "Segoe UI", Roboto, sans-serif`. The root layout applies the Inter font class to `<body>`. `<html lang="en">` is declared. Viewport meta is `<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">`.

4. **Architectural import-graph enforced via ESLint:** `eslint.config.mjs` configures `no-restricted-imports` to block:
   - `components/**` from importing `db/**` and `app/api/**`
   - `hooks/**` from importing `db/**` and `components/**`
   - `app/api/**` from importing `components/**` and `hooks/**`
   - Imports of Radix `Dialog` and `AlertDialog` (no-modals enforcement)
   `eslint-plugin-jsx-a11y` is enabled so a11y warnings can be surfaced now (Story 4.3 will tighten warnings → errors in CI).

5. **Vercel + GitHub auto-deploy works:** Pushing the scaffolded project to `main` causes Vercel to auto-deploy to a production URL that returns a 200 response with the empty page. `pnpm lint` and `tsc --noEmit` pass with zero errors locally and in Vercel's build logs.

6. **`AGENTS.md` documents project conventions for AI agents:** Edited from the `create-next-app` default to document this project's naming conventions (PascalCase components, kebab-case hooks/non-component modules, `Schema` suffix for Zod), the import-graph rules from AC4, and the "no modals / no confirmations" UI rule.

## Tasks / Subtasks

- [x] **Task 1: Run scaffold commands and verify defaults (AC: #1)**
  - [x] Scaffolded via `pnpm create next-app@^16 scaffold-tmp --yes` into a sibling temp dir, then merged generated files into the repo (preserving `.git/`, `_bmad/`, `_bmad-output/`, `.claude/`, `docs/`)
  - [x] Ran `pnpm dlx shadcn@latest init -d` (auto-detected Tailwind 4 + Next.js, generated `components/ui/button.tsx`, `lib/utils.ts`, populated `app/globals.css` and `components.json`)
  - [x] Ran `pnpm dlx shadcn@latest add input textarea sonner` — note: `toast` is **deprecated** in shadcn; replaced with `sonner` (the official replacement). Components landed at `components/ui/{input,textarea,sonner}.tsx`
  - [x] `tsconfig.json` confirmed to have `"strict": true`
  - [x] `pnpm dev` starts in 382ms with the Turbopack indicator (`Next.js 16.2.4 (Turbopack)`) and serves HTTP 200 on `http://localhost:3000`
  - [x] `package.json` uses `pnpm` (no `npm`/`yarn` lockfiles or artifacts)
  - [x] Added `.nvmrc` pinning Node to `22` (current Vercel LTS)

- [x] **Task 2: Declare design tokens in `app/globals.css` and wire to Tailwind (AC: #2)**
  - [x] Declared all v1 color tokens (`--bg`, `--surface`, `--foreground`, `--foreground-muted`, `--border-subtle`, `--accent`, `--accent-foreground`, `--error-foreground`) and all spacing tokens (`--space-1` … `--space-8`) at `:root` with the documented hex/px values. shadcn's oklch defaults were replaced
  - [x] Added an empty `@media (prefers-color-scheme: dark) { :root { /* TODO: dark-theme tokens */ } }` block as the extension point
  - [x] **Deviation:** Tailwind 4 uses CSS-first config via the `@theme` directive — there is no `tailwind.config.ts`. Token-to-utility mapping lives in `app/globals.css` under `@theme inline { ... }`. Documented in `AGENTS.md`. All utilities the story expects (`bg-background`, `text-foreground`, `text-foreground-muted`, etc.) resolve correctly
  - [x] Tailwind 4's default 4px-grid spacing scale already matches our token values (4, 8, 12, 16, 24, 32px), so utilities like `p-1`, `p-3`, `gap-6` resolve naturally; the named `--space-*` vars exist in `:root` for direct CSS reference
  - [x] Smoke-tested: rendered `app/page.tsx` exercises `bg-background`, `text-foreground`, `text-foreground-muted` utilities. Dev-server HTTP 200 confirmed; rendered HTML carries the expected Tailwind classes

- [x] **Task 3: Wire Inter via `next/font`, set viewport meta, declare lang (AC: #3)**
  - [x] `app/layout.tsx` imports `Inter` from `next/font/google` with `weight: ['400', '500']`, `subsets: ['latin']`, `display: 'swap'`, `variable: '--font-inter'`
  - [x] Used the variable approach + Tailwind `font-sans` mapping (`@theme inline { --font-sans: var(--font-inter); }` in `globals.css`, applied via `html { @apply font-sans; }` in `@layer base`). Documented in `AGENTS.md`
  - [x] `<html lang="en">` confirmed in rendered HTML
  - [x] Added a sibling `export const viewport: Viewport = { width: "device-width", initialScale: 1, viewportFit: "cover" }` per Next.js 16 metadata API. Verified in rendered HTML: `<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover"/>`
  - [x] System fallback stack handled via Tailwind 4's CSS-first config (`@theme inline` + `font-sans` utility); no `tailwind.config.ts` needed

- [x] **Task 4: Configure ESLint flat config with import-graph + a11y (AC: #4)**
  - [x] `eslint-config-next/core-web-vitals` already bundles `eslint-plugin-jsx-a11y`; no separate install needed. `@typescript-eslint` is also already wired via `eslint-config-next/typescript`
  - [x] `eslint.config.mjs` extends both Next.js presets; jsx-a11y rules ship from core-web-vitals. Story 4.3 will tighten to errors
  - [x] Directory-scoped `no-restricted-imports` rules added with `files`-scoped flat-config blocks: `components/**`, `hooks/**`, `app/api/**` each forbid the documented import patterns (`@/db/*`, `@/app/api/*`, `@/components/*`, `@/hooks/*`)
  - [x] **Deviation from the spec:** the no-modals rule blocks both Radix (`@radix-ui/react-dialog`, `@radix-ui/react-alert-dialog`) **and** `@base-ui/react/dialog`, `@base-ui/react/alert-dialog`. shadcn's current `base-nova` style ships on `@base-ui/react` rather than Radix, so the spec's Radix-only block was insufficient
  - [x] `pnpm lint` passes with zero errors and zero warnings against the scaffolded project
  - [x] Skipped placeholder files in empty dirs (`db/`, `hooks/`, `app/api/`) — `no-restricted-imports` rules with `files` scoping apply prospectively when those dirs gain content; no placeholders are needed

- [ ] **Task 5: Connect Vercel + GitHub for auto-deploy (AC: #5)** — **BLOCKED ON USER**
  - [ ] Connect the GitHub repo `mattiazaffalon-nf/bmad-todo-app` to a new Vercel project (one-time, manual step via Vercel dashboard) — **awaiting user**
  - [ ] After connection, push to a feature branch and confirm Vercel produces a preview URL returning HTTP 200 — **awaiting Vercel link**
  - [ ] Merge to `main` and confirm the production deploy returns 200 at the assigned `*.vercel.app` URL — **awaiting Vercel link**
  - [x] Added `pnpm typecheck` script to `package.json` mapped to `tsc --noEmit`; confirmed zero errors locally
  - [x] `pnpm lint` passes locally with zero errors
  - [ ] Verify Vercel build is green; record the production URL in `README.md` — **awaiting Vercel link** (README has a placeholder pointer)

- [x] **Task 6: Edit `AGENTS.md` for project conventions (AC: #6)**
  - [x] `AGENTS.md` rewritten with sections: **Naming** (PascalCase components, kebab-case shadcn ui, kebab-case hooks/modules, `Schema` suffix), **Import graph** (with the unidirectional diagram), **No modals, ever**, **Design tokens** (utility-class table), **Tooling**, and **Deviations from the architecture document** (Tailwind 4 CSS-first config). The `create-next-app`-generated `nextjs-agent-rules` block is preserved
  - [x] References the architecture and UX spec as authoritative sources

- [x] **Task 7: Create `README.md` with setup + deploy instructions**
  - [x] One-shot setup: `nvm use`, `pnpm install`, `pnpm dev`
  - [x] Env vars stub references `.env.example`; `DATABASE_URL`, `SENTRY_DSN`, `NEXT_PUBLIC_SENTRY_DSN` documented with their owning story
  - [x] Production URL placeholder pointer included (to fill once Vercel link is wired)
  - [x] `AGENTS.md` linked from README

- [x] **Task 8: Smoke tests**
  - [x] Added `scripts/check-tokens.mjs` + `pnpm test:tokens` script. Asserts 14 token declarations and 8 `@theme` mappings present with the documented values. Passes. (Full Vitest setup deferred to Story 1.2 per spec allowance)
  - [x] `pnpm dev` boots in 382ms with Turbopack and serves HTTP 200 on `/`. `pnpm build` succeeds (4 routes prerendered). `pnpm lint` and `pnpm typecheck` pass with zero errors

## Dev Notes

### Architectural anchors

- **Starter:** Next.js 16 App Router (chosen in architecture.md §"Selected Starter"). Reasons: native shadcn support, single-codebase full stack, one-command Vercel deploy, Turbopack-by-default for sub-second dev startup.
- **Package manager:** `pnpm` (used throughout architecture and epics — never `npm` or `yarn`). All install commands in this story use `pnpm`.
- **Component naming exception:** `components/ui/*` files are **kebab-case** (e.g., `button.tsx`) because that is what the shadcn CLI generates. Do not rename them. All other component files are PascalCase (`TaskItem.tsx`).
- **Import alias:** `@/*` resolves to project root (configured automatically by `create-next-app` and shadcn `init`). Use it for all internal imports; relative imports across more than one directory level are a smell (architecture.md §"File Organization Patterns").
- **No `src/` wrapper:** App Router convention is `app/`, `components/`, `lib/`, `hooks/`, `db/` directly at repo root (architecture.md §"Files intentionally absent").
- **No global `middleware.ts`** in v1 — security headers are applied via `next.config.ts` in Story 4.3, not via middleware.

### Design-token contract (locked, do not deviate)

Color hex values come from UX spec §"Color System":

| Token | Value | Usage |
| --- | --- | --- |
| `--bg` | `#FAFAFA` | Page background |
| `--surface` | `#FFFFFF` | Task card and input surface |
| `--foreground` | `#18181B` | Primary text, icons |
| `--foreground-muted` | `#71717A` | Secondary text, completed-task text |
| `--border-subtle` | `#E4E4E7` | Dividers, input border |
| `--accent` | `#4F46E5` | Send button active, completion checkmark, focus ring |
| `--accent-foreground` | `#FFFFFF` | Text on accent surfaces |
| `--error-foreground` | `#B45309` | Muted amber for error/retry — **never bright red** |

Spacing scale (UX spec §"Spacing & Layout Foundation"):

| Token | Value |
| --- | --- |
| `--space-1` | 4px |
| `--space-2` | 8px |
| `--space-3` | 12px |
| `--space-4` | 16px |
| `--space-6` | 24px |
| `--space-8` | 32px |

These tokens are **the only sanctioned color/spacing values** in the codebase. Hardcoding hex or pixel values in components is forbidden (anti-pattern from architecture.md §"Pattern Examples").

### shadcn defaults to override

`shadcn init -d` populates `app/globals.css` with HSL-format tokens (`--background: 0 0% 100%;` etc.). These will conflict with the hex tokens specified above. **Overwrite shadcn's tokens with the UX spec's values** rather than running parallel systems. Tailwind utilities like `bg-background` should resolve to `--bg` (our token), not `--background` (shadcn's default).

### ESLint `no-restricted-imports` reference shape (flat config)

```js
// eslint.config.mjs (excerpt)
export default [
  // ... base Next.js + jsx-a11y configs
  {
    files: ['components/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': ['error', {
        patterns: [
          { group: ['db/**', '@/db/**'], message: 'components/ must not import from db/' },
          { group: ['app/api/**', '@/app/api/**'], message: 'components/ must not import from app/api/' },
        ],
      }],
    },
  },
  {
    files: ['hooks/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': ['error', {
        patterns: [
          { group: ['db/**', '@/db/**'], message: 'hooks/ must not import from db/' },
          { group: ['components/**', '@/components/**'], message: 'hooks/ must not import from components/' },
        ],
      }],
    },
  },
  {
    files: ['app/api/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': ['error', {
        patterns: [
          { group: ['components/**', '@/components/**'], message: 'app/api/ must not import from components/' },
          { group: ['hooks/**', '@/hooks/**'], message: 'app/api/ must not import from hooks/' },
        ],
      }],
    },
  },
  // No-modals rule: applies globally
  {
    rules: {
      'no-restricted-imports': ['error', {
        paths: [
          { name: '@radix-ui/react-dialog', message: 'Modals are forbidden by UX policy. See AGENTS.md.' },
          { name: '@radix-ui/react-alert-dialog', message: 'Modals are forbidden by UX policy. See AGENTS.md.' },
        ],
      }],
    },
  },
];
```

**Caution:** ESLint flat-config merges `no-restricted-imports` rule arrays by overriding, not merging. The global no-modals rule and the directory-scoped import-graph rules cannot be expressed as one rule entry — they must be in separate config blocks with `files` scoping. The example above is illustrative; verify behavior with `pnpm lint` after writing.

### Source tree (target end-state for this story)

```
bmad-todo-app/
├── README.md                   # NEW
├── AGENTS.md                   # EDITED from create-next-app default
├── package.json                # NEW (from scaffold)
├── pnpm-lock.yaml              # NEW
├── tsconfig.json               # NEW (from scaffold, strict mode confirmed)
├── next.config.ts              # NEW (from scaffold; security headers come in Story 4.3)
├── tailwind.config.ts          # NEW (token mapping added)
├── postcss.config.mjs          # NEW (from scaffold)
├── eslint.config.mjs           # NEW (from scaffold + import-graph rules added)
├── components.json             # NEW (from shadcn init)
├── .nvmrc                      # NEW
├── .env.example                # NEW (placeholders for DATABASE_URL, SENTRY_DSN, NEXT_PUBLIC_SENTRY_DSN)
├── .gitignore                  # NEW (from scaffold; ensure .env.local is listed)
├── app/
│   ├── layout.tsx              # NEW (Inter font, lang, viewport)
│   ├── page.tsx                # NEW (placeholder; replaced in Story 1.4)
│   └── globals.css             # NEW (token CSS variables)
├── components/
│   └── ui/
│       ├── button.tsx          # NEW (shadcn add)
│       ├── input.tsx           # NEW (shadcn add)
│       ├── textarea.tsx        # NEW (shadcn add)
│       └── toast.tsx           # NEW (shadcn add)
├── lib/
│   └── utils.ts                # NEW (shadcn's cn() helper, generated by init)
└── public/                     # NEW (favicon from scaffold)
```

**Directories deferred to later stories:** `app/api/`, `hooks/`, `db/`, `e2e/`, additional `components/*.tsx`, `lib/validation.ts`, `lib/api-client.ts`, `lib/constants.ts`. Do not create empty placeholders unless the linter requires them.

### Pinning versions

`create-next-app@latest` is pinned by the version it installs at scaffold time; commit `pnpm-lock.yaml`. Architecture targets **Next.js 16.2** with Turbopack defaults — verify the version that is installed matches this major and that Turbopack is the dev/build engine (no Webpack fallback).

If `create-next-app` installs Next.js 17 or later by the time you run this story, prefer `pnpm create next-app@^16` to stay within architecture's locked major. Document any deviation in Completion Notes.

### Vercel + GitHub coordination

This story requires manual Vercel + GitHub project linking through the Vercel dashboard. The dev agent **cannot do this autonomously**. When Task 5 is reached, pause and request the user perform the link, then resume verification. After linking, every push to `main` triggers a production deploy and every PR triggers a preview deploy.

The Neon database integration (Story 1.2) is also performed via the Vercel-Neon Marketplace — this story should **not** attempt to provision Neon. Story 1.2 owns that step.

### What this story does NOT do

To prevent scope creep, the following are explicitly **out of scope**:

- No DB schema, no Drizzle setup, no `db/*` files (Story 1.2)
- No API route handlers (Stories 1.3 / 2.1 / 3.1)
- No `TaskInput`, `TaskList`, `TaskItem`, `EmptyState` (Stories 1.4 / 1.5)
- No Sentry, no security headers, no CI workflow (Story 4.3)
- No Playwright config (Story 4.3 wires CI; basic E2E test wiring lands with the journeys in 1.5+)
- No Vitest full setup unless trivially needed for the smoke test in Task 8 — Vitest configuration belongs to Story 1.2's test infrastructure work

### Test scope for this story

Per architecture.md §"Testing Framework", Vitest is the unit/integration framework, but this story does not need its full setup. Acceptable proofs of correctness:

- `pnpm dev` boots cleanly, page renders with token colors visible
- `pnpm build` succeeds
- `pnpm lint` passes
- `pnpm typecheck` (or `tsc --noEmit`) passes
- Vercel preview deploy returns HTTP 200

A single token-mapping smoke check (Task 8) is sufficient. Full Vitest scaffolding can be deferred to Story 1.2 if it complicates this story; in that case, document the deferral in Completion Notes.

### Project Structure Notes

The structure above matches the architecture's "Complete Project Directory Structure" exactly. There are no detected conflicts with the unified project structure — this story creates the foundation that all later stories assume.

The **only** intentional deviation from `create-next-app` defaults is `components/ui/` filenames staying kebab-case while custom components are PascalCase. This is documented in `AGENTS.md` (Task 6).

### References

- Story acceptance criteria source: [_bmad-output/planning-artifacts/epics.md §"Story 1.1"](../planning-artifacts/epics.md#story-11-scaffold-nextjs-project-with-shadcnui-design-tokens-and-vercel-deploy)
- Starter rationale and init commands: [_bmad-output/planning-artifacts/architecture.md §"Selected Starter: Next.js 16 App Router + shadcn/ui"](../planning-artifacts/architecture.md#selected-starter-nextjs-16-app-router--shadcnui)
- Naming patterns: [_bmad-output/planning-artifacts/architecture.md §"Naming Patterns"](../planning-artifacts/architecture.md#naming-patterns)
- Project structure (target end-state): [_bmad-output/planning-artifacts/architecture.md §"Complete Project Directory Structure"](../planning-artifacts/architecture.md#complete-project-directory-structure)
- Architectural boundaries (import graph): [_bmad-output/planning-artifacts/architecture.md §"Architectural Boundaries"](../planning-artifacts/architecture.md#architectural-boundaries)
- Color tokens: [_bmad-output/planning-artifacts/ux-design-specification.md §"Color System"](../planning-artifacts/ux-design-specification.md#color-system)
- Typography: [_bmad-output/planning-artifacts/ux-design-specification.md §"Typography System"](../planning-artifacts/ux-design-specification.md#typography-system)
- Spacing tokens: [_bmad-output/planning-artifacts/ux-design-specification.md §"Spacing & Layout Foundation"](../planning-artifacts/ux-design-specification.md#spacing--layout-foundation)
- Implementation readiness signals (no blockers for 1.1): [_bmad-output/planning-artifacts/implementation-readiness-report-2026-04-28.md](../planning-artifacts/implementation-readiness-report-2026-04-28.md)
- Story dependency graph (1.1 has no upstream deps; unblocks 1.2): [_bmad-output/planning-artifacts/story-dependency-graph.md](../planning-artifacts/story-dependency-graph.md)

## Dev Agent Record

### Agent Model Used

claude-opus-4-7 (Opus 4.7, 1M context)

### Debug Log References

- `pnpm dev` startup: `Next.js 16.2.4 (Turbopack)` — `Ready in 382ms`, `GET / 200 in 1328ms`
- `pnpm build`: 4 routes prerendered, compiled in 1529ms
- `pnpm lint` / `pnpm typecheck` / `pnpm test:tokens`: all green

### Completion Notes List

**Done**
- Tasks 1–4, 6, 7, 8 fully complete. Story 5 partially complete (typecheck script + lint pass green; the Vercel + GitHub link itself requires the user).
- Build, lint, typecheck, and the token-mapping smoke test all pass locally.

**Deviations from the spec (recorded — not surprises)**

1. **Tailwind 4, not 3.** `create-next-app` v16.2.4 ships Tailwind 4, which uses the CSS-first `@theme` directive in `app/globals.css` instead of `tailwind.config.ts`. There is no `tailwind.config.ts` in this project. Token-to-utility mapping is in `globals.css` under `@theme inline`. Documented in `AGENTS.md` under "Deviations from the architecture document".
2. **shadcn `toast` is deprecated.** The story called for `pnpm dlx shadcn@latest add ... toast`, but the shadcn CLI now redirects `toast` to `sonner`. Used `sonner` instead (the official replacement). The component lands at `components/ui/sonner.tsx`. Story 3.2's UndoToast may build on this or roll its own pill UI — defer to that story.
3. **shadcn primitives ship on `@base-ui/react`, not Radix.** The current shadcn `base-nova` style (chosen by `init -d`) uses `@base-ui/react` rather than the historical Radix bindings. The no-modals ESLint rule blocks **both** namespaces (`@radix-ui/react-{dialog,alert-dialog}` and `@base-ui/react/{dialog,alert-dialog}`) so future shadcn upgrades cannot silently reintroduce a modal.
4. **shadcn-token aliases in `globals.css`.** To keep the shadcn primitives (button, input, textarea, sonner) on-brand without parallel token systems, shadcn's internal vars (`--primary`, `--ring`, `--muted-foreground`, `--card`, etc.) are aliased onto our v1 tokens at `:root`. Visual changes happen by editing the v1 tokens; the alias mappings are mechanical.
5. **Node version.** Local development uses Node v25.8.2; `.nvmrc` pins Vercel to Node 22 LTS. No incompatibilities observed in build/lint/typecheck. Switch to Node 22 locally before reproducing CI failures.

**Blocked on user**

- Vercel + GitHub project link is a one-time manual step requiring Vercel dashboard access. After the link, the next push to `main` triggers a production deploy; record the URL in `README.md` and check the Task 5 boxes.
- After the link is in place, we can also push the current branch (`story-1.1-scaffold`) to verify the preview-deploy flow.

**Not done by design (out-of-scope per the story spec)**

- No DB schema, no Drizzle setup, no `db/*` files (Story 1.2 owns).
- No API route handlers or `lib/validation.ts` (Stories 1.3 / 2.1 / 3.1).
- No application components beyond the placeholder `app/page.tsx` (Stories 1.4+).
- No Sentry, no security headers, no GitHub Actions CI workflow (Story 4.3).
- No Vitest config, no Playwright config (Stories 1.2 / 4.3 own those).

### File List

**Net new files (created or generated by `create-next-app` / `shadcn`):**
- `.env.example`
- `.gitignore`
- `.nvmrc`
- `AGENTS.md` (overwrites the create-next-app default; project conventions)
- `CLAUDE.md` (`@AGENTS.md` reference)
- `README.md` (overwrites the prior 2-line placeholder)
- `app/favicon.ico`
- `app/globals.css`
- `app/layout.tsx`
- `app/page.tsx`
- `components.json`
- `components/ui/button.tsx`
- `components/ui/input.tsx`
- `components/ui/sonner.tsx`
- `components/ui/textarea.tsx`
- `eslint.config.mjs`
- `lib/utils.ts`
- `next-env.d.ts`
- `next.config.ts`
- `package.json`
- `pnpm-lock.yaml`
- `pnpm-workspace.yaml`
- `postcss.config.mjs`
- `public/file.svg`
- `public/globe.svg`
- `public/next.svg`
- `public/vercel.svg`
- `public/window.svg`
- `scripts/check-tokens.mjs`
- `tsconfig.json`

**Story spec / planning artifact (not part of the runtime app):**
- `_bmad-output/implementation-artifacts/1-1-scaffold-nextjs-shadcn-vercel.md`

## Change Log

| Date       | Change                                              | Author |
| ---------- | --------------------------------------------------- | ------ |
| 2026-04-28 | Story spec created from epics.md §"Story 1.1" plus context from architecture.md and ux-design-specification.md | bmad-create-story |
| 2026-04-28 | Implementation completed for Tasks 1–4, 6, 7, 8 (Task 5 partially — typecheck/lint done; Vercel link blocked on user) | bmad-dev-story |
