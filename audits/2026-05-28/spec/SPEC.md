# Audit 2026-05-28 — Remediation Spec

> **For agentic workers:** This spec is executed by **workflows**, not by hand. Each batch is implemented by a fresh Opus subagent, then checked by a **separate, unbiased** Opus validator subagent that runs the real verification commands. See `## Execution Protocol`. Progress is tracked in `CHECKLIST.md` (the coverage ledger).

**Goal:** Resolve every actionable finding in the 2026-05-28 SOTA audit (the 249 `FIX-PLAN.md` checkboxes) through isolated, independently-validated batches, leaving the monorepo green on all verification gates and handoff-ready.

**Architecture:** The audit's `FIX-PLAN.md` is the authoritative, deduplicated remediation index. We partition its 249 checkboxes into **20 batches** (3 Wave-1 + 17 Stage-2), each owned by one package/concern so a single implementer can hold it in context. Batches run **sequentially** (never two implementers editing the shared working tree at once). Each batch follows **implement → unbiased-validate → fix-loop → commit**. The heavy reading/editing happens inside subagents, keeping the orchestrator context lean.

**Tech stack:** pnpm + turbo monorepo; TypeScript/TSX; Vitest; Hono (cli/server); Ink (cli/diffgazer); TanStack Start + Fumadocs (apps/docs); Vite (apps/web, apps/landing); shadcn-compatible registry (libs/ui, libs/keys).

**Source-of-truth documents (implementers/validators read these directly — do NOT re-transcribe them):**
- `../FIX-PLAN.md` — every fix, its `file:line`, approach, effort, and folded `(dupes: …)`. The checkbox list.
- `../STRUCTURE.md` — exact big-file split plans, object-args signatures + call-site updates, naming fixes.
- `../HANDOFF-READINESS.md` — three-path handoff verdicts, the keys optional-peer analysis, the pre-handoff checklist.
- `../INDEX.md`, `../findings/*.md` — per-finding detail and rationale when `FIX-PLAN.md` is too terse.
- `/Users/voitz/Projects/diffgazer-workspace/AGENTS.md` — repository contract, architecture boundaries, verification gates.

---

## Coverage Guarantee (provable, not asserted)

The campaign scope is defined against `FIX-PLAN.md`, the audit's own deduplicated index — **not** the 349 raw findings directly.

**Reconciliation, 349 raw → 249 actionable:**
- **349** raw findings across 23 domains (`INDEX.md`).
- **− 7** verified-good / no-change-needed, explicitly dropped by the audit: `tests-behavior` F75, F76, F77, F78, F79; `libs-keys` F220 (documented DOM-boundary cast); `structure-srp` F343 (accepted artifact-sync mirror).
- **− folded duplicates:** cross-domain repeats collapsed into a single primary item (71 duplicate IDs ride inline as `(dupes: …)`; the apps/landing and libs/core domains were consolidated under `F-landing-*` / `F-core-*` labels).
- **+ 2** manifest/peer items from `HANDOFF-READINESS.md` that have no finding ID (`HANDOFF-1` keys optional-peer, `HANDOFF-2` license field).
- **= 249** actionable `- [ ]` checkboxes (Wave 1: 10, Wave 2: 27, Wave 3: 77, Wave 4: 135).

**The invariant (verifiable by `grep` + the table below):**
1. `CHECKLIST.md` contains **exactly 249** checkboxes.
2. Every one is assigned to **exactly one** batch (no item unassigned, none double-assigned). The per-batch counts sum to 249.
3. The 71 inline `(dupes: …)` IDs are resolved transitively by fixing their primary.
4. A finding is **covered** only when its checkbox is checked — meaning the fix landed AND its batch validator passed — or it is explicitly **deferred** with a written reason in `CHECKLIST.md`.

A separate **HANDOFF-3** release task (author changesets) comes from the `HANDOFF-READINESS.md` pre-handoff checklist; it is a release step, not a code finding, and is tracked under the Final Gate rather than counted in the 249.

---

## Execution Protocol

### Branch & worktree (NO COMMITS — user decision 2026-05-29)

