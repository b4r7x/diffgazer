# Thermo-Nuclear Remediation Spec — 2026-06-01 reaudit

- Date: 2026-06-01
- Source audit: `audits/2026-06-01/THERMO-NUCLEAR-REAUDIT.md` (52 active findings N01–N53; N02 refuted)
- Branch baseline: `main` @ `a42db394`; remediation under review was `c1dec6ee..HEAD`
- Execution model: **per-phase Opus Fixer agent → per-phase independent unbiased Opus Validator agent → loop on FAIL**
- Skills every agent loads (per `AGENTS.md`): `code-audit`, `clean-code`, `code-quality`, `anti-slop`, `test-behavior-not-implementation`; React work also `react-senior-guide` (+ `react-useeffect`, `react-useref`, `react-anti-patterns`); public-handoff work also `sota` / `sota-verify`.

This spec is self-contained. A driver (orchestrator, or the `Workflow` tool) runs each phase: dispatch the Fixer with the phase's finding IDs, then dispatch a **fresh** Validator that has never seen the Fixer's reasoning. The Validator independently judges each finding `resolved | partial | not-fixed | regressed`, scans the phase diff for new defects/slop, and returns a phase gate `PASS | FAIL`. On `FAIL`, append the Validator's findings to the phase's worklist and re-run the Fixer, then re-validate. Advance only on `PASS`.

> Kickoff prompt for the orchestrating agent lives in a separate file: `audits/2026-06-01/HANDOFF.md`.

---

## Global operating rules (every Fixer)

- [ ] Read `AGENTS.md` and the relevant entries in `audits/2026-06-01/THERMO-NUCLEAR-REAUDIT.md` before editing.
- [ ] `git status --short` before the first edit and before handoff. Preserve unrelated dirty files. Never revert unrelated work.
- [ ] Use `rg` for search and surgical edits (`apply_patch`/Edit). No broad rewrites, renames, or dependency changes unless a finding requires it.
- [ ] Fix root causes. Do not silence symptoms with permissive fallbacks or weakened tests.
- [ ] Keep public contracts consistent across source, docs, examples, **generated public registries**, and package exports.
- [ ] Add **behavior** tests (not implementation-detail) for any logic/API/a11y/registry/CLI/deploy-gate change. Assert user-visible behavior or public output; accessible queries; no `vi.mock` of internal modules.
- [ ] **Do not introduce audit/ticket-id comments** (`F0xx`, `KEY-0xx`, `STRUCTURE.md §x`) into source **or tests** — this was itself a finding (N13/N15/N28/N29/N51). Keep only durable rationale.
- [ ] Regenerate committed public registries (`libs/ui/public/r`, `libs/keys/public/r`) and bundles when their source contract changes; never commit deterministic generated data under `*/docs/generated` or `cli/add/src/generated`.
- [ ] Run the phase's narrow gates, then `git diff --check`. Record pass/fail evidence (command + result) in the phase status block. "Took too long" is not a valid skip.
- [ ] Scope edits to the phase's owned packages. If a fix needs another phase's files, note it; do not reach across.

## Global rules (every Validator) — UNBIASED

- The Validator is a **fresh** Opus agent. It receives: this spec, `THERMO-NUCLEAR-REAUDIT.md`, the phase's finding IDs, and the phase diff (`git diff <phase-base>..HEAD`). **It does NOT receive the Fixer's notes or self-assessment.**
- Re-derive each finding's status from the **current code**, by reading the cited files — do not trust that an edit exists or works. Where a behavioral claim is checkable, read the test and confirm it actually asserts the behavior (not internal state). Run the listed verification commands yourself.
- Independently scan every file in the phase diff for: regressions, new bugs, new anti-slop (comments/dead code/ticket-ids), weakened or deleted tests, broken public-registry parity, and boundary violations (`libs/core` importing `apps/*`/`cli/*`, `libs/ui` importing app code).
- Return per finding: `resolved | partial | not-fixed | regressed` + file:line evidence. Return phase gate `PASS` only if **all** owned findings are `resolved` AND the diff introduced no new defect/slop/regression. Otherwise `FAIL` with a concrete worklist.
- Default to skepticism: if you cannot prove a finding is resolved from the code, it is not resolved.

