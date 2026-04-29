# AI Collaboration Retrospective

> **Scope.** This retrospective is grounded in the project's git history, the artifacts in `_bmad-output/`, the BMad workflow table in [`README.md`](../README.md#bmad-workflow-used-on-this-project), and the assistant sessions whose outputs are committed to the repo. Cross-session anecdotes that aren't visible in the artifacts are flagged `[user-fill]` for the human developer to complete from memory.

## 1. Agent Usage — which tasks were completed with AI assistance

### Tasks driven by AI

| Phase | Task | AI surface | Evidence |
| --- | --- | --- | --- |
| Planning | PRD, UX spec, architecture, epics, readiness check | BMad agent skills (`/bmad-create-prd`, `/bmad-create-ux-design`, `/bmad-create-architecture`, `/bmad-create-epics-and-stories`, `/bmad-check-implementation-readiness`) | `_bmad-output/planning-artifacts/`, README table |
| Implementation | Per-story spec + dev for every story in Epics 1–4 | `/bmad-create-story` then `/bmad-dev-story` (split into separate PRs from Story 1.2 onward) | `_bmad-output/implementation-artifacts/`, PRs #3–#22 |
| Quality gates | Vitest unit/integration tests, Playwright E2E suite (incl. `e2e/a11y.spec.ts` with axe-core), the no-modals ESLint rule, the import-graph ESLint rule | `/bmad-dev-story` runs that included tests as part of each story's deliverables | 138 passing Vitest tests + Playwright suite (see `docs/qa-report-2026-04-29.md`) |
| Reporting | QA report (perf trace, Lighthouse, axe-core WCAG AA scans, security review), local-development setup docs | Direct Claude Code sessions | `docs/qa-report-2026-04-29.md`, `README.md`, PRs #22–#23 |
| Tooling | `scripts/axe-scan.mjs` (deploy-agnostic a11y scanner) | Direct Claude Code session | PR #22 |

### Tasks AI did not lead (and shouldn't have)