- **Never implement on `main`.** A campaign branch exists (`audit-2026-05-28-remediation`); the planning commit (spec/checklist/runbook) is its **baseline** `BASELINE_SHA`.
- **The workflow commits NOTHING.** Every remediation change is left **uncommitted in the working tree** so the user can review the whole diff (`git diff <BASELINE_SHA>`) and decide what to commit. Implementers/fixers must NOT run `git add`, `git commit`, `git stash`, or `git reset` — only edit files.
- Because there are no per-batch commits, the validator isolates a batch's changes by **path**: `git diff <BASELINE_SHA> -- <the batch's owned paths>`. Batches are path-disjoint and run sequentially, so each batch's path-scoped diff shows only its own work even though all changes coexist uncommitted.

### Per-batch lifecycle (the implement → unbiased-validate → fix loop)

```
for each batch (sequential):
  1. IMPLEMENT  — fresh Opus subagent. Given: batch spec section + pointers to FIX-PLAN/STRUCTURE/HANDOFF.
                  Reads the source-of-truth docs, fixes every finding ID in the batch, adds/updates
                  required tests, runs the batch's SCOPED verification commands until green, self-reviews.
                  Returns: structured report {idsResolved, filesTouched, testsAdded, commandsRun+output, concerns}.
  2. VALIDATE   — fresh Opus subagent with NO implementation context (unbiased). Given: the batch's finding
                  IDs + its owned paths. It must:
                    (a) inspect the batch diff via `git diff <BASELINE_SHA> -- <paths>` and confirm EACH
                        finding ID is actually resolved (or soundly verified-no-change), not just claimed;
                    (b) RE-RUN the batch's scoped verification commands itself and read the output;
                    (c) confirm required tests exist and assert behavior (not implementation details);
                    (d) check the change for AI-slop / over-engineering / scope creep / `.js`-specifier rule;
                    (e) confirm no out-of-scope files were touched.
                  Returns: {verdict: PASS|FAIL, perId: [{id, resolved, evidence}], issues:[…], commandResults}.
  3. FIX LOOP   — if FAIL: a fresh Opus fix-subagent gets ONLY the validator's issue list + paths, fixes them
                  (no commits), re-runs scoped commands. Then re-VALIDATE. Cap: 3 rounds. If still failing →
                  escalate (mark batch BLOCKED in CHECKLIST.md with the blocker, continue independent batches).
  4. RECORD     — on PASS, mark the batch's CHECKLIST.md items checked. NO commit — changes stay uncommitted.