## Reusable agent prompts

### Fixer prompt (fill `{PHASE}`, `{IDS}`, `{PACKAGES}`, `{GATES}`)
```text
You are the Fixer for {PHASE} of /Users/voitz/Projects/diffgazer-workspace/audits/2026-06-01/THERMO-NUCLEAR-REMEDIATION-SPEC.md.
Load skills: code-audit, clean-code, code-quality, anti-slop, test-behavior-not-implementation (+ react-senior-guide for React).
Read AGENTS.md and the {IDS} entries in audits/2026-06-01/THERMO-NUCLEAR-REAUDIT.md. Run git status --short first; preserve unrelated changes.
Resolve exactly {IDS}. Honour the phase Decisions in the spec. Keep edits within {PACKAGES}. Add behavior tests for changed logic. Do NOT add ticket-id comments or weaken tests. Regenerate public registries/bundles if their source changed.
Run the phase gates: {GATES}. Then git diff --check. Report: files changed, per-finding what-you-did + the proof path, commands run + results, any decision taken, remaining risk, untracked files.
```

### Independent Validator prompt (fill `{PHASE}`, `{IDS}`, `{PHASE_BASE}`, `{GATES}`)
```text
You are an INDEPENDENT, UNBIASED Validator for {PHASE}. You did not write these fixes and must not assume they are correct.
Inputs: this spec, audits/2026-06-01/THERMO-NUCLEAR-REAUDIT.md, the finding IDs {IDS}, and the diff: git diff {PHASE_BASE}..HEAD.
Do NOT read any Fixer notes. Re-derive truth from the current source.
For each of {IDS}: read the cited files, decide resolved | partial | not-fixed | regressed, cite file:line proof. For behavior claims, open the test and confirm it asserts user-visible behavior, not internal state/refs/call-counts.
Run {GATES} yourself and record the real output. Independently scan every file in the diff for regressions, new bugs, new anti-slop (comments/dead code/ticket-ids), weakened/removed tests, public-registry drift, and boundary violations.
Return: per-finding verdict table, any NEW findings with file:line, the gate results, and a single phase gate PASS or FAIL. PASS only if all {IDS} are resolved AND the diff introduced nothing new. Otherwise FAIL with a concrete worklist.
```

Convergence per phase: run Fixer → Validator. If `FAIL`, feed the Validator worklist back to a Fixer pass, then a **new** Validator. Stop the phase only on `PASS`. Carry forward Validator-found cross-phase issues to their owning phase.

---

## Phase 0 — Release gate green (apps/docs lint/format + gate coverage)

**Owns:** release blocker (biome 133 errors), N39, N47, N22.
**Packages:** `apps/docs`.
**Why first:** isolated, low-risk, and unblocks CI (`release-check`/`test-ci` run `pnpm run check`). Do it before anything that will re-run gates.

**Decisions:** none.

**Fix tasks:**
- [ ] Make `pnpm run check` pass for `@diffgazer/docs`: `pnpm --filter @diffgazer/docs exec biome check --write`, then hand-apply the unsafe ones — `breadcrumbs.tsx:49` string-concat → template literal; `vite.config.ts:5` `path` → `node:path`; sort imports; fix all formatter diffs. Inspect every auto-edit; revert any that change behavior.
- [ ] N39: bring the F017-touched docs scripts into the lint gate — `apps/docs/biome.json` currently excludes `scripts/`; include `scripts/generate-sitemap.mjs` + its test so `pnpm run check` actually covers them, then fix the real violation surfaced.
- [ ] N47: fix `apps/docs/scripts/generate-sitemap.d.mts:7` so `writeSitemap`'s return type includes `robotsTarget` (matches `generate-sitemap.mjs:155–176`), or delete the hand-maintained `.d.mts` if the `.mjs` can be typed directly.
- [ ] N22: fix the stale comment in `apps/docs/src/components/breadcrumbs.test.ts:35-37` (it claims it skips when content is absent but hard-asserts presence) — make the comment match the assertion or make the test match the comment.