- **Methodology selection.** The decision to use BMad as the planning method was a human call, encoded once in `CLAUDE.md`. Once chosen, AI executed it.
- **Architectural deviations.** `AGENTS.md` records that the architecture document specified Tailwind 3 + `tailwind.config.ts`, but the project ships Tailwind 4 CSS-first via `@theme` in `globals.css`. That swap was a human judgment call against AI-generated planning output.
- **No-modals UX policy.** The "Dialog/AlertDialog/confirm/alert/prompt all forbidden" rule (`AGENTS.md`) is a product/UX decision; AI enforces it via ESLint, but didn't decide it.
- **Approving and merging PRs.** Every PR (#3 onward) was opened by AI and merged by the human after review.

### What prompts worked best

From the directly observed sessions, the patterns that produced the cleanest output:

- **Constraint-named prompts.** "Run performance tests against the web app running locally on podman" is sharper than "test the app". Naming the success criterion ("WCAG AA", "common security issues, document findings and remediations") removes ambiguity about depth.
- **Explicit pointer to the running thing.** "It's already running" / "running locally on podman, port 3000" saves a discovery loop. The contrast: the SSO-gated Vercel preview URL caused an unproductive auth tab before the user pivoted.
- **Iterative confirmation.** Each substantial output (perf, a11y, security, setup docs) was followed by "add to the QA report" / "commit, push, pr" — splitting authoring from persistence let the user redirect cheaply if a section was off.
- **Single-line corrections.** "I closed that accidentally" → reopen. "Use podman, already running" → switch target. Short corrections are reliably applied without re-establishing context.
- **Structured rule files.** `CLAUDE.md` + `AGENTS.md` get auto-loaded into every session; encoding the project's conventions there (naming, import graph, design tokens, DB strategy) means AI doesn't have to be re-prompted on them every time. This is the single biggest leverage in the project.

Patterns that worked less well (this session):

- Pointing AI at a URL behind Vercel Deployment Protection without a bypass token. AI cannot log in for the user; the conversation pauses until an alternative is provided.
- Asking for "a security review" without scope hints. The first answer would have been a generic OWASP recap; the explicit "(XSS, injection, etc.)" pinned it to the actual checklist.

## 2. MCP Server Usage

| MCP server | Used for | What it enabled |
| --- | --- | --- |
| `chrome-devtools` (Chrome DevTools MCP) | Cold-load performance trace (LCP, TTFB, CLS), Lighthouse audits (desktop + mobile, navigation mode), network-request and console listing | A real Chromium runtime against `http://localhost:3000`. Without it the perf section of the QA report would have been theoretical. |
| Vercel skills bundle (`vercel:*`) | Reference for platform-specific guidance (CSP middleware path, env-var commands, deployment protection) | Available; consulted for remediation paths in the security review (`S-1` nonce-based CSP). Not invoked as agents this session. |
| BMad agent skills (`bmad-*`) | The whole planning + per-story implementation flow. Each agent corresponds to a role (PM, architect, UX, dev, QA). | The dominant AI surface for the project. The README table maps each skill to the artifact it produced. |
| `claude-code-guide` agent | Available for Claude Code / Anthropic SDK questions | Not invoked this session. |

`[user-fill]` — earlier sessions may have used additional MCP servers (e.g., Linear / Notion / Slack / Atlassian Rovo are listed as available skills). If invoked, document which.

### How MCP helped

- **Closed the loop on "is it actually fast?"** Static reasoning would have said "it's a small Next.js app with one DB query, should be fine." The Chrome DevTools trace produced concrete numbers (LCP 221 ms, CLS 0.00) and identified the LCP element as a text node, ruling out image/font work as the bottleneck.
- **Lighthouse caught the CSP issue.** The `csp-xss` audit flagged `'unsafe-inline'` on `script-src` as severity High — the same finding I derived independently in the security review. MCP-Lighthouse agreed before I made the manual call, which was a useful cross-check.
- **Made the a11y scan deploy-agnostic.** The Playwright `e2e/a11y.spec.ts` couldn't run against the podman compose stack because it needs direct `DATABASE_URL` access for `TRUNCATE`. The Chrome DevTools MCP let me drive the running app's UI directly; the workaround that emerged (`scripts/axe-scan.mjs`) is now a permanent deploy-agnostic tool.

## 3. Test Generation

### What AI did

- Generated the bulk of the Vitest suite (138 tests, 15 files) as part of `/bmad-dev-story` runs. Each story's spec listed acceptance criteria; the dev agent translated those into tests + implementation.
- Produced the Playwright E2E suite covering the golden path (`complete.spec.ts`), error recovery (`error-recovery.spec.ts`), the delete-undo flow on desktop and mobile, and a dedicated a11y suite (`a11y.spec.ts`) that exercises six UI states with axe-core's WCAG 2.0/2.1 A + AA tags.
- Added the integration-test discipline: `beforeEach` truncates affected tables (`db/queries.test.ts:12`, `app/api/todos/*.test.ts`), so tests share a real Postgres rather than mocks. This was a human decision encoded in `CLAUDE.md` and faithfully applied by AI.

### What AI missed

The QA report's coverage analysis surfaces the consistent gaps:

| Gap | Why AI missed it |
| --- | --- |
| `components/UndoToast.tsx` lines 19–20 — Escape-key bail-out for input/textarea/contenteditable focus | Defensive guard that doesn't appear in any acceptance criterion. AI tests what's in the spec; this branch is "obviously correct" and not exercised. |
| `hooks/use-delete-todo.ts` lines 39–53 — `retryDelete` async path | Async coverage instrumentation may be undercounting; but also: the retry path requires multi-step orchestration (fail → toast → click retry → success) that's hard to script without a test plan that names it. |
| Branch coverage 75 % overall | Most uncovered branches are early-exit `if (!x) return` guards. AI optimizes for happy-path + main-error-path; defensive branches need an explicit "negative-path tests" prompt. |

A second class of misses, harder to quantify: AI tends to **over-test what it just wrote** and under-test integration seams between stories. Story 4.2's retry orchestration touches three earlier stories' code paths; the coverage gap there isn't accidental — it's the natural shape of per-story test authoring.

`[user-fill]` — specific moments in earlier sessions where AI generated a test that passed against incorrect implementation (false-positive tests).

## 4. Debugging with AI

### Concrete case from this session

**Symptom.** The Playwright a11y spec was the obvious tool to "run accessibility audits"; running it should have been one command. It would not have worked against the running container.

**Root cause** (diagnosed in the conversation, not from a session log).
- The app inside the podman compose stack reads `DATABASE_URL=postgresql://todo:todo@db:5432/todo` from its container env (visible via `podman inspect`).
- `db:5432` is on the compose-internal network, not exposed to the host.
- `.env.local` on the host points at a Neon dev branch.
- `e2e/fixtures/test-db.ts:cleanupTodos` connects directly via `pg.Client` using `process.env.DATABASE_URL` from `.env.local` — the *host* value.
- Result: the test would `TRUNCATE` the Neon dev branch while scanning the podman app reading from the *podman* DB. Seeded fixtures wouldn't appear; failures would be noise, not real a11y issues.

**Fix.** Wrote `scripts/axe-scan.mjs`, which drives state purely through the public API/UI (no direct DB access), so any deploy target with a reachable HTTP origin can be scanned.

**Why AI was useful here.** The diagnosis required correlating three artifacts (compose internals, fixture code, env layering) that aren't naturally co-located. Pattern-matching across the repo is what AI does well. The fix decision — *write a workaround instead of refactor the existing spec* — was a judgment call that AI proposed and the human confirmed (the existing spec covers two extra states that the workaround doesn't, so it stays).