```

**Why one validator (not the skill's two reviewers):** the user asked for "a separated unbiased agent." One comprehensive validator that (a) verifies each ID is resolved, (b) actually runs the gates, and (c) audits quality is faithful and halves agent count at this scale. The non-negotiable invariant is **fresh context + actually running the commands** — a validator that only reads the diff is not validation.

**Why sequential (user-confirmed model):** the firm requirement is **one Opus implementer + one separate Opus reviewer per batch**. Batches run **sequentially**: subagent-driven-development forbids parallel implementers on a shared tree, several batches regenerate shared artifacts (`prepare:artifacts` writes `public/r/*` and generated trees) so concurrent writes would race, and a botched worktree merge could silently drop a fix. Wall-clock isn't binding (background run), so sequential is the safe choice and still satisfies the impl+review pairing. The implementer and reviewer are **distinct `agent()` calls**; the reviewer receives **only the batch's finding IDs + its owned paths** (no implementation context), inspects the change via `git diff <BASELINE_SHA> -- <paths>`, and is required to **run the scoped commands and paste their output** — inferring PASS from the diff is not acceptable.

### Premise verification (do NOT blindly apply the audit)

The audit is a strong index but **not infallible** — some findings are false positives or behavior-neutral. Every implementer **must verify each finding's premise empirically before changing code**: read the actual code + signatures, run the relevant type-check/test, and reason about current-version semantics. **If the current code is already correct, do NOT apply a behavior-neutral or regressive change** — instead mark the item `verified-no-change` in `CHECKLIST.md` with the evidence (e.g. the passing type-check output). The validator independently re-confirms the premise call. Two confirmed examples already found in Wave 1 (B3):
- **F161** — `cycleTierFilter(current: TierFilter): TierFilter`, so `setTierFilter(cycleTierFilterCore)` is already a correct React functional update. The proposed `(current) => cycleTierFilterCore(current)` is behaviorally identical. **Likely false positive — confirm, then keep as-is.**
- **F164** — repo is React **19.2.4**; `<SearchContext value={value}>` is the valid modern Context-as-provider idiom. Changing to `<SearchContext.Provider>` is a **regression**. **Likely false positive — confirm, then keep as-is.**

This rule applies to ALL 249 items, not just these two.

### Scoped vs. full-repo verification

- **Per-batch validation is SCOPED**: `pnpm --filter <pkg> type-check` + that package's focused tests (+ `validate:artifacts:check` for registry/CLI/docs/handoff batches). An early batch may legitimately leave the **root** `turbo type-check` red until a later batch lands its half of a cross-package change — that is expected and is NOT a batch failure.
- **Full-repo green is asserted ONLY at the Final Gate** (below). Scoped-green ≠ repo-green.

### Skills every subagent loads

- All implementers/validators: `code-audit`, `clean-code`, `code-quality`, `anti-slop`.
- React batches (B4, B5, B6, B12, parts of B14): `react-senior-guide` then `react-useeffect`, `react-useref`, `react-anti-patterns`, `react-design-patterns`.
- Validators additionally apply `sota-verify`'s loop discipline (re-verify until clean, including lows/warnings).

### Models

All implementer, validator, and fix subagents use **Opus** (per user instruction). The orchestrator workflow runs at the session model.

---

## Staging

Run as **separate workflow invocations**, reviewed between stages. This de-risks a multi-hour run dying mid-way and proves the loop on the cheapest, highest-value slice first.

| Stage | Batches | Why grouped |
| --- | --- | --- |
| **Stage 1 — Wave 1** | B1, B2, B3 | Handoff-blocking + the 2 Criticals + the 2 npm blockers. Small, highest-value, proves implement→validate→commit end-to-end. **Run this first; review; then proceed.** |
| **Stage 2a — libs** | B4, B5, B6, B7, B8, B20 | Library primitives (keys, ui, registry, core) + ui test-refactors. Foundational; apps/docs consumes ui after this. |
| **Stage 2b — cli** | B9, B10, B11 | server, add, diffgazer. |
| **Stage 2c — apps** | B12, B13, B14, B15, B16 | web, docs (mirror deletion isolated), landing, hub. |
| **Stage 2d — repo-wide** | B17, B18, B19 | scripts/tooling, governance/env, then cross-cutting DRY **last**. |
| **Final Gate** | — | Full-repo verification + changesets (HANDOFF-3). |

**Two batches get their own dedicated workflow run** regardless of stage, due to blast radius / judgment:
- **B2** (keys optional-peer) — DECISION-1; touches ~9 ui components + package.json + a new smoke fixture.
- **B13** (apps/docs registry mirror deletion, F94) — deletes a 600+ file tree; the validator must confirm docs still builds and artifact-sync still passes.

---

## Decisions Required (resolve while reviewing this spec)

These two are genuine judgment calls the audit explicitly flagged. Each batch is written to accept either branch; pick before its stage runs.

### DECISION-1 — `@diffgazer/keys` optional-peer resolution (B2 / HANDOFF-1) — **RESOLVED: Option B (optional + lazy)**

`@diffgazer/keys` is declared an **optional** peer of `@diffgazer/ui`, yet common components (Select, Checkbox, Radio, Accordion, Tabs, Sidebar, ToggleGroup, CommandPalette, DiffView) import it **statically**. A keys-absent install fails opaquely. `HANDOFF-READINESS.md` §PATH(b) gap 1 has the full analysis.

**Decision (user, 2026-05-29): do NOT force consumers to install keys → keep keys OPTIONAL + lazy.** Convert the ~9 keys-backed components to **lazy `import("@diffgazer/keys")`** behind a clear runtime error (mirroring the existing figlet contract) + per-component install docs. A consumer who installs only `@diffgazer/ui` and never touches a keys-backed subpath must build and run with no keys dependency and no opaque failure. B2 **must** add the smoke fixture that installs `@diffgazer/ui` **without** keys and imports a keys-backed subpath — and B2's reviewer **must actually run that fixture** (it is the entire point of the decision and the harder branch). Also add F306's metadata-validation gate.

### DECISION-2 — `apps/hub` scaffold vs. delete (B16 / F183) — **RESOLVED: Option A (minimal, deployable)**

`apps/hub` is a raw-HTML stub with no build/scripts/turbo task.

**Decision (user, 2026-05-29): keep hub, scaffold it MINIMAL and deployable** so subdomain deploy can be validated. Promote the stub to a thin Vite app mirroring `apps/landing` (scripts, tsconfig, vite.config, `src/`, turbo `@diffgazer/hub#build`, `"type":"module"`, `@diffgazer/ui` theme tokens replacing inline hex), resolving F183/F180/F182/F184/F55/F185. **Keep it small** — a minimal portfolio shell, not a full template build. Do **not** extract shared shell primitives (`AppShell`/`SiteHeader`/`SiteFooter`) or a `libs/core` SEO module for it (those are the *reusable-template* goal, explicitly OUT of scope — see below); a little duplicated chrome is acceptable. B16 also emits a correct static `sitemap.xml` + `robots.txt` so the existing `robots.txt` stops pointing at a non-existent sitemap (DEPLOYMENT-ROUTING §3.4).

### Explicitly OUT of scope (deferred — see `DEPLOY-RUNBOOK.md`)

Per the user's "do what's achievable in code; I handle the deploy" + global "no speculative features / no premature abstractions" rules:
- **Reusable-template extractions** — `AppShell`/`SiteHeader`/`SiteFooter` primitives and a shared `libs/core` `./seo` + sitemap generator. Two placeholder consumers do not justify the abstraction; revisit when a third real app exists.
- **docs static-conversion** (search → `staticGET`) — an optional optimization; docs ships fine as Node SSR today. Documented as optional in the runbook.
- **Infra / deploy decisions** — the `deploy.yml` GHCR-vs-Coolify build-model contradiction, apex health check, Coolify resources, wildcard DNS, bringing `r.b4r7.dev` live, npm publish + package-manager matrix. These are the user's infra calls and manual steps → **`DEPLOY-RUNBOOK.md`**, not workflow tasks.

---

## Batch Catalogue

Counts are exact and sum to 249. "Verify (scoped)" lists the commands the implementer must pass and the validator must re-run. "Tests required" lists behavioral IDs that AGENTS.md mandates be covered by tests. Full fix detail lives in the source-of-truth docs — implementers read them.

### Stage 1 — Wave 1

**B1 — Public `.js` import-specifier strip** · 6 · `F316 F317 F196 F186 F188 F119`
- Strip relative `.js` extensions from import specifiers across `libs/keys/src/**`, `libs/ui/registry/**` (+ registry `lib/*` indexes), `libs/core/src/**`; apply the existing `rewriteRelativeJsExtensionsForCopy` in the keys copy-bundle generator (F186); add a `validate-artifacts` gate that fails on any `.js` specifier in the bundle (F188); add source-side assertion in the keys build (F119).
- **`.js` rule (critical, so the validator does not thrash):** source `.ts`/`.tsx` carry **NO** relative `.js` import specifiers; generated `.d.ts` legitimately **do** (declaration emit re-adds them). Validator scans *source*; the F188 gate covers the *build* side.
- Verify (scoped): `pnpm --filter @diffgazer/keys type-check`, `pnpm --filter @diffgazer/ui type-check`, `pnpm --filter @diffgazer/core type-check`, `pnpm run prepare:artifacts`, `pnpm run validate:artifacts:check`.
- Tests required: the new F188 artifact gate must fail on a seeded `.js` specifier and pass after strip.

**B2 — keys optional-peer + license** · 2 · `HANDOFF-1 HANDOFF-2` · **ISOLATED RUN · DECISION-1 = Option B**
- HANDOFF-1 (**Option B, locked**): keep `@diffgazer/keys` an optional peer; convert the ~9 keys-backed components (Select, Checkbox, Radio, Accordion, Tabs, Sidebar, ToggleGroup, CommandPalette, DiffView) to **lazy `import("@diffgazer/keys")`** with a clear runtime error mirroring the figlet contract + per-component install docs; add the **keys-absent smoke fixture** (install `@diffgazer/ui` without keys, build, import a keys-backed subpath, assert graceful error not opaque module-resolution failure). HANDOFF-2: `cli/diffgazer/package.json` `"license": "MIT"` → `"Apache-2.0"`; add a `check-invariants.mjs` assertion that each package `license` field matches its `LICENSE` file.
- Verify (scoped): `pnpm --filter @diffgazer/ui type-check`, `pnpm run smoke` — **the reviewer MUST run the keys-absent fixture and paste its output** (this is the whole point of Option B), `pnpm run validate:artifacts:check`, `node scripts/monorepo/check-invariants.mjs`.
- Tests required: keys-absent install fixture (imports a keys-backed subpath, builds, surfaces the clear error path not an opaque failure); license-field invariant.

**B3 — Critical type-safety** · 2 · `F161 F164` · **PREMISE-VERIFY FIRST (both likely false positives)**
- **F161** & **F164** are flagged Critical but the analysis above shows both are likely correct already (React 19.2.4 functional-updater + Context-as-provider). The implementer must: (a) run `pnpm --filter @diffgazer/web type-check` and `pnpm --filter @diffgazer/docs type-check` against the *current* code; (b) confirm F161's cycling works (a focused test that the filter advances `all → … → all` over repeated calls) and F164's provider supplies context. If both pass, mark each `verified-no-change` in CHECKLIST with the evidence and make **no** code change (do not regress `<Context value>`→`.Provider`, do not add a no-op updater wrapper). Only change code if empirical verification actually shows a defect.
- Verify (scoped): `pnpm --filter @diffgazer/web type-check`; `pnpm --filter @diffgazer/docs type-check`; the two focused tests above (these document the correct behavior even if no code changes).
- Tests required: F161 (tier filter cycles through values on repeated calls); F164 (provider renders + supplies context value) — added as regression guards regardless of the false-positive outcome.

### Stage 2a — libs

**B4 — libs/keys** · 11 · `F6 F7 F218 F219 F1 F2 F3 F4 F5 F109 F206`
- Perf/stability of hook callbacks (F6,F7,F218,F219); remove unprofiled defensive `useMemo`s (F1,F2,F3); export-path/cast cleanups (F4,F5,F109); `isAriaHidden` ancestor-walk honoring `aria-hidden="false"` (F206, `libs/keys/src/dom/focusable.ts`).
- Verify (scoped): `pnpm --filter @diffgazer/keys type-check` + focused keys tests.
- Tests required: F206 (ancestor `aria-hidden="false"` override); F219/F218 stability under rerender.

**B5 — libs/ui components & a11y** · 27 · `F113 F9 F221 F222 F224 F11 F12 F13 F115 F321 F81 F322 F325 F64 F65 F311 F67 F223 F225 F226 F86 F324 F326 F327 F83 F84 F85`
- Component correctness (F113 checkbox-group native validation, F325 radio-group hidden input type), derive-don't-sync invalid state (F11,F12,F13), export consistency (F224 Dialog/Tabs `XRoot`-then-alias per STRUCTURE §Compound), a11y (F321 disabled anchor, F81/F322/F326 hidden-input ARIA, F324 reduced-motion, F327 affix aria-hidden), polish (F64,F65,F67,F223,F225,F226,F86,F83,F84,F85), `SidebarProvider` semantic rename (F311).
- Verify (scoped): `pnpm --filter @diffgazer/ui type-check` + focused ui tests.
- Tests required: F113 (required validation fires `onInvalid`), F325 (radio-group required validation), F11/F12/F13 (invalid state observable behavior).

**B6 — libs/ui hooks, big-file splits, object-args, exports, registry internals** · 16 · `F8 F98 F229 F228 F92 F58 F59 F306 F111 F117 F118 F104 F69 F70 F71 F190`
- Big-file splits + object-args per **STRUCTURE.md §1 (use-listbox + hasDomItem), §2 (menu-item), §3 (select-content), §4 (use-floating-position + computePosition/wouldOverflow/shift/resolveCollisionPosition), §5 (stepper-variants), §8 (validate-registry-metadata → testable validators)**. Hook fixes (F8 deps, F228 notifyExit routing, F111/F117/F118 ref/derive), `use-active-heading` ownerDocument (F92), registry items (F58 aria-utils, F59 portal SSR), package exports (F229, F70, F71, F190 theme), tsconfig (F69), metadata-validation gate (F306).
- Verify (scoped): `pnpm --filter @diffgazer/ui type-check` + focused ui hook tests; `pnpm run validate:artifacts:check` (registry items/exports).
- Tests required: F98 orchestrator preserves public API; new pure-math unit tests for `compute-floating-position` (STRUCTURE §4); F58/F59 registry closure.

**B7 — libs/registry** · 11 · `F121 F128 F120 F123 F125 F126 F233 F122 F124 F129 F234`
- Validation hardening (F121,F126,F233 exhaustiveness), `resetDir` failure-safety (F128), dedup shared validators/schemas (F120,F123,F124), boundary validation (F125,F129,F234), logger contract (F122).
- Verify (scoped): `pnpm --filter @diffgazer/registry type-check` + focused registry tests.
- Tests required: F123 (shared base schema compatibility), F128 (resetDir partial-failure behavior).

**B8 — libs/core** · 9 (+ delivers deferred F196) · `F-core-parse F-core-format F-core-figlet F-core-lifecycle-return F-core-reducer F-core-stepguard F-core-providers-split F319 F68`
- `parse<T>` validation contract (F-core-parse), providers.ts split per **STRUCTURE §9**, review-state event dispatch per **STRUCTURE §10** (F-core-reducer), lifecycle-return grouping per **STRUCTURE §15** (F-core-lifecycle-return), event-type guard (F-core-stepguard), inline single-use helper (F-core-format), figlet divergence doc (F-core-figlet), moduleResolution convergence (F319 — also touches `libs/keys/tsconfig.json`), test-cast labels (F68).
- **F319 MUST ALSO strip `libs/core/src/**/*.ts` relative `.js` specifiers as part of the NodeNext→Bundler flip — this delivers F196** (deferred from B1, which correctly could not strip them while core was NodeNext, since `.js` is required there). Order matters: flip moduleResolution to Bundler FIRST, then strip `.js`, then type-check. **Verify core's CLI consumers still build after the flip** — `cli/server` and `diffgazer` inline core via tsup `noExternal`, so confirm `pnpm --filter @diffgazer/server --filter diffgazer type-check` and the relevant builds stay green.
- Verify (scoped): `pnpm --filter @diffgazer/core type-check` + focused core tests; `pnpm --filter @diffgazer/keys --filter @diffgazer/server --filter diffgazer type-check` (F319/F196 cross-touch); confirm no relative `.js` remain in `libs/core/src` source.
- Tests required: F-core-parse (rejects/flags invalid body), F-core-reducer (event sub-types route correctly).

**B20 — libs/ui tests-behavior refactor** · 9 · `F72 F199 F200 F73 F74 F202 F80 F204 F205` · **(runs after B5/B6)**
- Replace Tailwind-class / `data-slot` / DOM-traversal / event-spy assertions with behavior/role/computed-style assertions per AGENTS.md testing rules; add justification comments to unusual patterns (F80).
- Verify (scoped): `pnpm --filter @diffgazer/ui test` (the refactored suites pass and assert behavior).
- Tests required: this batch *is* tests; validator confirms they assert behavior, not classes.

### Stage 2b — cli

**B9 — cli/server** · 30 · `F24 F149 F151 F251 F26 F27 F100 F101 F146 F147 F148 F156 F253 F28 F29 F154 F95 F96 F155 F157 F158 F249 F250 F252 F384 F385 F386 F396 F393 F394`
- Status-code fix 403→401 (F24, both routers), rate-limit eviction (F149), session interval shutdown (F151), store split per **STRUCTURE §6** + forwarder collapse (F100,F95), context split per **STRUCTURE §7** (F101), `createSession`/`getActiveSessionForProject` object-args per **STRUCTURE §4,§5** (F26,F27), error mapping (F147,F148,F253,F158), path validation (F156), middleware dedup (F146,F29), observability (F384,F385,F386,F396,F393,F394), type/cast/log cleanups (F251,F28,F154,F96,F155,F157,F249,F250,F252).
- Verify (scoped): `pnpm --filter @diffgazer/server type-check` + focused server tests.
- Tests required: F24 (401 not 403; 403 reserved for FORBIDDEN), F149 (eviction bounds the map), F151 (`shutdownSessions()` clears the interval; test teardown), F156 (path containment), F100/F101 (split preserves behavior).

**B10 — cli/add** · 18 · `F145 F22 F137 F138 F140 F143 F304 F303 F307 F308 F309 F63 F141 F142 F144 F198 F103 F320`
- Cleanup-on-signal (F145), dedup `sha256` (F22) + names (F137,F143), scoped workflow-context object replacing module-mutable state (F138), transform object-args per **STRUCTURE §6,§7,§8,§9** (F103), bundle integrity verify-on-load (F63), exhaustiveness (F144), perf hoist (F142), validation (F198,F304,F303,F307,F308,F309), `.js` strip in `cli/add/src` + `cli/diffgazer/src` (F320), comment intent (F140).
- Verify (scoped): `pnpm --filter @diffgazer/add type-check` + focused add tests; `pnpm run smoke:cli` if available, else covered at Final Gate.
- Tests required: F309 (mixed type+value `@/hooks` import consolidation), F138 (workflow-context isolation), F63 (tamper detection).

**B11 — cli/diffgazer** · 9 · `F159 F160 F260 F262 F263 F378 F379 F382 F381`
- setState-during-render → effect (F159), shared constants (F160,F382), remove unused imports/params (F260,F262,F263), build-time version constant (F378), standardized entry error handling (F379, also touches `cli/server/src/dev.ts`), `GET /api/health` readiness probe (F381).
- Verify (scoped): `pnpm --filter diffgazer type-check` + focused tests.
- Tests required: F159 (no setState-in-render warning; focus index clamps), F381 (readiness waits for health 200).

### Stage 2c — apps

**B12 — apps/web** · 17 · `F31 F162 F276 F274 F275 F277 F32 F35 F268 F269 F33 F34 F36 F272 F273 F312 F313`
- Derive-don't-sync `liveState` (F31), 21-prop grouping per **STRUCTURE §14** (F162), keyboard-hook splits per **STRUCTURE §11,§12,§13,§14** (F276,F274,F275,F277), `useReducer` consolidation (F35), render-time-reset → ref/key (F268,F269,F32), remove defensive memo (F33,F36), focus via ref/parent (F272), drop ref duplicating state (F273), `as const`/factory (F34), import core types deleting web dups (F312 theme, F313 InputMethod — update 3 consumers).
- Verify (scoped): `pnpm --filter @diffgazer/web type-check` + focused web tests.
- Tests required: F35 (reducer transitions), keyboard-hook splits preserve nav/focus behavior (F274,F275,F276,F277).

**B13 — apps/docs registry mirror deletion** · 1 · `F94` · **ISOLATED RUN · HIGH BLAST RADIUS**
- Make `apps/docs` consume `@diffgazer/ui` (import/re-export or shared registry pkg) and delete the 600+ file byte-identical mirror of `libs/ui/registry`. Resolves dupes F338,F97,F107,F343,F102,F106,F192,F66 transitively.
- Verify (scoped): `pnpm --filter @diffgazer/docs type-check`, `pnpm --filter @diffgazer/docs build`, `pnpm run prepare:artifacts`, `pnpm run validate:artifacts:check` (docs artifact sync must still pass).
- Tests required: docs build succeeds; registry browser still renders representative items (smoke/focused test).

**B14 — apps/docs content, types, docs-quality** · 22 · `F330 F37 F38 F165 F279 F283 F87 F88 F89 F207 F328 F329 F39 F41 F42 F168 F171 F172 F281 F398 F400 F395`
- Document the 37 undocumented public registry items or mark internal (F330), fumadocs type adapters (F37,F38), inline trivial memo (F165), env-origin handling (F279,F283,F168), MDX docs (F87 regenerate descriptions, F88/F89 install callouts, F207 link fix, F328/F329 missing landing pages), guarded logging (F39), remove pass-through re-exports (F41), generate-or-validate sections (F42), keys (F171,F172,F281), docs biome (F398,F400), perf monitoring (F395).
- Verify (scoped): `pnpm --filter @diffgazer/docs type-check`, `pnpm --filter @diffgazer/docs build`, `pnpm run validate:artifacts:check` (F87 descriptions regenerate clean).
- Tests required: F42 (sections-with-index validated against page tree).

**B15 — apps/landing** · 15 (+ deploy-prep) · `F-landing-a11y-focus F-landing-assets F-landing-docs-url F-landing-landmarks F-landing-code-aria F-landing-test-types F-landing-ui-reuse F-landing-tsconfig-strict F-landing-build-emit F-landing-a11y-test F-landing-jsonld F-landing-wrapper F-landing-strings F-landing-ui-dep F-landing-copy-cmd`
- a11y (focus-visible, landmarks/skip-link, code aria-label, keyboard/axe tests), env-driven docs URL, missing assets, tsconfig strictness + build-emit fix, type-check tests, JSON-LD, string constants, copy-to-clipboard, document `@diffgazer/ui` CSS-only dep.
- **Deploy-prep (absorbed here, no finding ID):** emit a static `sitemap.xml` and add a canonical tag so `apps/landing/public/robots.txt` no longer points at a non-existent sitemap (DEPLOYMENT-ROUTING §3.3–§3.4). Minimal — a one-URL sitemap; do **not** build a shared SEO module.
- Verify (scoped): `pnpm --filter @diffgazer/landing type-check`, `pnpm --filter @diffgazer/landing test`, `pnpm --filter @diffgazer/landing build` (confirm `sitemap.xml` lands in `dist/`).
- Tests required: F-landing-a11y-test (keyboard focus + landmark/skip-link assertions, jest-axe).

**B16 — apps/hub** · 7 (+ deploy-prep) · `F183 F180 F182 F184 F55 F185 F355` · **DECISION-2 = Option A (minimal, deployable)**
- **Scaffold MINIMAL, locked.** Promote the raw-HTML stub to a thin Vite app mirroring `apps/landing`: `package.json` (`"type":"module"` F55, `build`/`dev`/`type-check`/`test` scripts), `tsconfig`, `vite.config.ts`, `index.html`, `src/` (F183); replace inline hex with `@import "@diffgazer/ui/theme*.css"` tokens (F180); fix/remove missing favicon/og-image (F182); route cross-property URLs through a local `siteLinks` constant — a small per-app constant, **not** a shared `libs/core` registry (F184); update description to match (F185). F355 (changeset ignore) only applies to delete — N/A; keep the hub ignore entry. Add `@diffgazer/hub#build` to `turbo.json`.
- **Deploy-prep (absorbed here, no finding ID):** emit a static `sitemap.xml` + keep canonical/OG so `apps/hub/public/robots.txt` resolves (DEPLOYMENT-ROUTING §3.4). Keep it small.
- Do **not** extract `AppShell`/`SiteHeader`/`SiteFooter` or a shared SEO module (OUT of scope).
- Verify (scoped): `pnpm --filter @diffgazer/hub type-check`, `pnpm --filter @diffgazer/hub build`, `pnpm install` clean, `node scripts/monorepo/check-invariants.mjs`.
- Tests required: a render smoke test (hub mounts, shows portfolio links, uses theme tokens).