**Fixer gates:** `pnpm --filter @diffgazer/docs exec biome check` · `pnpm --filter @diffgazer/docs type-check` · `pnpm --filter @diffgazer/docs test -- generate-sitemap breadcrumbs` · `pnpm run check`.

**Independent validation:** Validator runs `pnpm run check` (must exit 0) and confirms `apps/docs/biome.json` no longer excludes the sitemap scripts, the `.d.mts` matches the impl, and the breadcrumbs test comment matches its assertions. PASS requires `pnpm run check` green and no behavior change in `breadcrumbs.tsx`.

---

## Phase 1 — Server/CLI shutdown + lifecycle correctness

**Owns:** N01, N07, N34 (CL-SHUTDOWN), N03, N04, N35, N36, N37, N50.
**Packages:** `cli/server`, `cli/diffgazer`.
**Why:** these share the server lifecycle; fix shutdown, dead server code, and the URL/devex gaps together so one set of server-lifecycle tests covers them.

**Decisions:**
- N01/N07/N34: the **packaged** binary must abort sessions on shutdown the way dev does. Export `shutdownSessions` from `@diffgazer/server` (it is in `cli/server/src/features/review/sessions.ts:191`; ensure it is re-exported via `cli/server/src/index.ts`) and call it inside `embedded-server.ts` `stop()` **before** `server.close()`. Treat as the real completion of F018.
- N37: the XSS test asserts a false security property. Decide: keep `JSON.stringify` injection of the token into the SPA shell **and** add real escaping for `</script>` / `<!--` sequences (HTML-safe JSON), then make the test assert the *escaped* output. Do not delete the test — fix the property it checks.

**Fix tasks:**
- [ ] N01/N07/N34: wire `shutdownSessions()` into `cli/diffgazer/src/lib/servers/embedded-server.ts` `stop()` (abort active sessions + close subscribers before/while `server.close()`); add a behavior test that an active session is aborted on packaged-server stop.
- [ ] N03: the env-overridable child force-kill delay (`cli/diffgazer/src/config.ts:22-28`) can exceed the hardcoded parent grace timeout (`create-process-server.ts:128-143`) and orphan the process. Derive the parent grace from the child delay (grace > kill delay) or clamp; add a test for delay > grace.
- [ ] N04: print the server URL on web launch (`server-factories.ts` / `web-launcher.ts`) so the app is reachable when auto-open fails.
- [ ] N35: `cli/server/src/app.ts:141-157` double-logs crashed requests and the `onError` header-set is dead; remove the dead branch and the inaccurate comment, log once.
- [ ] N36: remove the test-only dead re-export alias `readOrCreateProjectFile` (`cli/server/src/shared/lib/config/state.ts:190`) and update its test to use the real export.
- [ ] N37: harden HTML-shell token injection + fix the misleading test (see Decisions).
- [ ] N50: remove the unreachable SPA-fallback branch in `embedded-server.ts:120-126` (dead `rewriteRequestPath`).

**Fixer gates:** `pnpm --filter @diffgazer/server test` · `pnpm --filter @diffgazer/server type-check` · `pnpm --filter diffgazer test` · `pnpm --filter diffgazer type-check`.

**Independent validation:** Validator confirms `embedded-server.ts stop()` actually invokes the exported `shutdownSessions` (trace the import) and that a test proves session abort on packaged stop; confirms the grace/kill ordering is now invariant; confirms N35/N36/N50 dead code is gone with no behavior loss; confirms the N37 test asserts escaped output and the escaper neutralizes `</script>`. Runs both packages' tests. PASS requires all 9 resolved with no new dead code/slop.