## 5. Limitations Encountered

### Where AI fell short

- **No cross-session memory.** Each Claude Code session re-establishes context from `CLAUDE.md`, `AGENTS.md`, the open files, and the short-term conversation. This retrospective itself is partial because of it.
- **Cannot log in or accept credential prompts.** The Vercel preview URL is gated behind Deployment Protection; AI redirected to the login page and stopped, correctly. Bypass requires a token from the human.
- **Static-only security review.** The audit covered code-reading vectors (XSS sinks, parameterization, header gaps). It did not run dynamic analysis (DAST, fuzzing, exploit attempts). For an app this small that's adequate; for anything bigger a human or specialized tooling would be needed.
- **Defensive-branch blindness in tests.** Documented in §3.
- **Tool-loading friction.** The Chrome DevTools MCP's tool schemas are loaded on demand via `ToolSearch`; the first invocation in a session needs an extra round-trip. Minor, but worth knowing.
- **Tendency to add code unprompted.** `CLAUDE.md` explicitly tells AI not to introduce backwards-compat shims, defensive validation for impossible cases, or documentation files unless requested. Without that explicit guidance, the default behavior is to over-build.

### Where human expertise was critical

- **Methodology and architecture decisions encoded in `CLAUDE.md` / `AGENTS.md`.** Tailwind 4 CSS-first, Drizzle node-postgres driver, no-modals UX, mandatory-`userId`-but-always-null forward-compat, the import graph. AI executes these faithfully but did not decide them.
- **Process changes mid-flight.** Story 1.1 was a single combined commit; from Story 1.2 onward the team split spec and dev into separate PRs (PR #4 vs. PR #5). That decision came from the human noticing the spec-isolation benefit; AI followed the new pattern from then on.
- **Severity / risk calibration.** AI produced raw findings in the security review. Whether `S-1 (CSP unsafe-inline)` is a "fix this sprint" or "fix when convenient" is a stakeholder judgment.
- **Spotting AI's quiet drift.** Two examples from this session: (a) AI proposed a 552 KB axe-core inline-injection workaround when a small Node script was the cleaner answer; (b) AI tends to drop "see [extensive context]" hyperlinks in docs that bloat without value. The human's brief correction style ("just commit it", "stop adding") is what keeps documents tight.
- **Final approve & merge.** PRs land only when the human merges. Every artifact produced by AI is reviewable, and review caught the things AI missed.

## Closing notes

The single highest-leverage practice on this project is **encoding decisions in `CLAUDE.md` and `AGENTS.md` once, instead of restating them per session.** Everything downstream — the BMad agent flow, the import-graph rule, the design-token contract, the database strategy, the no-modals UX policy — flows cleanly because those documents are the durable contract between sessions. When AI was wrong (the architecture doc's Tailwind 3 assumption), the fix was to update `AGENTS.md`, not to repeatedly correct AI in the moment.

For a future similar project: invest in those rule files first, then let AI do the volume.