### Stage 2d — repo-wide

**B17 — monorepo scripts, smoke/validate gates, build/tooling** · 14 · `F189 F310 F356 F397 F366 F368 F370 F371 F372 F374 F375 F367 F380 F391`
- Smoke closure/import coverage (F189,F310), root `prepare` turbo task de-duping the 9-script prelude (F356), root lint config + per-package `check` (F397), smoke helper extraction + error types (F366,F368,F371,F372,F374,F375,F367,F370), rename `dev-server.ts`→`http-server.ts` per **STRUCTURE §Naming** (F380), benchmark suite (F391).
- Verify (scoped): `pnpm run validate:artifacts:check`, `node scripts/monorepo/check-invariants.mjs`, `pnpm run smoke` (strict skips) for the touched scripts.
- Tests required: F189 (closure walk catches a seeded missing dep), F310 (copy-mode imports the rewritten hook).

**B18 — governance, docs, env, .github, changesets** · 18 · `F333 F363 F360 F361 F364 F406 F403 F346 F348 F350 F351 F352 F353 F408 F410 F362 F365 F347`
- AGENTS.md package boundaries (F333), `.env.example` completeness (F363,F360,F361,F364,F362,F365), deployment/README docs (F406,F403), `.github` templates + dependabot (F346,F348,F350,F351,F352,F353,F347), governance docs (F408,F410).
- Verify (scoped): `git diff --check`; `node scripts/monorepo/check-invariants.mjs`; markdown link sanity for touched docs.
- Tests required: none (docs/config); validator confirms claims match repo reality (e.g. F403 web is private).