---

## Phase 2 — Review resume scope contract (F010 completion)

**Owns:** N10, N19, N25, N27, N45 (CL-RESUME).
**Packages:** `cli/server`, `libs/core`, `apps/web`.
**Why:** one coherent decision drives all five; they are the same half-wired feature plus two encoding bugs.

**Decisions (REQUIRED before fixing — product call):**
- **Option A (complete the feature):** make a real consumer pass the scope so scoped reviews are discoverable on resume — `apps/web` home/resume flow passes `{files, lenses, profile}` into the active-session query; `libs/core` hook/query layer (`api/hooks/queries/review.ts`, `api/hooks/review.ts`) threads scope through; keep server parsing. Add an end-to-end test: scoped create → active lookup returns it.
- **Option B (remove dead plumbing):** if scoped resume is not a product requirement, revert the scope param from `libs/core/src/api/review.ts:108-131/175-176`, the hook/query layer, and `cli/server/src/features/review/schemas.ts`/`review-routes.ts`, restoring mode-only active lookup; delete the now-unused `getActiveReviewSession` scope arg (N10).
- Default recommendation: **A** if any UI exposes per-scope reviews; otherwise **B**. Pick one and record it; do not leave the plumbing half-wired.

**Fix tasks (both options):**
- [ ] N45: stop encoding file scope as comma-joined CSV (`review.ts:124-126`, `schemas.ts:23-46`) — a path containing `,` or whitespace corrupts the scope key. Use a length-prefixed/JSON or per-file-hashed key, or `encodeURIComponent` per file.
- [ ] N19: dedup `lenses` in the active-session scope-key the same way creation does (`schemas.ts:36-46`, `sessions.ts:21-37`), so a duplicate-lens resume query matches its own session.
- [ ] N10/N25/N27: resolve per the chosen option (wire end-to-end, or remove) so no dead capability remains.

**Fixer gates:** `pnpm --filter @diffgazer/server test` · `pnpm --filter @diffgazer/core test` · `pnpm --filter @diffgazer/web test` · type-check for all three.

**Independent validation:** Validator confirms there is **no half-wired state**: either a real caller passes scope and an end-to-end test proves resume discovery (Option A), or the scope param is fully gone with mode-only lookup restored and tests updated (Option B). Confirms the CSV and lens-dedup bugs are fixed with tests. PASS forbids "plumbing exists but nothing calls it".

---

## Phase 3 — Public libs: UI/keys hooks correctness + registry security

**Owns:** N05, N33 (registry path safety), N09, N08, N16, N32 (floating/active-heading realm + freeze), N17, N18, N26 (floating DRY), N52, N14 (keys dead code/realm).
**Packages:** `libs/registry`, `libs/ui`, `libs/keys` (+ regenerate `libs/ui/public/r`, `libs/keys/public/r`).
**Why:** all touch public/copy-handoff contracts; fix then regenerate registries once.

**Decisions:**
- N17/N18/N26: the F007 fix left single-use object-form twins behind the public positional helpers with a misleading comment. Decide: **inline** the object-form helpers into the positional public functions (preferred — removes the dead indirection) and delete the inaccurate justification comment. Keep the public positional signatures unchanged (that was the point of F007).

**Fix tasks:**
- [ ] N05: `libs/registry/src/shadcn/validate.ts` validates `file.path` but not `file.target` (the field that controls shadcn copy-install write location) — apply the same reject-absolute/reject-`..` refinement to `file.target`. Add rejection tests.
- [ ] N33: validate public-registry **INDEX** `files[]` too (`validate.ts:139/54/152`) — currently never path-checked nor compared to source. Add safety + source-comparison; add a test.
- [ ] N09: `use-active-heading.ts:225` — scroll-spy permanently freezes when `scrollTo` targets an already-in-view heading (the suppress flag never clears). Clear the programmatic-scroll guard even when no scroll event fires (e.g. settle via rAF/timeout or detect no-op). Add a behavior test.
- [ ] N08/N16/N32: apply F006's realm fix to `use-floating-position.ts` — replace host-realm `instanceof HTMLElement` (`:80`) with a `doc.defaultView`-derived check; use the trigger's own view for `ResizeObserver` (`:160-163`); add the cross-realm regression test the active-heading hook already has (close the asymmetry).
- [ ] N17/N18/N26: inline the object-form floating helpers (see Decisions); fix the misleading comment in `compute-floating-position.ts`.
- [ ] N52: remove the dead realm helper `isNode` (`libs/keys/src/dom/dom.ts:21`) exported only to its test and duplicated inline at its one call site (`use-focus-trap.ts:84`); regenerate keys registries.
- [ ] N14: `libs/keys/src/dom/navigation-items.ts:56-57` uses global `Node` constants — use the element's own realm (`ownerDocument.defaultView`) per the codebase's realm-correctness convention; regenerate `navigation.json`.
- [ ] Regenerate + validate: `pnpm run prepare:artifacts` then `pnpm run validate:artifacts:check`; ensure `libs/ui/public/r` + `libs/keys/public/r` reflect every source change.

**Fixer gates:** `pnpm --filter @diffgazer/registry test` · `pnpm --filter @diffgazer/ui test` · `pnpm --filter @diffgazer/keys test` · type-check for the three · `pnpm --filter @diffgazer/ui validate:registry` · `pnpm --filter @diffgazer/keys validate:registry` · `pnpm run prepare:artifacts && pnpm run validate:artifacts:check`.

**Independent validation:** Validator confirms `file.target` and INDEX `files[]` reject `/abs` and `../escape` (reads the schema/refinement and the new tests); confirms the scroll-spy freeze and cross-realm fixes have real behavior tests; confirms the object-form twins are gone (no dead indirection) with public positional signatures intact; confirms public registry JSON matches source (diff `public/r` vs source). PASS requires registries regenerated and `validate:artifacts:check` green.

---

## Phase 4 — Web app correctness + dead code

**Owns:** N06, N21, N38, N53, N46.
**Packages:** `apps/web`.

**Decisions:** none.

**Fix tasks:**
- [ ] N06: `apps/web/src/utils/download.ts:7-12` revokes the blob object URL synchronously after `click()`, which aborts the download in Safari/WebKit. Revoke on a later tick (e.g. `setTimeout(revoke, …)` or after a load/animation frame) so the download starts. Add a test around the revoke timing.
- [ ] N38/N53: `clearScopedRouteState("/review", "highlighted")` (`home-presentation.tsx:119-126`) and the settings-hub equivalent (`settings/components/hub/page.tsx:56-61`) target a scope/key no component writes (and the wrong destination scope) — the calls are dead. Either fix the scope to the real `/review/<id>` pathname + key that is actually written, or remove the dead calls. Verify against `use-scoped-route-state.ts`.
- [ ] N21: collapse the two-layer app-local re-export indirection for `isApiError` (`use-review-error-handler.ts:6` → `hooks/index.ts` → `page.tsx:12`); import from source.
- [ ] N46: remove the unused `useViewportBreakpoint` hook (`apps/web/src/hooks/use-viewport-breakpoint.ts:36`) and the dead `apps/web/src/hooks/index.ts` barrel (confirm zero importers with `rg`).

**Fixer gates:** `pnpm --filter @diffgazer/web test` · `pnpm --filter @diffgazer/web type-check`.

**Independent validation:** Validator confirms the download revoke is deferred (and a test pins it), the scoped-route calls either target a key a component actually writes or are removed, the `isApiError` indirection is gone, and `useViewportBreakpoint`/the barrel have zero importers before deletion (`rg`). PASS forbids leaving any dead call "in case".