**B19 — cross-cutting DRY / shared extractions** · 5 · `F302 F376 F383 F194 F315` · **(runs LAST — touches multiple packages)**
- `escapeForRegex` → shared module, remove dead ui export (F302; touches cli/add + libs/ui + libs/core); `parsePortEnv` → `@diffgazer/core` with configurable variable name (F376,F383; touches cli/server + cli/diffgazer + core); `createQueryClientBase` → core (F194; touches apps/web + cli/diffgazer + core); shared test-setup util (F315; touches apps/web + apps/landing).
- Verify (scoped): type-check every touched package — `pnpm --filter @diffgazer/core --filter @diffgazer/ui --filter @diffgazer/add --filter @diffgazer/server --filter diffgazer --filter @diffgazer/web --filter @diffgazer/landing type-check`; focused tests for moved utilities.
- Tests required: F376 (`parsePortEnv` behavior preserved across both call sites), F194 (query-client base overrides apply).

---

## Final Gate (run once, after all batches PASS)

Split into **code gates** (the campaign runs these — they must be green before handoff) and **manual deploy/publish steps** (the user runs these — documented in `DEPLOY-RUNBOOK.md`, NOT workflow tasks). The code gates below are per AGENTS.md "Before declaring SOTA/ready" + the code-side half of the `HANDOFF-READINESS.md` pre-handoff checklist. Run on the clean campaign branch:

### Code gates (workflow / campaign)

1. `pnpm install --frozen-lockfile`
2. `pnpm run prepare:artifacts`, then run it **again** and confirm the second run produces **no additional diff** (artifacts are in sync / idempotent) and `validate:artifacts:check` passes. (With the no-commit policy the tree is intentionally dirty; the CI "registry up to date / git status clean" guard runs **after the user commits** — see `DEPLOY-RUNBOOK.md`.)
3. `DIFFGAZER_SKIP_ARTIFACT_PREPARE=1 pnpm exec turbo run type-check`
4. `DIFFGAZER_SKIP_ARTIFACT_PREPARE=1 pnpm exec turbo run test`
5. `DIFFGAZER_SMOKE_STRICT_SKIPS=1 pnpm run smoke` (and, if network allowed, `DIFFGAZER_SMOKE_ALLOW_NETWORK=1` too)
6. `pnpm run verify:monorepo`
7. `pnpm run validate:artifacts:check`
8. `git diff --check`
9. **HANDOFF-3:** author changesets for the packages being released (`pnpm run changeset`) — a repo-file task the campaign can do; otherwise the changeset publish flow releases nothing.

A final unbiased reviewer subagent confirms: all 249 CHECKLIST items checked-or-deferred, every code-gate command green (with output), no `.js` specifiers in source, and no scope creep across the campaign.