---

## Phase 5 — Core schema/state + anti-slop sweep + scripts/CI/deploy lows

**Owns:** N11, N12, N30, N31, N44, N49 (core); N13, N15, N28, N29, N51, N20 (anti-slop/dead-code sweep); N42, N43, N48, N40, N23, N24, N41 (scripts/CI/deploy/docs).
**Packages:** `libs/core`, `libs/keys`, `libs/ui` (test comments), `cli/server`, `cli/add`, `scripts/monorepo`, `apps/hub`, `apps/landing`, `deploy`, root `package.json`.
**Why last:** lowest risk; many are comment/dead-code deletions and CI/doc hygiene. Run the full gate suite at the end because this phase touches the most packages.

**Decisions:**
- N30: decide the terminal transition — on `SESSION_STALE`/`SESSION_NOT_FOUND`, `useReviewStream.resume` must set `isStreaming=false` (the state machine should reach a terminal state, not hang mid-stream). Add a behavior test driving resume into a stale session.

**Fix tasks:**
- Core: N11 keep the literal error-code union instead of widening `code` to `string` (`schemas/errors.ts:35-46`); N12 remove the dead `AgentMetaSchema.emoji` (accepted-then-stripped, never produced/consumed); N30 fix the resume terminal transition (see Decisions); N31 derive `isStepEvent`'s type set from the `StepEventSchema` discriminant literals (single source of truth) instead of a hardcoded duplicate Set; N44 fix/remove the stale DRY comment in `review/display.ts` that references a deleted web file; N49 tighten the dist ESM guard's over-permissive `.json` exclusion (`verify-dist-esm-imports.ts:32`).
- Anti-slop ticket-IDs (CL-TICKET-IDS): N13 (`schemas/presentation/shortcuts.ts`), N15 (`use-focus-restore.ts` KEY-019/020 + "known limitation" hedging), N28/N29 (ui test files F005/F006/F007 + scripts test F012/F015), N51 (`sessions.test.ts` F151/F155). Remove ticket IDs and future-work hedging; keep durable rationale only. N20: remove the unreachable keys fallback in `cli/add/src/commands/remove.ts:26-28`.
- Scripts/CI/deploy/docs: N42 add a test that the **real** per-PR gate (`verify`/`release-readiness.yml`) enforces bench strictness (not only the CI-unused script); N43 remove the redundant non-strict second `smoke:packages` in `release-check` (`package.json:25/31`); N48 add the missing `checkSlo` clean-pass test (`benchmark-slo.test.mjs`); N40 add `apps/hub` `tsconfig.test.json` + `test:types` to match sibling SPAs; N23 add `noEmit` to `apps/hub/tsconfig.json` so `tsc -b` does not emit throwaway JS; N24 wire `VITE_DOCS_ORIGIN` into the landing deploy path or remove the dead config (`apps/landing/.env.example:6`, `deploy/landing.Dockerfile:16`, `docker-compose.yml:61`); N41 update stale `deploy/REVERSE_PROXY.md` (content type + Coolify watch paths after hub became a lib-consuming SPA).

**Fixer gates:** `pnpm --filter @diffgazer/core test` · core/keys/ui/server/add type-check + test · `pnpm run test:scripts` · `pnpm --filter @diffgazer/hub type-check` · `pnpm run check`.

**Independent validation:** Validator greps the full repo for any remaining ticket-id comments (`rg -n "F0[0-9]{2}|KEY-0[0-9]{2}|STRUCTURE\.md"` in `src`/test dirs → must be zero outside `audits/`); confirms N11/N12/N30/N31 with tests; confirms each deletion has zero importers; confirms hub `test:types` exists and runs; confirms `release-check` no longer double-runs `smoke:packages`. PASS requires the ticket-id grep clean and `pnpm run test:scripts` green.

---

## Final cross-phase verification (run after Phase 5 PASS)

Independent **final** Validator (fresh Opus) runs the full suite and the re-audit, treating the whole `c1dec6ee..HEAD` + remediation diff as in-scope:

- [ ] `git diff --check`
- [ ] `pnpm run prepare:artifacts` · `pnpm run validate:artifacts:check`
- [ ] `pnpm run check`  ← must now be green (Phase 0)
- [ ] `DIFFGAZER_SKIP_ARTIFACT_PREPARE=1 pnpm exec turbo run type-check`
- [ ] `DIFFGAZER_SKIP_ARTIFACT_PREPARE=1 pnpm exec turbo run test`
- [ ] `DIFFGAZER_SKIP_ARTIFACT_PREPARE=1 pnpm exec turbo run test:types`
- [ ] `pnpm run test:scripts`
- [ ] `DIFFGAZER_SMOKE_STRICT_SKIPS=1 pnpm run smoke`
- [ ] `DIFFGAZER_SMOKE_STRICT_SKIPS=1 pnpm run bench`
- [ ] `pnpm run verify:monorepo`
- [ ] Package dry-runs if public handoff changed: `pnpm --filter @diffgazer/{add,ui,keys} pack --dry-run` · `pnpm --filter diffgazer pack --dry-run`
- [ ] Re-audit: confirm every N0x–N5x evidence path no longer reproduces; scan the diff for NEW issues; if any unresolved/new finding, route it to its owning phase and loop.

**Final handoff must list:** files changed, findings resolved (and the F010/F018 decisions taken), commands run + results, commands skipped + why, remaining risks, untracked files required.

---

## Decision register (fill before/while executing)

| ID(s) | Decision | Chosen | Rationale |
|---|---|---|---|
| N10/N25/N27 (F010) | Wire scope end-to-end (A) vs remove plumbing (B) | **B — remove dead plumbing** | Verified from code: every `getActiveReviewSession` caller is mode-only (page.tsx:55, home-presentation.tsx:146/151) and `createReview` is `{ mode }`-only (home-presentation.tsx:132). No UI exposes per-scope reviews, so per AGENTS.md delete the half-wired scope surface; mode-only lookup restored. N45/N19 resolved by removing the CSV/lens-dedup query surface. |
| N37 | Harden HTML-shell escaping + fix test | **Harden** — keep JSON.stringify, add `</script>`/`<!--` HTML-safe escaping; test asserts escaped output (test not deleted) | spec default; closes latent sink + misleading test |
| N17/N18/N26 | Inline object-form floating helpers | **Inline** object-form twins into positional public fns; delete misleading comment; keep public positional signatures | spec default; removes dead indirection while preserving F007 |
| N30 | Terminal `isStreaming=false` on stale resume | **Dispatch RESET** on SESSION_STALE/SESSION_NOT_FOUND in resume() so the state machine reaches a terminal state | spec default; still returns err() to caller |
| N38/N53 | Fix scope key vs remove dead calls | **Remove** the dead `clearScopedRouteState` calls (no component writes those keys); keep the real `/settings` destination clear at home-presentation.tsx:192 | spec default; no component writes `/review:highlighted` or the destination settings keys |

## Phase status (fill during execution)