### Manual deploy/publish steps (user-run — see `DEPLOY-RUNBOOK.md`)

NOT workflow tasks. After the code gates are green, the user executes: resolve the `deploy.yml` build-model contradiction (GHCR-image vs Coolify-from-source), add the apex `b4r7.dev` health check, configure Coolify resources + wildcard DNS, bring `r.b4r7.dev` live (the 3 governance `200` checks), `npm publish` the packages, run the npm/pnpm/yarn/bun × Vite/Next package-manager matrix against the real published packages, trigger the deploy, and post-deploy health-check all four hosts. `DEPLOY-RUNBOOK.md` is the step-by-step.

## Definition of Done

- [ ] All 249 `CHECKLIST.md` items checked, or explicitly deferred with a written reason.
- [ ] Every batch committed on the campaign branch with a passing validator report.
- [ ] DECISION-1 and DECISION-2 recorded (which option, why) in `CHECKLIST.md`.
- [ ] Final Gate steps 1–9 all green, output captured.
- [ ] No production dependencies added beyond what a finding required (AGENTS.md dependency policy).
- [ ] Report: what changed, what was verified, any deferrals/risks (AGENTS.md Final Response Contract).

> Do NOT claim SOTA/ready if any Final-Gate command failed, was skipped unexpectedly, or was not run.