| Phase | Owns | Fixer result | Validator gate | Rounds |
|---|---|---|---|---|
| P0 | docs lint gate, N39, N47, N22 | done (91-file biome reformat + a11y/type/blocker fixes, apps/docs only) | **PASS** (orchestrator confirmed `pnpm run check` green) | 1 |
| P1 | N01,N03,N04,N07,N34,N35,N36,N37,N50 | done (shutdownSessions wired into embedded stop(); gracefulMs derived from forceKillMs; ready URL printed; onError single-log; dead alias + rewriteRequestPath removed; HTML-shell token hardened) — gates green | **PASS** (server 486 + diffgazer 219 tests; orchestrator spot-checked wiring; build-coupling note carried to final) | 1 |
| P2 | N10,N19,N25,N27,N45 | done (Option B: removed half-wired scope surface in libs/core client + cli/server schema/route/router; N45/N19 eliminated by construction; create-side retained) | **PASS** (server 486 + core 410 + web 273 tests; orchestrator confirmed dead symbols gone, scope clean) | 1 |
| P3 | N05,N08,N09,N14,N16,N17,N18,N26,N32,N33,N52 | done (registry file.target+index path guards w/5 tests; cross-realm floating fixes w/true JSDOM tests; scroll-spy settle timer; *From inlined; isNode wired; documentOrder shared; registries regenerated) | **PASS** (registry 175 + ui 2558 + keys 621 tests; validate:artifacts:check green; orchestrator confirmed no bare host-realm check + registry sync) | 1 |
| P4 | N06,N21,N38,N46,N53 | done (Safari download deferred-revoke +test; isApiError indirection collapsed; dead clearScopedRouteState calls removed; useViewportBreakpoint+barrel deleted) — carryover: getBreakpointTierFromPx orphaned → P5 | **PASS** (web 276 tests; orchestrator confirmed scope + orphan) | 1 |
| P5 | N11,N12,N13,N15,N20,N23,N24,N28,N29,N30,N31,N40,N41,N42,N43,N44,N48,N49,N51 (+P4 carryover getBreakpointTierFromPx) | done (literal error-code union; dead emoji; RESET-on-stale-resume; schema-derived isStepEvent; ticket-id sweep clean; hub test:types/noEmit; deploy doc/env; CI gate tests; dead exports removed) | **PASS** (core 412 + test:scripts 18 + hub test:types; ticket-id grep clean; validate:artifacts:check OK) | 1 |

## Final cross-phase verification — outcome (orchestrator-run)

All 52 active findings (N01–N53, minus refuted N02) resolved; F010=Option B, F018 completed in the packaged binary. Full-suite gates run on the integrated `a42db394..worktree` diff (uncommitted):

| Gate | Result |
|---|---|
| `git diff --check` | ✅ clean |
| `prepare:artifacts` + `validate:artifacts:check` | ✅ OK |
| `pnpm run check` (release gate) | ✅ green (FULL TURBO) |
| turbo `type-check` (11 pkgs) | ✅ 11/11 |
| turbo `test` (399 test files) | ✅ 11/11 |
| turbo `test:types` | ✅ 16/16 (incl. new hub) |
| `test:scripts` | ✅ 18/18 |
| strict `smoke` (cli+packages+shadcn) | ✅ all OK |
| strict `bench` | ✅ SLOs met (p95 17.6ms) |
| `verify:monorepo` | ✅ all PASS |
| pack dry-runs (add/ui/keys/diffgazer) | ✅ clean |
| ticket-ID sweep (`F0xx`/`KEY-0xx`/`slot-07`) | ✅ zero outside `audits/` |
| public registries (`public/r`) | ✅ byte-identical to fresh regen (snapshot-verified canonical) |

**Re-audit (8 adversarial agents):** 7/8 slices CLEAN, **0 regressed findings, 0 weakened tests.** The 1 high-severity "stale registry" finding from the cross-cutting agent was **REFUTED** — it compared against the pre-remediation `HEAD` baseline and mis-counted single-line JSON; direct verification (occurrence counts, snapshot-diff against fresh regen, registry tests 175/175, end-to-end shadcn smoke) confirms `public/r` contains every P3 fix and is canonical. The re-audit agents themselves transiently dirtied `public/r` (parallel revert/restore + regen on the shared tree); regenerating from the verified-correct source restored canonical state, re-confirmed green.

**Recommendation (process hardening, not a finding):** `validate-artifacts.mjs` does not diff `public/r` against a fresh regen, so registry staleness is not gated. Consider adding `pnpm run prepare:artifacts && git diff --exit-code -- libs/ui/public/r libs/keys/public/r` to `release-check`.
