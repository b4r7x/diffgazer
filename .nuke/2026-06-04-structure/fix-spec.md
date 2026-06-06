# Fix Spec — diffgazer — 2026-06-05

**Source ledger:** `/Users/voitz/Projects/diffgazer-workspace/.nuke/2026-06-04-structure/findings.md`
**Confirmed findings:** 258 total — by severity (recounted from the findings.md header): **high 22 · medium 111 · low 112 · info 13**.
**Scorecard:** see `/Users/voitz/Projects/diffgazer-workspace/.nuke/2026-06-04-structure/report.md`.

This is ONE self-contained handoff document. An executor with no prior context can run it end-to-end: the executor context below distills every binding rule, the execution protocol defines the subagent-driven loop, the eight phases inline every task verbatim, and the coverage map proves every F-001..F-258 is assigned to at least one task.

---

## Executor context (self-contained)

**Project.** Diffgazer is an AI code-review product shipped as a pnpm@10.28.2 + Turborepo (2.9.x) TypeScript monorepo, ESM throughout (`"type":"module"`), linted/formatted by Biome 2.3.14 (NO ESLint anywhere). 10 main workspaces + 1 nested helper: a React 19 review SPA (`apps/web`), a docs site (`apps/docs`, TanStack Start + Fumadocs), a marketing page (`apps/landing`), a public CLI binary (`cli/diffgazer`: web mode embedding the built SPA behind a `cli/server` Hono backend + an Ink TUI mode), a shadcn-like registry CLI (`cli/add`, bin `dgadd`), the embedded Hono backend (`cli/server`, CLI-internal), shared business logic (`libs/core`), keyboard/focus primitives (`libs/keys`), shadcn-like UI primitives (`libs/ui`), the registry engine (`libs/registry`), and the nested `libs/keys/artifacts` publisher helper. Published packages: `diffgazer`, `@diffgazer/add`, `@diffgazer/keys`, `@diffgazer/ui`. `@diffgazer/ui`/`@diffgazer/keys` ship dual-mode (npm package + shadcn copy-source registry under `public/r`). `ts-morph@26` is already in the lockfile (use it for cross-package codemods). `knip`, `dependency-cruiser` are NOT installed (Phase 7 adds them as root devDependencies).

### Binding conventions (D1–D8 from decisions.md + AGENTS.md boundaries + sota-structure doctrine)

1. **D1 Naming.** kebab-case files+folders; PascalCase/camelCase only for the exported symbol, never the filename. Basename = the file's primary export / single concept. NO hard hyphen cap, but **path-echo is a finding** (basename repeating a path segment); 2+ hyphens = shorten-via-folder-context candidate, 3+ = split/rename smell. Target ≥85% of source basenames at ≤1 hyphen, achieved by folder-context moves, never abbreviations. **Dot-segments are banned** (`x.routes.ts`, `x.service.ts`, `x.command.ts`, `.fixture`, `.ssr`, `.keyboard`, `.contract` middle-segments are renamed/foldered). Ban grab-bag basenames (`utils`/`helpers`/`common`/`misc`/`shared`). Exempt: `use-` hook prefix, `<component>-<part>` compound idiom, tooling dot-suffixes (`.test`/`.spec`/`.e2e`/`.stories`/`.config`/`.d`). Proper-noun two-hyphen names like `models-dev-catalog.ts` are allowed. Renames happen NOW (pre-publish window). **D1 overrides** the context.md `.keyboard.test`/`.contract.test`/`.ssr.test` carve-outs — those segments are renamed/foldered in Phase 7.
2. **D2 Grouping.** Flat-sibling colocation default (`button.tsx` + `button.test.tsx`). A unit earns a folder at 3+ files. NO internal `index.ts` barrels in apps/cli (owner follows TkDodo). Inside a unit folder, files drop the unit name (`commands/review/command.ts` + `handler.ts`, never `review.command.ts`).
3. **D3 Taxonomy.** Bulletproof PRINCIPLES everywhere (vertical slices, unidirectional imports shared→features→app, rule of two); bulletproof DIR TAXONOMY only on UI surfaces (`apps/web`, `apps/docs`, `apps/landing`, `cli/diffgazer` TUI). `cli/server` stays a Hono feature-backend (`createApp()` factory + `app.route()`, colocated zod schemas, `middlewares/`, NO controllers). `cli/add` stays command-CLI `commands/`. Canonize per-surface models in AGENTS.md (Phase 8 T-810).
4. **D4 Monorepo grouping & branding.** KEEP `apps/ cli/ libs/` groups, the branded `@diffgazer/*` scope, the unscoped `diffgazer` binary, and agnostic leaf names (`core`/`ui`/`keys`/`add`). NO package moves between groups, NO scope rename.
5. **D5 Docs registry mirror.** REMOVE the 642-file `apps/docs/registry/` mirror (Phase 5); docs must consume `@diffgazer/ui` source directly via its granular subpath `exports`. Verified feasible 1:1.
6. **D6 Barrels.** Remove ALL internal pure re-export barrels (apps/web ~15, cli/*, libs/core internals ~14). KEEP each lib's single `src/index.ts` public entry, granular subpath exports, and `libs/ui` per-component `index.ts` (sanctioned distribution surface). FORBID self-package imports through own barrel/subpath; wire a lint ban (Phase 7).
7. **D7 Timing & process.** Full structural pass NOW, pre-first-publish. Staged: pure-move/rename commit(s) with ZERO logic edits → splits/logic stacked after. **ts-morph codemods** for cross-package moves (`sourceFile.move`/`directory.move` → `project.save()` once). **Lockstep rule:** any rename touching the public registry surface updates source, `public/r` JSON, generated bundles, docs, examples, AND app consumers ATOMICALLY in one commit; the tree must compile between commits. Full gates between phases.
8. **D8 Root clutter.** DELETE (recoverable from git history): `AUDIT_2026-05-24.md`, `OPUS_AUDIT_2026-05-24.md`, `FIX_SPEC_2026-05-24.md`, `specs/archive/`, dated `audits/` dirs (+ F-088 `agent-specs/`, F-097 `libs/ui/specs/`). KEEP `agent-skills/diffgazer-project-rules/SKILL.md`.

### AGENTS.md ownership boundaries (do not violate)

- `libs/core` owns private shared business logic (Zod schemas/types, result/error types, format/string utils, review state machines, provider filtering, API client factories, env/port parsing, form/API/derived-state React hooks). It MUST NOT import from `apps/*` or `cli/*`.
- `libs/keys` owns reusable keyboard-first behavior (scopes, key registration, list nav, focus zones, focus trap/restore, focusable/tabbable utils, scroll lock).
- `libs/ui` owns reusable shadcn-like UI primitives + headless hooks (no app code imports). `libs/registry` owns registry contracts, shadcn/public registry validation/building, copy-bundle behavior, shared CLI workflow helpers.
- `cli/add` owns the `dgadd` add/remove/list/diff commands. `cli/server` owns the CLI-internal embedded Hono backend (bundled into the binary via tsup `noExternal`). `cli/diffgazer` is a thin public binary (web + Ink TUI) consuming `libs/core`/`libs/keys`/`cli/server`.
- `apps/web` owns product-specific composition; `apps/docs` consumes `@diffgazer/ui` (never mirrors it); `apps/landing` uses only `libs/ui` (theme CSS), no domain/docs logic.
- **Extraction:** primitives not product widgets; keyboard/focus → `libs/keys`; UI building blocks → `libs/ui`; promote to shared on the **second** consumer (rule of two, real named concept, clearer call sites). Features never import sibling features; the app-shared `components/` tier never imports `features/*`.

### sota-structure naming / barrel / test rules (the binding doctrine)

- **Barrels — verdict table:** package public `src/index.ts` = ALLOWED (the one sanctioned barrel); granular subpath `exports` = PREFERRED over a fat `.` entry; per-component `libs/ui/registry/ui/**/index.ts` = ALLOWED (it IS a public entry); internal convenience barrel (`features/x/index.ts`, `hooks/index.ts`) = REMOVE (import concrete files); importing your own package through its barrel/subpath from inside = FORBIDDEN (direct relative imports).
- **Tests:** colocated `<name>.test.ts(x)` next to source; integration `<name>.integration.test.ts`; e2e per app under `tests/e2e/*.e2e.ts`; NEVER `__tests__/`, never a parallel unit-test tree, never a `.fixture`/`.ssr`/`.keyboard`/`.contract` dot-segment. Registry `testing/` subfolders QUARANTINE tests out of the copy/shadcn handoff bundle — KEEP them. Build must exclude `*.test`/`testing` modules from `dist`/registry output. Test user-visible behavior + a11y; prefer role/label/text queries; do not assert Tailwind class names; for keyboard/focus assert real focus movement.
- **File size:** target ≤200, warn >300, hard review >350 — counted per RESPONSIBILITY. Generated/data files exempt (`catalog-snapshot.ts`, `**/generated/**`, `public/r/**`). Do NOT split cohesive pipelines/state-machines. **Orchestrator split:** when a file genuinely splits, the original filename stays as the orchestrator re-exporting the unchanged public surface; parts become siblings.
- **Refactor-verification protocol gate order (every phase exit):** (1) full `turbo run type-check` (project references make boundary breakage a hard error) → (2) FULL `turbo run test` (NOT `--affected`) → (3) `prepare:artifacts` + `validate:artifacts:check` (+ `verify:monorepo`) when registry/public surface touched → (4) `DIFFGAZER_SMOKE_STRICT_SKIPS=1 pnpm run smoke` → (5) `git diff --check` (+ `git diff -M` confirming pure moves render as renames in Phase 1).

### Verification gates (VERBATIM — the SOTA-ready set)

```
DIFFGAZER_SKIP_ARTIFACT_PREPARE=1 pnpm exec turbo run type-check
DIFFGAZER_SKIP_ARTIFACT_PREPARE=1 pnpm exec turbo run test
pnpm run prepare:artifacts && pnpm run validate:artifacts:check   (whenever registry, CLI, docs, or public handoff files were touched)
DIFFGAZER_SMOKE_STRICT_SKIPS=1 pnpm run smoke
pnpm run verify:monorepo
git diff --check
```

The catalog smoke validates the bundled offline snapshot on every run; add `DIFFGAZER_SMOKE_ALLOW_NETWORK=1` (as CI does) to also validate the live models.dev fetch.

### Execution rules (binding)

- **NEVER** `git add` / `git commit` / `git stash` unless the owner explicitly asks. Do NOT revert or overwrite unrelated worktree changes; if a file is already dirty, work with the existing changes.
- **No `.bak` files.** Use ts-morph / Edit / git-mv directly.
- **Fix EVERY task**, including low/info severity. There is no "skip the trivial ones."
- **Behavior-preserving** unless a task explicitly says otherwise. Phase 1 is import-rewrite-only (zero logic edits).
- Use the **strongest model at maximum effort**. Cost is not a concern — prefer more thinking/verification over a cheaper pass.
- Use `rg` / `rg --files` for search; prefer surgical edits over rewriting whole files.
- **Exclusions (never edit / never count):** `node_modules`, `dist`, `.turbo`, `coverage`, all generated dirs (`libs/ui/docs/generated`, `libs/keys/docs/generated`, `cli/add/src/generated`, `apps/docs/src/generated`), `apps/docs/registry` (until Phase 5 deletes it), `libs/core/src/catalog/catalog-snapshot.ts`, `pnpm-lock.yaml` (regenerate only through `pnpm install`).

---

## Execution protocol

This spec is executed by an orchestrator dispatching subagents, one phase at a time, gated. Do NOT start a phase until the previous phase's exit gates are all green.

### Per-phase loop

For each phase, in numeric order (1 → 8):

1. **Plan the batches.** Each phase below is divided into batches whose `files:` lists are disjoint (or, where noted, a single serial batch because the files are shared). Batches with disjoint file sets run in PARALLEL; tasks WITHIN a serial batch run in the listed order. **Some batches are NOT mutually disjoint and carry an explicit ordering/serialization note** (e.g. the Phase-1 batch-serialization note for 1.O → 1.F/1.K → 1.G, the Phase-5 "5.B runs after 5.A" note, and the Phase-7 "7.G runs after 7.A and 7.F" note); when a batch header or a phase intro says a batch "runs AFTER" another or is "NOT parallel-safe against" another, the orchestrator MUST honor that order and only parallel-dispatch batches that are genuinely file-disjoint per their stated scope. Read each phase intro and batch header for these notes BEFORE dispatching.
2. **Dispatch implementation subagents — one per batch.** Give each subagent its batch's tasks verbatim (Change + Accept), the executor context above, and the binding D1–D8 / AGENTS.md rules. Each subagent edits ONLY its batch's files. Cross-package moves use ts-morph (D7). Registry/public-surface renames are lockstep (source + `public/r` JSON + generated bundles + docs + examples + consumers) in one atomic change.
3. **Dispatch FRESH validator subagents** (not the implementers) after the batch wave completes. Each validator: (a) checks every task's Accept criteria with file:line evidence; (b) re-audits the CHANGED files against the binding structure/quality rules (D1–D8, sota-structure, AGENTS.md boundaries) to catch regressions or new slop introduced by the edit; (c) runs the phase's relevant narrow gates first, then the full gate set listed in that phase's "Phase exit."
4. **On any failure → dispatch fix subagents** scoped to the failing tasks, then RE-VALIDATE with fresh validators. Cap the implement→validate→fix cycle at **5 iterations** per phase; if still red after 5, stop and report the blocking failure rather than forcing a green bar.
5. **Only when every task's Accept is met AND all phase-exit gates are green** do you proceed to the next phase.

### Gate discipline

- Run the narrowest relevant gate first (`pnpm --filter <pkg> type-check` / focused tests), broaden to the full set when blast radius crosses packages.
- Phase 1 additionally requires `git diff -M --stat` to confirm the commit renders as renames (rename detection survived = pure moves with import-only edits).
- Whenever registry / CLI / docs / public-handoff files were touched, `pnpm run prepare:artifacts && pnpm run validate:artifacts:check` is MANDATORY (the gitignored `apps/docs/registry`/`apps/docs/styles` mirrors are regenerated, not hand-edited).

### After the LAST phase (final acceptance)

1. **All gates, full set,** from the repo root: `DIFFGAZER_SKIP_ARTIFACT_PREPARE=1 pnpm exec turbo run type-check`; `DIFFGAZER_SKIP_ARTIFACT_PREPARE=1 pnpm exec turbo run test`; `pnpm run prepare:artifacts && pnpm run validate:artifacts:check`; `DIFFGAZER_SMOKE_STRICT_SKIPS=1 pnpm run smoke`; `pnpm run verify:monorepo`; `git diff --check`.
2. **Full-sweep wave.** Dispatch a final fleet of fresh review subagents to re-audit ALL changed files across the whole repo for structure (D1–D8, sota-structure naming/barrel/test/size rules) and quality (clean-code, anti-slop, code-quality, react-senior-guide where React was touched) regressions. Fix every issue found, including lows/infos, then re-run the gate set.
3. **Completeness check.** Confirm every task T-101..T-818 is done and every finding F-001..F-258 is resolved (cross-check the Coverage map below). Any unresolved F-id or undone task blocks acceptance.
4. **E2E / artifact validation.** Run the docs Playwright e2e (`apps/docs/tests/e2e/*.e2e.ts`), the full smoke suite, registry validation (`validate:artifacts:check`), and — once Phase 7 wired them — `pnpm run depcruise` (dependency-cruiser layer-boundary + no-circular + no-orphans) and the `knip` report. All must be green (knip staged as non-blocking report per Phase 7).
5. Do NOT claim SOTA/ready if any required gate failed, was skipped unexpectedly, or was not run.

---

## Phases

The eight phases below are inlined verbatim from `spec/phase-1.md` .. `spec/phase-8.md`. Each phase ends with its own "Phase exit" gate block; honor it before advancing.

---


## Phase 1 — Pure moves & renames (zero logic edits)

This phase runs first because it is the cheapest, safest, and most enabling pass: every task here is a `git`-rename-preserving move/rename executed with ts-morph (`sourceFile.move` / `directory.move` → `project.save()`), rewriting import specifiers only — no logic edits. Doing it first means the later DRY/extraction (Phase 2), barrel-dissolution (Phase 3), dead-code (Phase 4), split (Phase 5+) and test-reorg (Phase 7) phases all stack onto a tree whose files already sit at their final paths with their final names, so those phases never re-litigate a path. Per D7 the pure-move commit must stay green on all gates and render as renames under `git diff -M`; cross-package + public-registry-surface renames (libs/ui, libs/keys public/r, package.json `exports`) are kept atomic in lockstep so the public contract is unchanged.

### Scope & conventions for every task in this phase

- **ts-morph codemod, zero logic edits.** Use `Project` with the workspace tsconfig(s), `directory.move`/`sourceFile.move`, then `project.save()` once. Inspect, then save. Do not hand-edit import strings. Do not touch any line that is not an import specifier, an `export … from` re-export specifier, a `package.json` `exports`/path entry, a registry JSON `path`/`target`, or a build-script literal path. If a finding's "Fix" text proposes a *symbol* rename or a *file split into multiple concept files*, that is OUT OF SCOPE here — Phase 1 does the single-file folder-context rename / move only; the split is deferred to the split phase. Each task below states the exact Phase-1 shape.
- **Colocated tests move in lockstep with their source (required, not deferred).** A 1:1 `<name>.test.ts(x)` beside a renamed/moved source file is renamed/moved together so the tree keeps compiling and `turbo run test` stays green. This is NOT the Phase-7 test work: Phase 7 owns test-only reorganizations not driven by a source move (phantom-basename buckets, `testing/` dir placement, `.ssr`/`.contract` dot-segment test renames). Here, the test follows its source automatically via ts-morph.
- **Keep exported symbols unchanged** (PascalCase components, `use*` hooks, `*Provider`, `*Screen`, etc.). Only filenames/paths change unless a task explicitly says otherwise.
- **Public-surface lockstep (D7).** When a moved/renamed file is referenced by `package.json` `exports`, a committed `libs/{ui,keys}/public/r/*.json`, a `registry.json` item, a generated tsup/declaration bundle path, or docs/examples, update ALL of them in the same task atomically. The gitignored `apps/docs/registry` mirror is regenerated by `prepare:artifacts`, not hand-edited.
- **Barrels are NOT dissolved here.** Where a finding's source file is re-exported through an `index.ts` that D6 will later delete, this phase only repoints that one re-export line at the new path (keeping the barrel intact). Barrel removal is Phase 3.

### Phase-1 batch serialization (overrides the default parallel dispatch)

The per-phase loop dispatches disjoint batches in parallel, but several Phase-1 batches share files and are therefore **NOT** all mutually parallel-safe. The orchestrator MUST honor this dependency order — earlier batches land their moves/renames at FINAL paths, later batches target those final paths:

**Serialization order:** dispatch **Batch 1.O FIRST**; when it completes, dispatch **Batch 1.F** (depends on 1.O) and **Batch 1.K** (depends on 1.O) — these two are disjoint from each other and may run in parallel; when **1.F** completes, dispatch **Batch 1.G** (depends on 1.F). Every other Phase-1 batch (1.A–1.E, 1.H–1.N) is mutually file-disjoint and runs in parallel with this chain.

- **Batch 1.O runs FIRST.** It is the single owner of every MOVE/RENAME of: `cli/diffgazer/src/app/index.tsx` (→`app/root.tsx`, T-174), `cli/diffgazer/src/app/navigation-context.tsx` (→`app/providers/navigation-provider.tsx`, T-175), `cli/diffgazer/src/theme/theme-context.tsx` (→`app/providers/theme.tsx`, T-176), the `app/providers/*-provider.tsx` files in apps/web + cli/diffgazer (T-173), `cli/diffgazer/src/components/layout/global-layout.tsx` (→`global.tsx`, T-177), and `libs/keys/src/providers/keyboard-provider.tsx` (→`keyboard.tsx`, T-173) + its `libs/keys/src/index.ts` re-export line. Each of these files is moved/renamed here exactly once.
- **Batch 1.F runs AFTER 1.O** (shares files with 1.O). Its tasks T-127, T-128, and T-131 only *rewrite importer lines* that live in `app/index.tsx` — which 1.O has already renamed to `app/root.tsx`; T-127/T-128/T-131 therefore edit `cli/diffgazer/src/app/root.tsx`, not `app/index.tsx`. T-129 rewrites the `back-navigation` import line inside the file 1.O moved to `app/providers/navigation-provider.tsx`. 1.F does NOT move or rename any of the 1.O-owned files; it only edits import specifiers in them at their post-1.O paths. The `theme/theme-context.tsx` entry in 1.F's files header is informational collision context only (its move is owned solely by T-176/1.O; 1.F's own T-126 explicitly defers to T-176 and is NOT executed).
- **Batch 1.G runs AFTER 1.F** (shares the `app/screens/settings/*.tsx` + providers screen files with 1.F's T-125). 1.G is itself file-DISJOINT from 1.O (it touches no `app/providers/*`, `app/root.tsx`, `navigation-context.tsx`, or `theme/theme-context.tsx` file), so its only ordering constraint is on 1.F — and since 1.F already runs after 1.O, 1.G lands last in this chain. T-139 repoints those settings/providers screens' import lines to `components/shared/`, so 1.F's T-125 must rename the screens to their final de-suffixed paths first; 1.G then edits only import specifiers inside them.
- **Batch 1.K runs AFTER 1.O** for the two shared files `libs/keys/src/index.ts` and `libs/keys/src/providers/keyboard-provider.tsx`. 1.O's T-173 renames `keyboard-provider.tsx`→`keyboard.tsx` and rewrites its `src/index.ts` re-export FIRST; 1.K's T-156 then moves `context/keyboard-context.ts`→`providers/keyboard-context.ts` and rewrites (a) the `src/index.ts:75` line for the keyboard-context re-export and (b) the cross-import inside the now-renamed `providers/keyboard.tsx`. Because the two tasks touch DIFFERENT lines of `src/index.ts` (T-173 the provider re-export, T-156 the context re-export) and T-156 targets `keyboard.tsx` only after T-173 renamed it, running 1.K strictly after 1.O is conflict-free. 1.K is disjoint from 1.F, so 1.F and 1.K may run in parallel once 1.O is done.
- All OTHER Phase-1 batches (1.A–1.E, 1.H–1.N) remain mutually file-disjoint and parallel-safe with each other and with this chain.

---

### Batch 1.A — apps/landing
files: apps/landing/src/App.tsx, apps/landing/src/App.test.tsx, apps/landing/src/main.tsx, apps/landing/src/copy-button.tsx, apps/landing/src/sections/install.tsx, apps/landing/src/sections/copy-button.tsx (new)

- [ ] T-101 (fixes F-004) — files: apps/landing/src/App.tsx, apps/landing/src/App.test.tsx, apps/landing/src/main.tsx
      Change: Rename `apps/landing/src/App.tsx` → `apps/landing/src/app.tsx` and `apps/landing/src/App.test.tsx` → `apps/landing/src/app.test.tsx` (kebab-case; the only PascalCase source filenames in the repo). Keep the exported symbol `App` PascalCase. Rewrite the two import specifiers `from "./App"` → `from "./app"` in `main.tsx:3` and in the renamed `app.test.tsx`.
      Accept: No `apps/landing/src/App.tsx`/`App.test.tsx` exists; `app.tsx`/`app.test.tsx` exist; `rg -n 'from "\./App"' apps/landing` returns nothing; `pnpm --filter @diffgazer/landing type-check` and the landing tests pass.

- [ ] T-102 (fixes F-060) — files: apps/landing/src/copy-button.tsx, apps/landing/src/sections/install.tsx
      Change: Move `apps/landing/src/copy-button.tsx` → `apps/landing/src/sections/copy-button.tsx` (colocate with its single consumer). Rewrite the import in `sections/install.tsx` to `./copy-button`.
      Accept: `apps/landing/src/copy-button.tsx` gone; `apps/landing/src/sections/copy-button.tsx` exists; `sections/install.tsx` imports `./copy-button`; landing type-check + tests pass.

---

### Batch 1.B — apps/web features/review + components/ui (severity/progress)
files: apps/web/src/features/review/hooks/* (use-review-* + tests), apps/web/src/features/review/components/review-*.tsx (+ tests), apps/web/src/components/ui/progress/*, apps/web/src/components/ui/severity/*, and the in-feature/external importers of those files only

- [ ] T-103 (fixes F-021) — files: apps/web/src/features/review/hooks/use-review-results-keyboard.ts, use-review-progress-keyboard.ts, use-review-details-tab-keyboard.ts, use-review-severity-filter-keyboard.ts, use-review-error-handler.ts, use-review-lifecycle.ts (+ their colocated tests)
      Change: Folder-context rename inside `apps/web/src/features/review/hooks/`, dropping the redundant `review` segment (path already says review): `use-review-results-keyboard.ts`→`use-results-keyboard.ts`, `use-review-progress-keyboard.ts`→`use-progress-keyboard.ts`, `use-review-details-tab-keyboard.ts`→`use-details-tab-keyboard.ts`, `use-review-severity-filter-keyboard.ts`→`use-severity-filter-keyboard.ts`, `use-review-error-handler.ts`→`use-error-handler.ts`, `use-review-lifecycle.ts`→`use-lifecycle.ts`. Keep `use*` hook symbols. Move the two colocated test files in lockstep. Rewrite all in-feature importers.
      Accept: None of the six `use-review-*` basenames remain under `features/review/hooks/`; new basenames exist; `rg -n 'use-review-(results|progress|details-tab|severity-filter|error-handler|lifecycle)-keyboard|use-review-(error-handler|lifecycle)' apps/web/src/features/review` returns nothing; web type-check + review tests pass.

- [ ] T-104 (fixes F-122) — files: apps/web/src/features/review/components/review-container.tsx, review-metrics-footer.tsx, review-progress-view.tsx, review-results-view.tsx, review-summary-view.tsx (+ colocated tests, incl. review-results-view.keyboard.test.tsx)
      Change: Folder-context rename inside `apps/web/src/features/review/components/`, dropping `review`: `review-container.tsx`→`container.tsx`, `review-metrics-footer.tsx`→`metrics-footer.tsx`, `review-progress-view.tsx`→`progress-view.tsx`, `review-results-view.tsx`→`results-view.tsx`, `review-summary-view.tsx`→`summary-view.tsx`. Keep PascalCase symbols. Move the colocated test(s) (including `review-results-view.keyboard.test.tsx` → `results-view.keyboard.test.tsx`, preserving the `.keyboard` segment as-is — its dot-segment cleanup is a separate Phase-7 concern, not done here). Rewrite in-feature importers.
      Accept: No `review-*.tsx` basenames under `features/review/components/`; `container.tsx`/`metrics-footer.tsx`/`progress-view.tsx`/`results-view.tsx`/`summary-view.tsx` exist; web type-check + review tests pass.

- [ ] T-105 (fixes F-026) — files: apps/web/src/components/ui/progress/progress-list.tsx, progress-step.tsx, apps/web/src/components/ui/severity/severity-bar.tsx, severity-breakdown.tsx (+ colocated tests, e.g. progress-step.test.tsx) and external importers (apps/web/src/features/review/components/progress-view.tsx, apps/web/src/features/settings analysis-summary, apps/web/src/features/history/components/history-insights-pane.tsx)
      Change: Keep the `progress/` and `severity/` unit folders; drop the folder-name prefix from the basenames: `progress/progress-list.tsx`→`progress/list.tsx`, `progress/progress-step.tsx`→`progress/step.tsx`, `severity/severity-bar.tsx`→`severity/bar.tsx`, `severity/severity-breakdown.tsx`→`severity/breakdown.tsx`. Keep PascalCase symbols. Move colocated tests in lockstep. Rewrite in-folder relative imports and the external importers.
      Accept: No `progress-*`/`severity-*` basenames under `components/ui/{progress,severity}/`; `list.tsx`/`step.tsx`/`bar.tsx`/`breakdown.tsx` exist; web type-check + tests pass. (Note: this is the apps/web side only; the cli/diffgazer mirror primitives are T-148 in Batch 1.G.)

---

### Batch 1.C — apps/web features/providers (hooks + compound-dialog components)
files: apps/web/src/features/providers/hooks/* (+ tests), apps/web/src/features/providers/components/model-select-dialog/*, api-key-dialog/*, provider-details.tsx, provider-list.tsx (+ tests), apps/web/src/features/providers/hooks/index.ts (re-export repoint only)

- [ ] T-106 (fixes F-022) — files: apps/web/src/features/providers/hooks/use-providers-keyboard.ts (+ use-providers-keyboard.test.tsx), use-providers-action-buttons.ts, use-providers-dialog-keyboard.ts, use-providers-list-navigation.ts, use-providers-page-state.ts
      Change: Folder-context rename inside `features/providers/hooks/`, dropping the `providers` echo: `use-providers-keyboard.ts`→`use-keyboard.ts`, `use-providers-action-buttons.ts`→`use-action-buttons.ts`, `use-providers-dialog-keyboard.ts`→`use-dialog-keyboard.ts`, `use-providers-list-navigation.ts`→`use-list-navigation.ts`, `use-providers-page-state.ts`→`use-page-state.ts`. Move `use-providers-keyboard.test.tsx`→`use-keyboard.test.tsx`. Leave `use-providers.ts` and `use-provider-management.ts` unchanged (judgment-call keeps per F-022). Rewrite importers and repoint the `features/providers/hooks/index.ts` re-export lines (barrel kept; Phase 3 deletes it).
      Accept: None of the five `use-providers-*` basenames remain; new `use-*` basenames exist; web type-check + provider tests pass.

- [ ] T-107 (fixes F-114, F-025, F-028) — files: apps/web/src/features/providers/hooks/use-model-dialog-keyboard.ts (+ test), use-model-dialog-focus-trap.ts, use-model-search-focus.ts, use-model-filter.ts (+ test), use-model-filters.ts; apps/web/src/features/providers/components/model-select-dialog/ (destination); apps/web/src/features/providers/hooks/index.ts
      Change: Move the five model-dialog-only hooks from `features/providers/hooks/` INTO their sole-consumer compound folder `features/providers/components/model-select-dialog/`, dropping the `model` prefix the folder supplies: `use-model-dialog-keyboard.ts`→`use-dialog-keyboard.ts`, `use-model-dialog-focus-trap.ts`→`use-dialog-focus-trap.ts`, `use-model-search-focus.ts`→`use-search-focus.ts`, `use-model-filter.ts`→`use-filter.ts` (the data hook), `use-model-filters.ts`→`use-filter-row-keyboard.ts` (the keyboard hook — this rename also resolves the F-025/F-028 confusable singular/plural pair; keep its `useModelFilters` symbol unchanged in Phase 1). Move the colocated tests (`use-model-dialog-keyboard.test.ts`→`use-dialog-keyboard.test.ts`, `use-model-filter.test.ts`→`use-filter.test.ts`) into the compound folder. Rewrite the two import sites in `model-select-dialog.tsx`, the intra-cluster imports, and remove the corresponding re-export lines from `features/providers/hooks/index.ts`.
      Accept: No `use-model-*` files remain under `features/providers/hooks/`; `model-select-dialog/use-dialog-keyboard.ts`, `use-dialog-focus-trap.ts`, `use-search-focus.ts`, `use-filter.ts`, `use-filter-row-keyboard.ts` exist; `model-select-dialog.tsx` imports them via `./`; no `use-model-filters.ts` basename remains anywhere; web type-check + provider tests pass.

- [ ] T-108 (fixes F-161) — files: apps/web/src/features/providers/hooks/use-api-key-dialog-keyboard.ts (+ test), use-api-key-form.ts (+ test); apps/web/src/features/providers/components/api-key-dialog/ (destination); apps/web/src/features/providers/hooks/index.ts
      Change: Move the two api-key-dialog-only hooks from `features/providers/hooks/` INTO `features/providers/components/api-key-dialog/`, dropping the `api-key-dialog`/`api-key` prefix: `use-api-key-dialog-keyboard.ts`→`use-keyboard.ts`, `use-api-key-form.ts`→`use-form.ts`. Move colocated tests in lockstep. Rewrite the imports in `api-key-dialog.tsx` from `../../hooks/…` to `./use-keyboard` / `./use-form`, and remove the two re-export lines from `features/providers/hooks/index.ts`.
      Accept: `api-key-dialog/use-keyboard.ts` and `use-form.ts` exist; no `use-api-key-*` files remain under `features/providers/hooks/`; web type-check + the api-key-dialog integration test pass.

- [ ] T-109 (fixes F-023) — files: apps/web/src/features/providers/components/model-select-dialog/{model-select-dialog,model-filter-tabs,model-list,model-list-item,model-search-input}.tsx, api-key-dialog/{api-key-dialog,api-key-footer}.tsx (+ colocated tests)
      Change: Drop the unit name inside each compound folder (D2). In `model-select-dialog/`: `model-select-dialog.tsx`→`dialog.tsx`, `model-filter-tabs.tsx`→`filter-tabs.tsx`, `model-list.tsx`→`list.tsx`, `model-list-item.tsx`→`list-item.tsx`, `model-search-input.tsx`→`search-input.tsx`. In `api-key-dialog/`: `api-key-dialog.tsx`→`dialog.tsx`, `api-key-footer.tsx`→`footer.tsx`. Keep PascalCase symbols. Rewrite intra-folder relative imports, the colocated integration tests, and the external importer in `providers/components/page.tsx`.
      Accept: No file under `model-select-dialog/` or `api-key-dialog/` repeats its folder name; `dialog.tsx` exists in both folders; web type-check + provider/dialog tests pass. (Run AFTER T-107/T-108 so the hooks already live in these folders and their `./` imports update consistently.)

- [ ] T-110 (fixes F-122 providers half) — files: apps/web/src/features/providers/components/provider-details.tsx (+ provider-details.test.tsx), provider-list.tsx
      Change: Folder-context rename in `features/providers/components/`, dropping `provider(s)`: `provider-details.tsx`→`details.tsx`, `provider-list.tsx`→`list.tsx`. Move `provider-details.test.tsx`→`details.test.tsx`. Keep PascalCase symbols. Rewrite importers (siblings `capability-card.tsx`/`page.tsx` are kept-as-is per F-122).
      Accept: No `provider-details.tsx`/`provider-list.tsx` under `features/providers/components/`; `details.tsx`/`list.tsx` exist; web type-check + provider tests pass.

---

### Batch 1.D — apps/web features/home + history + onboarding + settings + testing
files: apps/web/src/features/home/*, apps/web/src/features/history/*, apps/web/src/features/onboarding/{components,hooks}/* (excl. tests-only reorg), apps/web/src/features/settings/components/{theme,analysis,diagnostics}/*, apps/web/src/features/settings/hooks/*, apps/web/src/testing/utils.ts. (App-root index.tsx / providers tier handled in Batch 1.O.)

- [ ] T-111 (fixes F-024) — files: apps/web/src/features/home/components/home-menu.tsx (+ home-menu.test.tsx), home-presentation.tsx (+ home-presentation.test.tsx)
      Change: Folder-context rename in `features/home/components/`: `home-menu.tsx`→`menu.tsx`, `home-presentation.tsx`→`presentation.tsx`. Move colocated tests in lockstep. Rewrite in-feature importers.
      Accept: No `home-menu`/`home-presentation` basenames; `menu.tsx`/`presentation.tsx` exist; web type-check + home tests pass.

- [ ] T-112 (fixes F-057) — files: apps/web/src/features/home/utils/shutdown.ts, apps/web/src/features/home/components/page.tsx
      Change: Move `features/home/utils/shutdown.ts` → `features/home/shutdown.ts` and delete the now-empty `features/home/utils/` folder. Rewrite the importer in `home/components/page.tsx` to `@/features/home/shutdown`.
      Accept: `features/home/shutdown.ts` exists; `features/home/utils/` gone; web type-check + tests pass.

- [ ] T-113 (fixes F-027) — files: apps/web/src/features/history/utils.tsx, apps/web/src/features/history/utils.test.ts, apps/web/src/features/history/hooks/use-history-page.ts
      Change: Rename the banned grab-bag basename `features/history/utils.tsx`→`features/history/run-summary.tsx` (keep both colocated functions `severityChipClass` + `getRunSummary` as-is — no split, no DRY merge in Phase 1). Move `utils.test.ts`→`run-summary.test.ts`. Rewrite the two importers (incl. `hooks/use-history-page.ts`).
      Accept: No `features/history/utils.tsx`; `run-summary.tsx` + `run-summary.test.ts` exist; web type-check + history tests pass.

- [ ] T-114 (fixes F-121) — files: apps/web/src/features/history/components/history-insights-pane.tsx, apps/web/src/features/history/hooks/use-history-keyboard.ts, use-history-page.ts (+ tests); apps/web/src/features/onboarding/components/onboarding-wizard.tsx, apps/web/src/features/onboarding/hooks/onboarding-reducer.ts (+ test), onboarding-settings-sync.ts (+ test), use-onboarding-keyboard.ts
      Change: Folder-context renames dropping the feature echo. history: `components/history-insights-pane.tsx`→`components/insights-pane.tsx`, `hooks/use-history-keyboard.ts`→`hooks/use-keyboard.ts`, `hooks/use-history-page.ts`→`hooks/use-page.ts`. onboarding: `components/onboarding-wizard.tsx`→`components/wizard.tsx`, `hooks/onboarding-reducer.ts`→`hooks/reducer.ts`, `hooks/onboarding-settings-sync.ts`→`hooks/settings-sync.ts`, `hooks/use-onboarding-keyboard.ts`→`hooks/use-keyboard.ts`. (`onboarding-shortcuts.ts` is renamed+moved by T-115; do not also rename it here.) Move colocated tests in lockstep. Rewrite all importers.
      Accept: No `history-`/`onboarding-`-prefixed basenames remain in those four folders (except files owned by other tasks); web type-check + history/onboarding tests pass. Run AFTER T-115 (shortcuts move) to avoid touching the same `onboarding-wizard.tsx` import twice — or fold both into one ts-morph pass.

- [ ] T-115 (fixes F-056) — files: apps/web/src/features/onboarding/components/onboarding-shortcuts.ts, apps/web/src/features/onboarding/hooks/use-onboarding-keyboard.ts, apps/web/src/features/onboarding/components/onboarding-wizard.tsx
      Change: Move the non-component data module out of `components/` to the feature lib tier and drop the `onboarding` echo: `features/onboarding/components/onboarding-shortcuts.ts` → `features/onboarding/shortcuts.ts`. Rewrite the two importers (`hooks/use-onboarding-keyboard.ts` and `components/onboarding-wizard.tsx`), eliminating the hooks→components upward edge. Coordinate with T-114 so the final wizard path is `components/wizard.tsx` and the shortcuts path is `features/onboarding/shortcuts.ts`.
      Accept: `features/onboarding/shortcuts.ts` exists; no `onboarding-shortcuts.ts` under `components/`; no hooks→components import remains in the feature; web type-check + onboarding tests pass.

- [ ] T-116 (fixes F-058, F-126) — files: apps/web/src/features/settings/components/theme/page.tsx, apps/web/src/features/settings/components/theme-selector-content.tsx, theme-preview-card.tsx (+ its .css), apps/web/src/features/settings/components/analysis/analysis-selector-content.tsx
      Change: (a) Move the theme-only helpers into the `theme/` sub-page folder and drop the `theme` echo: `components/theme-selector-content.tsx`→`components/theme/selector-content.tsx`, `components/theme-preview-card.tsx` (+ matching `.css`)→`components/theme/preview-card.tsx` (+ `.css`); rewrite `theme/page.tsx` imports to `./selector-content` / `./preview-card`. (b) Rename the analysis sub-page helper to drop its echo: `components/analysis/analysis-selector-content.tsx`→`components/analysis/selector-content.tsx`; rewrite `analysis/page.tsx` import.
      Accept: `theme/selector-content.tsx`, `theme/preview-card.tsx` (+`.css`), `analysis/selector-content.tsx` exist; no `theme-selector-content`/`theme-preview-card`/`analysis-selector-content` basenames remain; web type-check + settings tests pass.

- [ ] T-117 (fixes F-162) — files: apps/web/src/features/settings/hooks/use-diagnostics-keyboard.ts (+ test), apps/web/src/features/settings/components/diagnostics/page.tsx
      Change: Move `features/settings/hooks/use-diagnostics-keyboard.ts` (+ its test) into `features/settings/components/diagnostics/` next to its sole consumer `page.tsx`; delete the now-empty `features/settings/hooks/` folder. Rewrite the import in `diagnostics/page.tsx`.
      Accept: `features/settings/components/diagnostics/use-diagnostics-keyboard.ts` exists; `features/settings/hooks/` gone; web type-check + diagnostics tests pass.

- [ ] T-118 (fixes F-120) — files: apps/web/src/testing/utils.ts, apps/web/src/testing/index.ts, apps/web/src/features/onboarding/hooks/use-onboarding.test.tsx, apps/web/src/features/onboarding/components/steps/provider-step.test.tsx, model-step.test.tsx
      Change: Rename the banned grab-bag `apps/web/src/testing/utils.ts`→`apps/web/src/testing/escape-regexp.ts` (basename = its single `escapeRegExp` export). Repoint the re-export line in `testing/index.ts` (barrel kept; Phase 3 dissolves it) and/or the three onboarding test imports to the new path.
      Accept: `apps/web/src/testing/escape-regexp.ts` exists; no `testing/utils.ts`; web type-check + the three onboarding tests pass.

---

### Batch 1.E — apps/docs
files: apps/docs/src/components/docs-mdx/blocks/*, apps/docs/src/components/{parameter-table,props-table,source-viewer}.tsx (+ source-viewer.test.tsx), apps/docs/src/components/{not-found,docs-page,docs-not-found}.tsx, apps/docs/src/layouts/*, apps/docs/src/lib/{docs-library,docs-libraries-config,docs-tree}.ts, apps/docs/src/lib/hooks/use-pending-docs-route.ts, apps/docs/src/types/docs-data.ts, apps/docs/src/features/{home,search}/*

- [ ] T-119 (fixes F-029, F-210) — files: apps/docs/src/components/docs-mdx/blocks/{parameter-table-block,props-table-block,source-viewer-block,consumption-block}.tsx, apps/docs/src/components/docs-mdx/blocks/index.ts, apps/docs/src/components/{parameter-table,props-table,source-viewer}.tsx (+ source-viewer.test.tsx)
      Change: (a) Move the docs-mdx-only presentational pieces into the subsystem folder: `src/components/parameter-table.tsx`→`src/components/docs-mdx/parameter-table.tsx`, `src/components/props-table.tsx`→`src/components/docs-mdx/props-table.tsx`, `src/components/source-viewer.tsx`(+`source-viewer.test.tsx`)→`src/components/docs-mdx/source-viewer.tsx`(+test). (b) In `docs-mdx/blocks/`, drop the folder-echoing `-block` suffix on all four files: `parameter-table-block.tsx`→`parameter-table.tsx`, `props-table-block.tsx`→`props-table.tsx`, `source-viewer-block.tsx`→`source-viewer.tsx`, `consumption-block.tsx`→`consumption.tsx`. Keep the exported MDX-tag symbols (`ConsumptionBlock`, etc.) unchanged. Update `blocks/index.ts` import paths and drop the now-redundant `as ParameterTable`/`as PropsTable`/`as SourceViewer` re-alias (they map back to the clean name the file now has). Update the relative imports between the wrappers and the relocated presentational pieces.
      Accept: No `*-block.tsx` basenames under `docs-mdx/blocks/`; `docs-mdx/{parameter-table,props-table,source-viewer}.tsx` exist; no `parameter-table.tsx`/`props-table.tsx`/`source-viewer.tsx` remain at `src/components/` root; docs type-check + `docs-library.test.ts` (asserts `<ConsumptionBlock/>` etc.) pass.

- [ ] T-120 (fixes F-030) — files: apps/docs/src/features/home/home-data.ts, apps/docs/src/features/search/search-context.tsx (+ colocated tests), and optionally features/theme/components/theme-playground.tsx, features/search/components/search-dialog.tsx, features/home/components/home-view.tsx
      Change: Folder-context renames dropping the feature/grandparent echo: `features/home/home-data.ts`→`features/home/data.ts`; `features/search/search-context.tsx`→`features/search/context.tsx`; `features/theme/components/theme-playground.tsx`→`.../playground.tsx`; `features/search/components/search-dialog.tsx`→`.../dialog.tsx`; `features/home/components/home-view.tsx`→`.../view.tsx`. Move any colocated tests. Rewrite all importers.
      Accept: None of the listed echo basenames remain; `data.ts`/`context.tsx`/`playground.tsx`/`dialog.tsx`/`view.tsx` exist at their feature paths; docs type-check + tests pass.

- [ ] T-121 (fixes F-129) — files: apps/docs/src/components/not-found.tsx, and its importer (router/routes)
      Change: Rename `apps/docs/src/components/not-found.tsx`→`global-not-found.tsx` so the basename names its `GlobalNotFound` export. Leave `not-found-state.tsx` and `docs-not-found.tsx` unchanged (already match their exports; `docs-not-found.tsx` is further handled by T-122's cluster note — keep as-is here). Rewrite the importer.
      Accept: `components/global-not-found.tsx` exists; no `components/not-found.tsx`; docs type-check + tests pass.

- [ ] T-122 (fixes F-158) — files: apps/docs/src/lib/docs-library.ts, docs-libraries-config.ts, docs-tree.ts, apps/docs/src/components/docs-page.tsx, apps/docs/src/types/docs-data.ts (+ docs-library.test.ts moves with its source), and all importers (23+ of docs-library)
      Change: Folder-context renames dropping the `docs-` workspace echo: `lib/docs-library.ts`→`lib/library.ts`, `lib/docs-libraries-config.ts`→`lib/libraries-config.ts`, `lib/docs-tree.ts`→`lib/page-tree.ts`, `components/docs-page.tsx`→`components/page-layout.tsx`, `types/docs-data.ts`→`types/data.ts`. Move `docs-library.test.ts`→`library.test.ts`. Keep exported symbols. Leave `components/docs-not-found.tsx` for the F-129 cluster (named to match its `DocsNotFoundBlock` export — keep) and leave `docs-mdx/` as-is. Rewrite every importer.
      Accept: No `docs-library`/`docs-libraries-config`/`docs-tree`/`docs-page`/`docs-data` basenames remain; `library.ts`/`libraries-config.ts`/`page-tree.ts`/`page-layout.tsx`/`data.ts` exist; docs type-check + tests pass.

- [ ] T-123 (fixes F-186) — files: apps/docs/src/layouts/{header,footer,sidebar,docs-content-layout}.tsx (+ sidebar.test.ts), apps/docs/src/components/layout/ (new), importers (routes/$lib.tsx, routes/$lib/$.tsx, components/docs-not-found.tsx)
      Change: Move the app-shell layout from the lone-drifter `src/layouts/` tier into the canonical `src/components/layout/` (matching web + diffgazer): `layouts/header.tsx`→`components/layout/header.tsx`, `footer.tsx`→`components/layout/footer.tsx`, `sidebar.tsx`(+`sidebar.test.ts`)→`components/layout/sidebar.tsx`(+test), and `layouts/docs-content-layout.tsx`→`components/layout/content-layout.tsx` (drop the `docs-` echo while moving, per F-158/D1). Delete the empty `src/layouts/`. Rewrite the four importers from `@/layouts/*` to `@/components/layout/*`.
      Accept: `apps/docs/src/components/layout/{header,footer,sidebar,content-layout}.tsx` exist; `src/layouts/` gone; docs type-check + tests pass.

- [ ] T-124 (fixes F-059) — files: apps/docs/src/lib/hooks/use-pending-docs-route.ts, its 3 importers
      Change: Move the lone-file `src/lib/hooks/use-pending-docs-route.ts`→`src/lib/use-pending-docs-route.ts` (flat, matching the sibling `lib/use-copy-feedback.ts`/`lib/use-demos.ts`). Delete the empty `lib/hooks/` folder. Rewrite the three importers.
      Accept: `src/lib/use-pending-docs-route.ts` exists; `src/lib/hooks/` gone; docs type-check + tests pass.

---

### Batch 1.F — cli/diffgazer app/screens + theme data + lib + shared-hooks
**Runs AFTER Batch 1.O** (see the Phase-1 batch-serialization note above): 1.F is NOT parallel-safe against 1.O because three of its tasks rewrite importer lines inside files that 1.O moves/renames. 1.F never MOVES a 1.O-owned file; it only edits import specifiers in them at their post-1.O paths.
files: cli/diffgazer/src/app/screens/** (+ router.tsx), cli/diffgazer/src/theme/{severity,severity-variant,palettes}.ts (theme DATA only — `theme-context.tsx` is owned solely by T-176/1.O and is NOT touched here), cli/diffgazer/src/config/, cli/diffgazer/src/config.ts (read-only collision check), cli/diffgazer/src/types/, cli/diffgazer/src/app/back-navigation.ts, cli/diffgazer/src/lib/servers/*, cli/diffgazer/src/hooks/{use-settings-zone,use-config-guard,use-exit-handler}.ts. Shared with 1.O (importer-line edits ONLY, on post-1.O paths): `cli/diffgazer/src/app/root.tsx` (the post-T-174 rename of `app/index.tsx`; T-127/T-128/T-131 rewrite its import lines) and `cli/diffgazer/src/app/providers/navigation-provider.tsx` (the post-T-175 move of `navigation-context.tsx`; T-129 rewrites its `back-navigation` import line). (The `app/providers/` tier, `navigation-context.tsx`, `index.tsx`, and `theme/theme-context.tsx` MOVES/RENAMES are all owned by Batch 1.O.)

- [ ] T-125 (fixes F-031, F-032) — files: cli/diffgazer/src/app/screens/{home,review,history,help,onboarding}-screen.tsx, cli/diffgazer/src/app/screens/settings/{hub,theme,providers,storage,analysis,agent-execution,diagnostics,trust-permissions}-screen.tsx, cli/diffgazer/src/app/screens/review-screen-phase.ts, cli/diffgazer/src/app/screens/settings/{hub-screen-values,theme-screen-preview}.ts (+ matching .test.ts), cli/diffgazer/src/app/router.tsx
      Change: Drop the `-screen` folder-echo suffix from all 13 screen files (e.g. `home-screen.tsx`→`home.tsx`, `settings/hub-screen.tsx`→`settings/hub.tsx`, … `settings/trust-permissions-screen.tsx`→`settings/trust-permissions.tsx`), keeping the `*Screen` PascalCase symbols. Also rename the three screen-helper splits dropping `-screen` and the helper grab-bag tail: `review-screen-phase.ts`→`screens/review-phase.ts`, `settings/hub-screen-values.ts`→`settings/hub-values.ts`, `settings/theme-screen-preview.ts`→`settings/theme-preview.ts` (+ matching `.test.ts`). Rewrite the 13 import lines in `router.tsx` and the three importing screens.
      Accept: No `*-screen.tsx`/`*-screen-*.ts` basenames remain under `app/screens/`; `router.tsx` imports `./screens/home` etc.; `pnpm --filter` (cli/diffgazer) type-check + screen tests pass.

- [ ] T-126 (fixes F-124) — DECISION: SUPERSEDED BY T-176 (Batch 1.O). Do NOT execute T-126; it is folded into T-176.
      Rationale: F-124 (the `theme/theme-context` path-echo) and F-169 (the provider misplacement) are the SAME file. T-176 in Batch 1.O moves `cli/diffgazer/src/theme/theme-context.tsx`→`cli/diffgazer/src/app/providers/theme.tsx`, which removes the file from `theme/` entirely and so resolves the path-echo (F-124) and the misplacement (F-169) in one move. Per the Phase-1 batch-serialization note, `theme/theme-context.tsx` is owned SOLELY by T-176/1.O; Batch 1.F does not touch it. The standalone in-folder rename (`theme/theme-context.tsx`→`theme/context.tsx`) that this task originally described is NOT performed — it would be immediately undone by T-176's move.
      Accept: `cli/diffgazer/src/app/providers/theme.tsx` exists (created by T-176); no `theme/theme-context.tsx` remains; F-124 is recorded as resolved via T-176; cli/diffgazer type-check passes.

- [ ] T-127 (fixes F-061, F-062) — files: cli/diffgazer/src/config/navigation.ts, cli/diffgazer/src/config.ts (collision context), cli/diffgazer/src/app/screens/settings/hub.tsx (post-T-125), cli/diffgazer/src/types/cli.ts, cli/diffgazer/src/cli-options.ts, and CliMode importers (web-launcher.ts, tui-entry.tsx, app/root.tsx [post-T-174 rename of app/index.tsx], lib/servers/factories.ts)
      Change: (a) Delete the single-file `src/config/` folder (collides with `src/config.ts`): move its only content `SETTINGS_SHORTCUTS` to a colocated module `cli/diffgazer/src/app/screens/settings/shortcuts.ts` and rewrite the single importer (the settings hub screen). Phase-1 keeps the constant intact — do NOT inline into the screen here (inlining is a logic edit; create the sibling `shortcuts.ts` instead). (b) Delete the single-file `src/types/` folder: move `type CliMode` into `cli-options.ts` (which already owns `CliAction`) and rewrite the four `import type { CliMode }` sites to `./cli-options`.
      Accept: `src/config/` and `src/types/` folders gone; `app/screens/settings/shortcuts.ts` exists; `CliMode` is exported from `cli-options.ts`; cli/diffgazer type-check + tests pass.

- [ ] T-128 (fixes F-034) — files: cli/diffgazer/src/lib/servers/{api-server,web-server,embedded-server,create-process-server,server-factories}.ts (+ matching .test.ts), importers (app/root.tsx [post-T-174 rename of app/index.tsx], web-launcher.ts, hooks/use-servers.ts)
      Change: Folder-context rename inside `src/lib/servers/`, dropping the `-server(s)` echo: `api-server.ts`→`api.ts`, `web-server.ts`→`web.ts`, `embedded-server.ts`→`embedded.ts`, `create-process-server.ts`→`process.ts`, `server-factories.ts`→`factories.ts`. Keep `*Server`/`create*` symbols. (F-163's split of `findGitRoot`/browser-launch out of `factories.ts` is a SPLIT — deferred to the split phase; Phase 1 only renames the file.) Move `.test.ts` siblings. Rewrite intra-folder + external importers.
      Accept: No `*-server*.ts` basenames under `lib/servers/`; `api.ts`/`web.ts`/`embedded.ts`/`process.ts`/`factories.ts` exist; cli/diffgazer type-check + tests pass.

- [ ] T-129 (fixes F-135) — files: cli/diffgazer/src/app/back-navigation.ts, cli/diffgazer/src/app/navigation-context.tsx (importer)
      Change: Move `cli/diffgazer/src/app/back-navigation.ts`→`cli/diffgazer/src/lib/back-navigation.ts` (alongside `list-navigation.ts`/`highlight-navigation.ts`, mirroring apps/web's `lib/back-navigation.ts`). Rewrite the single importer in `app/navigation-context.tsx`. (Coordinate with T-175 in Batch 1.O, which MOVES `navigation-context.tsx`→`app/providers/navigation-provider.tsx`: per the Phase-1 batch-serialization note, Batch 1.O runs FIRST, so T-129's importer rewrite targets the file at its FINAL path `app/providers/navigation-provider.tsx` and updates the `back-navigation` import line once there.)
      Accept: `cli/diffgazer/src/lib/back-navigation.ts` exists; no `app/back-navigation.ts`; cli/diffgazer type-check passes.

- [ ] T-130 (fixes F-227) — files: cli/diffgazer/src/hooks/use-settings-zone.ts (+ test), cli/diffgazer/src/features/settings/hooks/ (new), the six app/screens/settings/*.tsx importers (post-T-125 names)
      Change: Move the settings-only `cli/diffgazer/src/hooks/use-settings-zone.ts` (+ its test) → `cli/diffgazer/src/features/settings/hooks/use-settings-zone.ts` (create the `hooks/` folder; feature already has 3+ logic submodules). Rewrite the six settings-screen import specifiers from `../../../hooks/use-settings-zone` to the new features path.
      Accept: `features/settings/hooks/use-settings-zone.ts` exists; no `src/hooks/use-settings-zone.ts`; cli/diffgazer type-check + settings-screen tests pass.

- [ ] T-131 (fixes F-243) — files: cli/diffgazer/src/hooks/use-config-guard.ts, use-exit-handler.ts, cli/diffgazer/src/app/root.tsx (post-T-174 rename of app/index.tsx), cli/diffgazer/src/app/providers/server.tsx (post-T-173 rename of server-provider.tsx)
      Change: Colocate each single-consumer hook with its sole consumer: move `src/hooks/use-config-guard.ts`→`src/app/use-config-guard.ts` (next to `root.tsx`, the post-T-174 app-root file) and `src/hooks/use-exit-handler.ts`→`src/app/providers/use-exit-handler.ts` (next to `server.tsx`, the post-T-173 server provider). Move colocated tests if present. Rewrite the import line in each consumer (`app/root.tsx` and `app/providers/server.tsx`) — this edits only those import specifiers, not the 1.O-owned renames themselves (1.O has already landed both files at these final paths). Keep genuinely-shared hooks (`use-terminal-dimensions`, `use-scope`, etc.) in `src/hooks/`.
      Accept: `src/app/use-config-guard.ts` and `src/app/providers/use-exit-handler.ts` exist; neither remains under `src/hooks/`; cli/diffgazer type-check passes.

---

### Batch 1.G — cli/diffgazer features (review/history/onboarding/providers + shared/ tier)
1.G is file-disjoint from Batch 1.O: it owns `features/*` + `components/{ui,shared}/*` and touches NO `app/providers/*`, `app/root.tsx`, `navigation-context.tsx`, or `theme/theme-context.tsx` file (every one of those moves/renames is owned by 1.O). It therefore does not need to wait on 1.O and may run in parallel with it. **However, 1.G shares the `cli/diffgazer/src/app/screens/settings/*.tsx` + providers screen files with Batch 1.F** (T-139 repoints those screens' import lines to the new `components/shared/` tier, and T-125 in 1.F renames those same screen files): **1.G is NOT parallel-safe against 1.F; run Batch 1.F FIRST** (so the screens sit at their final de-suffixed paths, e.g. `settings/storage.tsx`/`settings/providers.tsx`), then 1.G rewrites only the import specifiers inside them. T-132 also notes a T-148 sequencing dependency handled within the library phase.
files: cli/diffgazer/src/features/{review,history,onboarding,providers}/** (components+hooks+lib), cli/diffgazer/src/components/ui/{severity,progress}/ (new), cli/diffgazer/src/components/shared/ (new), and importer-line edits in the post-T-125 settings/providers screen files cli/diffgazer/src/app/screens/settings/*.tsx (shared with Batch 1.F — see the ordering note above).

- [ ] T-132 (fixes F-123) — files: cli/diffgazer/src/features/review/components/review-{container,metrics-footer,progress-view,results-view,summary-view}.tsx, features/review/hooks/use-review-{keyboard,lifecycle}.ts, features/onboarding/components/onboarding-wizard.tsx, features/onboarding/hooks/use-onboarding-wizard.ts, features/providers/components/provider-{details,list}.tsx, features/history/components/history-insights-pane.tsx, features/history/hooks/use-history-screen.ts (+ colocated tests)
      Change: Folder-context renames dropping the feature echo, mirroring the apps/web fix. review/components: drop `review-` (`review-container.tsx`→`container.tsx`, … `review-summary-view.tsx`→`summary-view.tsx`); review/hooks: `use-review-keyboard.ts`→`use-keyboard.ts`, `use-review-lifecycle.ts`→`use-lifecycle.ts`. onboarding: `onboarding-wizard.tsx`→`wizard.tsx`, `use-onboarding-wizard.ts`→`use-wizard.ts`. providers: `provider-details.tsx`→`details.tsx`, `provider-list.tsx`→`list.tsx`. history: `history-insights-pane.tsx`→`insights-pane.tsx`, `use-history-screen.ts`→`use-screen.ts`. Keep symbols. Move colocated tests; rewrite importers. NOTE: the review severity/progress display files are moved out of this folder by T-148 — sequence T-148 first OR fold its moves into this ts-morph pass so `review-summary-view.tsx`/`progress-view.tsx` import the relocated primitives correctly.
      Accept: No feature-echo basenames remain in those four feature slices (except files owned by T-148); cli/diffgazer type-check + feature tests pass.

- [ ] T-133 (fixes F-033, F-150) — files: cli/diffgazer/src/features/review/components/issue-details-helpers.ts, summary-view-helpers.ts, cli/diffgazer/src/features/review/lib/ (new), and consumers (issue-details-pane.tsx, review summary-view.tsx)
      Change: Move the two non-component pure helper modules out of `review/components/` into a `review/lib/` tier, renaming off the `-helpers` grab-bag to the concept: `components/issue-details-helpers.ts`→`lib/issue-line-range.ts` (export `formatIssueLineRange`), `components/summary-view-helpers.ts`→`lib/lens-stats.ts` (export `buildLensStats`). Keep symbols. Rewrite consumers. (DRY-merge with the apps/web twin is F-085 — Phase 2, not here.)
      Accept: `features/review/lib/issue-line-range.ts` and `lib/lens-stats.ts` exist; no `*-helpers.ts` under `review/components/`; cli/diffgazer type-check + tests pass.

- [ ] T-134 (fixes F-063) — files: cli/diffgazer/src/features/history/hooks/get-history-footer.ts, history-screen-utils.ts (+ .test.ts), cli/diffgazer/src/features/history/lib/ (new), cli/diffgazer/src/app/screens/history.tsx (post-T-125) and other importers
      Change: Move the two non-hook pure modules out of `features/history/hooks/` into a new `features/history/lib/`, leaving only the real hook `use-history-screen.ts` (→`use-screen.ts` per T-132) in `hooks/`. Rename off the grab-bag/echo tails: `get-history-footer.ts`→`lib/history-footer.ts`; `history-screen-utils.ts`→`lib/history-run-mapping.ts` (+ its `.test.ts`). Keep symbols. Rewrite importers.
      Accept: `features/history/lib/history-footer.ts` and `lib/history-run-mapping.ts` exist; `features/history/hooks/` holds only the (renamed) hook + its test; cli/diffgazer type-check + tests pass.

- [ ] T-135 (fixes F-035) — files: cli/diffgazer/src/features/home/lib/create-home-menu-action.ts (+ .test.ts), cli/diffgazer/src/app/screens/home.tsx (post-T-125), cli/diffgazer/src/features/home/components/home-menu.tsx
      Change: Rename `features/home/lib/create-home-menu-action.ts`→`features/home/lib/create-menu-action.ts` (drop the `home` feature echo; the path supplies it). Keep the `createHomeMenuAction` symbol unchanged in Phase 1. Move the `.test.ts`. Rewrite the importer in the home screen. (Optional sibling `home-menu.tsx`→`menu.tsx` is lower priority; include if convenient.)
      Accept: `features/home/lib/create-menu-action.ts` exists; no `create-home-menu-action.ts`; cli/diffgazer type-check + tests pass.

- [ ] T-136 (fixes F-116) — files: cli/diffgazer/src/features/settings/storage/derive-save-state.ts (+ test), cli/diffgazer/src/features/settings/trust-permissions/trust-editor-state.ts (+ test), cli/diffgazer/src/features/settings/lens-selection.ts (reference), the two consuming screens
      Change: Flatten the two single-source settings sub-folders to feature-root siblings matching the flat `lens-selection.ts`: `settings/storage/derive-save-state.ts`→`settings/derive-storage-save-state.ts`, `settings/trust-permissions/trust-editor-state.ts`→`settings/trust-editor-state.ts`. Delete the emptied `storage/` and `trust-permissions/` folders. Keep `diagnostics/` (4 files) as a folder. Move `.test.ts` siblings. Rewrite the two consuming screens.
      Accept: `features/settings/derive-storage-save-state.ts` and `features/settings/trust-editor-state.ts` exist; `settings/storage/` and `settings/trust-permissions/` folders gone; cli/diffgazer type-check + tests pass.

- [ ] T-137 (fixes F-149) — files: cli/diffgazer/src/features/onboarding/components/step-shortcuts.ts, cli/diffgazer/src/features/onboarding/lib/ (new), cli/diffgazer/src/features/onboarding/components/wizard.tsx (post-T-132)
      Change: Move the non-component `features/onboarding/components/step-shortcuts.ts`→`features/onboarding/lib/step-shortcuts.ts` (the TUI's `lib/` logic tier). Rewrite the single import in the onboarding wizard.
      Accept: `features/onboarding/lib/step-shortcuts.ts` exists; no `step-shortcuts.ts` under `onboarding/components/`; cli/diffgazer type-check + tests pass.

- [ ] T-138 (fixes F-167) — files: cli/diffgazer/src/features/review/components/{severity-bar,severity-breakdown,progress-list,progress-step}.tsx, cli/diffgazer/src/components/ui/{severity,progress}/ (new), cli/diffgazer/src/features/history/components/insights-pane.tsx (post-T-132), and review-feature consumers
      Change: Create the shared product-primitive tier and move the four display primitives out of the review feature: `features/review/components/severity-bar.tsx`→`components/ui/severity/bar.tsx`, `severity-breakdown.tsx`→`components/ui/severity/breakdown.tsx`, `features/review/components/progress-list.tsx`→`components/ui/progress/list.tsx`, `progress-step.tsx`→`components/ui/progress/step.tsx` (mirroring apps/web's `components/ui/{severity,progress}/{bar,breakdown,list,step}.tsx` from T-105). Keep symbols. Rewrite review consumers (`summary-view.tsx`, `progress-view.tsx`, `breakdown.tsx`) and the history `insights-pane.tsx`, eliminating the `../../review/components/severity-breakdown` cross-feature edge.
      Accept: `cli/diffgazer/src/components/ui/severity/{bar,breakdown}.tsx` and `components/ui/progress/{list,step}.tsx` exist; no severity/progress display files under `features/review/components/`; `rg -n "from ['\"](\.\./){2,3}(review|history)/" cli/diffgazer/src/features` returns no feature→feature import for these; cli/diffgazer type-check + tests pass.

- [ ] T-139 (fixes F-168) — files: cli/diffgazer/src/features/providers/components/api-key-method-selector.tsx, cli/diffgazer/src/features/settings/components/{analysis-selector,storage-selector}.tsx, cli/diffgazer/src/features/settings/components/trust-permissions-content.tsx (if present), cli/diffgazer/src/components/shared/ (new), and consumers (onboarding steps api-key/analysis/storage, settings/providers screens)
      Change: Create `cli/diffgazer/src/components/shared/` mirroring apps/web, and move the cross-feature selector controls there: `features/providers/components/api-key-method-selector.tsx`→`components/shared/api-key-method-selector.tsx`; `features/settings/components/analysis-selector.tsx`→`components/shared/analysis-selector.tsx`; `features/settings/components/storage-selector.tsx`→`components/shared/storage-selector.tsx` (and `trust-permissions-content.tsx` if it exists in settings). Keep symbols. Repoint the onboarding step components (`steps/api-key-step.tsx`, `analysis-step.tsx`, `storage-step.tsx`) and the settings/providers screens to the shared tier, removing the `../../../<feature>/` edges.
      Accept: `cli/diffgazer/src/components/shared/{api-key-method-selector,analysis-selector,storage-selector}.tsx` exist; onboarding steps import from `@/components/shared` / relative shared path, not from sibling features; cli/diffgazer type-check + tests pass.

---

### Batch 1.H — cli/server
files: cli/server/src/features/review/** (context*/sessions*/stream*/sse*/step*/review-routes), cli/server/src/features/health/, cli/server/src/app.ts, cli/server/src/dev.ts, cli/server/src/{http-server,index}.ts, cli/server/src/shared/lib/config/{store,state,*-store,*-state}.ts, cli/server/package.json, scripts/monorepo/benchmark-server.mjs (comment)

- [ ] T-140 (fixes F-064, F-117, F-036) — files: cli/server/src/features/review/{context.ts,context-routes.ts,file-tree.ts,workspace-discovery.ts,sessions.ts,session-resume.ts,sse-replay.ts,stream-events.ts,step-events.ts,review-routes.ts}, cli/server/src/features/review/{context,stream}/ (new), router.ts, service.ts, pipeline.ts (+ colocated tests)
      Change: Three lockstep moves within the flat `features/review/` slice. (a) Promote the context sub-area: `context.ts`→`context/snapshot.ts`, `context-routes.ts`→`context/routes.ts`, `file-tree.ts`→`context/file-tree.ts`, `workspace-discovery.ts`→`context/workspace-discovery.ts`. (b) Promote the stream/session sub-area: `sessions.ts`→`stream/store.ts`, `session-resume.ts`→`stream/resume.ts`, `sse-replay.ts`→`stream/replay.ts`, `stream-events.ts`→`stream/events.ts`, `step-events.ts`→`stream/steps.ts`. (c) Rename the path-echo handler file: `review-routes.ts`→`handlers.ts`. Move colocated tests with their source. Rewrite `router.ts` (the `./context-routes.js`→`./context/routes.js`, `./review-routes.js`→`./handlers.js` mounts), `service.ts`, `pipeline.ts` (`./context.js`→`./context/snapshot.js`), and intra-cluster imports. Pure import-rewrite only — no handler logic edits.
      Accept: `features/review/context/{snapshot,routes,file-tree,workspace-discovery}.ts` and `features/review/stream/{store,resume,replay,events,steps}.ts` and `features/review/handlers.ts` exist; no `context-routes.ts`/`sessions.ts`/`sse-replay.ts`/`review-routes.ts` flat files remain; cli/server type-check + review tests pass. (Run `prepare:artifacts`/`validate:artifacts:check` is NOT required — no public registry surface — but the full `turbo run test` gate covers the SSE seam.)

- [ ] T-141 (fixes F-257) — files: cli/server/src/features/health/router.ts, cli/server/src/app.ts
      Change: Flatten the single-file feature folder: move `cli/server/src/features/health/router.ts`→`cli/server/src/features/health.ts` and delete the `features/health/` folder. Keep the `healthRouter` export. Rewrite the import in `app.ts` (line ~10) and keep both `app.route('/', healthRouter)` and `app.route('/api', healthRouter)` mounts pointed at `./features/health.js`.
      Accept: `cli/server/src/features/health.ts` exists; `features/health/` folder gone; cli/server type-check + health route test pass.

- [ ] T-142 (fixes F-134) — files: cli/server/src/dev.ts, cli/server/package.json, scripts/monorepo/benchmark-server.mjs
      Change: Rename the misnamed production serve entry `cli/server/src/dev.ts`→`cli/server/src/serve.ts` (it is run by BOTH `dev` and `start`). Update `package.json` scripts: `"dev": "tsx src/serve.ts"` and `"start": "node dist/serve.js"`. Update the `benchmark-server.mjs` comment/path reference. Leave `app.ts` (factory) and `index.ts` (lib entry) unchanged.
      Accept: `cli/server/src/serve.ts` exists; no `src/dev.ts`; `package.json` dev/start point at `serve`; cli/server type-check + `pnpm run smoke` (cli/server build path) pass.

- [ ] T-143 (fixes F-160) — files: cli/server/src/shared/lib/config/state.ts, store.ts (reference), secrets-store.ts, trust-store.ts, providers-state.ts, and importers
      Change: Disambiguate the confusable `store.ts`/`state.ts` pair: rename `shared/lib/config/state.ts`→`shared/lib/config/persistence.ts` (it owns `loadConfig`/`persistConfig*`, mirroring the existing `shared/lib/storage/persistence.ts`). Keep `store.ts` as the `ConfigStore` singleton. Align the satellite: rename `providers-state.ts`→`providers-store.ts` so the trio (`secrets-store`, `trust-store`, `providers-store`) is consistent (these are store modules). Keep symbols. Rewrite importers.
      Accept: `shared/lib/config/persistence.ts` and `providers-store.ts` exist; no `config/state.ts`/`providers-state.ts`; cli/server type-check + config tests pass.

---

### Batch 1.I — cli/add
files: cli/add/src/utils/{add-integration.ts,integration.ts}, cli/add/src/commands/{add.ts,remove.ts,diff.ts}, cli/add/src/commands/add/{css-ops.ts,file-ops.ts,manifest.ts,command.ts,integration.ts}, cli/add/src/utils/{keys-integration-mode.ts,keys-copy-bundle.ts,css-chunks.ts} (new)

- [ ] T-144 (fixes F-130) — files: cli/add/src/utils/add-integration.ts, cli/add/src/utils/integration.ts, and importers (commands/add.ts, commands/add/file-ops.ts, commands/add/manifest.ts)
      Change: Resolve the confusable pair and pre-empt the F-066 collision by renaming both utils to name their concept: `cli/add/src/utils/add-integration.ts`→`cli/add/src/utils/keys-integration-mode.ts` (IntegrationMode selection) and `cli/add/src/utils/integration.ts`→`cli/add/src/utils/keys-copy-bundle.ts` (keys copy-bundle loader). Keep symbols. Rewrite all importers. Run this BEFORE T-145.
      Accept: `utils/keys-integration-mode.ts` and `utils/keys-copy-bundle.ts` exist; no `utils/add-integration.ts`/`utils/integration.ts`; cli/add type-check + tests pass.

- [ ] T-145 (fixes F-066, F-067) — files: cli/add/src/commands/add.ts, cli/add/src/commands/add/{css-ops.ts,file-ops.ts,manifest.ts}, cli/add/src/commands/{remove.ts,diff.ts}, cli/add/src/utils/keys-integration-mode.ts (post-T-144)
      Change: (a) F-067: move the command file into its same-stem folder dropping the unit name: `commands/add.ts`→`commands/add/command.ts`; keep add-only `file-ops.ts`/`manifest.ts` as siblings in `commands/add/`. Move the cross-command (`add`/`remove`/`diff`) `commands/add/css-ops.ts` OUT to a shared module `cli/add/src/utils/css-chunks.ts`; rewrite its three importers. (b) F-066: move the add-command-only helper (already renamed to `utils/keys-integration-mode.ts` by T-144) into the command folder dropping the `add-` echo → `commands/add/integration.ts` (no collision now that the old `utils/integration.ts` is `keys-copy-bundle.ts`). Rewrite the three importers (`commands/add/command.ts`, `commands/add/file-ops.ts`, `commands/add/manifest.ts`). Whoever still wires the `add` command must import `commands/add/command.ts`.
      Accept: `commands/add.ts` file gone (replaced by `commands/add/command.ts`); `commands/add/integration.ts` and `utils/css-chunks.ts` exist; `css-ops.ts` no longer under `commands/add/`; cli/add type-check + command tests pass. (Run AFTER T-144.)

---

### Batch 1.J — libs/core
files: libs/core/src/{providers,review,schemas,catalog,forms,hooks,select,layout,streaming,api}/**, libs/core/package.json (exports repoint). All internal relative `.js` imports; lockstep package.json subpath edits.

- [ ] T-146 (fixes F-042, F-043, F-069, F-070) — files: libs/core/src/providers/use-provider-models-mapped.ts, libs/core/src/review/{review-state.ts,stream-review.ts}, libs/core/src/streaming/sse-parser.ts (+ test), libs/core/src/layout/breakpoints.ts, and their barrels (providers/index.ts, review/index.ts, src/index.ts) + relative importers
      Change: Folder-context renames + single-file-folder flattening, internal relative imports only (no public subpath change). `providers/use-provider-models-mapped.ts`→`providers/use-models-mapped.ts` (repoint `providers/index.ts:5`). `review/review-state.ts`→`review/state.ts`, `review/stream-review.ts`→`review/stream.ts` (repoint `review/index.ts`, move colocated tests). `streaming/sse-parser.ts`(+test)→`src/sse-parser.ts`; delete the `streaming/` folder; rewrite the one importer `review/stream.ts`. `layout/breakpoints.ts`→`src/breakpoints.ts`; delete the `layout/` folder; repoint `src/index.ts`.
      Accept: New paths exist; `providers/`, `review/`, `streaming/`, `layout/` no longer contain the old basenames/folders; `pnpm --filter @diffgazer/core type-check` passes; core tests pass.

- [ ] T-147 (fixes F-044, F-068) — files: libs/core/src/schemas/git/{git.ts,index.ts}, libs/core/src/schemas/context/{context.ts,index.ts}, libs/core/src/schemas/index.ts, libs/core/package.json (exports `./schemas/git`, `./schemas/context`), importers (cli/server git service/types, libs/core api/git.ts, api/types.ts)
      Change: Flatten the two single-file path-echo folders with redundant 1-line barrels to flat files matching the sibling `schemas/errors.ts`: `schemas/git/git.ts`→`schemas/git.ts`, `schemas/context/context.ts`→`schemas/context.ts`. Delete the two `index.ts` barrels and the emptied folders. Repoint `package.json` `exports["./schemas/git"]`/`["./schemas/context"]` at the flat files (`./dist/schemas/git.js` etc.) and update the `export * from "./git/index.js"` / context lines in `schemas/index.ts`. Update the handful of importers. Public subpath strings unchanged.
      Accept: `schemas/git.ts` and `schemas/context.ts` exist; `schemas/git/`, `schemas/context/` folders gone; `./schemas/git` and `./schemas/context` still resolve; core + cli/server type-check pass; `pnpm run validate:artifacts:check` (public exports map) passes.

- [ ] T-148 (fixes F-115) — files: libs/core/src/forms/{use-submit-guard.ts,index.ts}, libs/core/src/hooks/{use-timer.ts,index.ts}, libs/core/src/select/{resolve-available-value.ts,index.ts}, libs/core/package.json (exports ./forms, ./hooks, ./select), test files
      Change: Collapse three single-file-folder subpaths to flat files (mirroring the existing flat `./get-figlet`). `forms/use-submit-guard.ts`→`src/forms.ts`; `select/resolve-available-value.ts`→`src/select.ts`; `hooks/use-timer.ts`→`src/timer.ts` (rename the generic `./hooks` bucket subpath to `./timer`). Delete the three `index.ts` barrels and emptied folders. Repoint `package.json` `exports` (`./forms`→`./dist/forms.js`, `./select`→`./dist/select.js`, drop `./hooks`, add `./timer`→`./dist/timer.js`). Move colocated `.test` files. Update consumers of `@diffgazer/core/hooks` → `@diffgazer/core/timer`.
      Accept: `src/forms.ts`, `src/select.ts`, `src/timer.ts` exist; `forms/`, `hooks/`, `select/` folders gone; `./forms`/`./select`/`./timer` resolve and `./hooks` is removed; all `@diffgazer/core/hooks` importers updated; core type-check + `validate:artifacts:check` pass. NOTE: changing the `./hooks` subpath to `./timer` is a public-surface rename — sweep every workspace for `@diffgazer/core/hooks` consumers and update them in this same task (D7).

- [ ] T-149 (fixes F-119) — files: libs/core/src/schemas/review/shared.ts, libs/core/src/schemas/review/{issues.ts,lens.ts,index.ts}
      Change: Phase-1 single-file rename only (NOT the multi-file split the finding lists as preferred): rename the banned grab-bag `schemas/review/shared.ts`→`schemas/review/enums.ts` (it holds the severity/lens/profile enum families). Keep all exported symbols. Repoint the `./shared.js` relative imports in `issues.ts` and `lens.ts`. Public `./schemas/review` subpath unchanged. (The optional split into `severity.ts`/`profile.ts` is deferred to the split phase.)
      Accept: `schemas/review/enums.ts` exists; no `schemas/review/shared.ts`; core type-check + `validate:artifacts:check` pass.

- [ ] T-150 (fixes F-146) — files: libs/core/src/schemas/shared/{fields.ts,statuses.ts}, libs/core/package.json (export `./schemas/shared/fields`), importers (cli/server storage/persistence.ts, schemas/presentation/progress.ts, schemas/events/step.ts)
      Change: Dissolve the grab-bag-named folder `schemas/shared/`. Move `schemas/shared/fields.ts`→`schemas/fields.ts` and repoint the public subpath `./schemas/shared/fields`→`./schemas/fields` in `package.json` (lockstep-update `cli/server/.../persistence.ts` + the two intra-core importers). Move `schemas/shared/statuses.ts`→`schemas/events/statuses.ts` (its real domain; both consumers are event/lifecycle schemas) and rewrite the two `../shared/statuses.js` imports. Delete the emptied `schemas/shared/` folder. Phase-1 keeps `statuses.ts` as a file (no inlining).
      Accept: `schemas/fields.ts` and `schemas/events/statuses.ts` exist; `schemas/shared/` folder gone; `./schemas/shared/fields` is replaced by `./schemas/fields`; all importers updated; core + cli/server type-check + `validate:artifacts:check` pass (D7 public-subpath rename).

- [ ] T-151 (fixes F-133) — files: libs/core/src/api/openrouter-utils.ts, libs/core/src/review/lifecycle-helpers.ts, importers (providers/use-openrouter-models-mapped.ts, api/index.ts, review/index.ts)
      Change: Rename the two banned grab-bag basenames to their concept (single-file rename, no split): `api/openrouter-utils.ts`→`api/openrouter.ts`; `review/lifecycle-helpers.ts`→`review/lifecycle.ts`. Keep symbols. Repoint the importers and the `api/index.ts`/`review/index.ts` re-export lines.
      Accept: `api/openrouter.ts` and `review/lifecycle.ts` exist; no `openrouter-utils.ts`/`lifecycle-helpers.ts`; core type-check passes.

- [ ] T-152 (fixes F-145) — files: libs/core/src/schemas/config/trust-capabilities-model.ts (+ .test.ts), libs/core/src/schemas/config/index.ts
      Change: Rename `schemas/config/trust-capabilities-model.ts`→`schemas/config/trust-capabilities.ts` (drop the meaningless `-model` suffix) and `trust-capabilities-model.test.ts`→`trust-capabilities.test.ts`. Repoint the `export * from "./trust-capabilities-model.js"` line in `schemas/config/index.ts`. Public `./schemas/config` subpath unchanged.
      Accept: `schemas/config/trust-capabilities.ts` (+ test) exists; no `trust-capabilities-model.*`; core type-check + `validate:artifacts:check` pass.

- [ ] T-153 (fixes F-244) — files: libs/core/src/schemas/config/capabilities.ts, libs/core/src/catalog/capabilities.ts (collision reference), libs/core/src/schemas/config/index.ts, importers
      Change: Rename the misnamed provider-list-assembly file that collides with the real `catalog/capabilities.ts`: `schemas/config/capabilities.ts`→`schemas/config/provider-registry.ts` (it exports `AVAILABLE_PROVIDERS`/`PROVIDER_CAPABILITIES`/`PROVIDER_ENV_VARS`/`resolveProviderDisplayName`/`ALLOWED_CREDENTIAL_ENV_VARS` — provider availability/env/display assembly, NOT capability derivation). Keep symbols. Repoint `schemas/config/index.ts:3` and the public `./schemas/config` subpath consumers. Reserve the `capabilities.ts` basename for the catalog derivation. (The schemas/config↔catalog cycle itself is R-001 — its import-direction fix is a separate phase; here only the filename moves.)
      Accept: `schemas/config/provider-registry.ts` exists; no second `capabilities.ts` under `schemas/config/`; core type-check + `validate:artifacts:check` pass.

- [ ] T-154 (fixes F-159) — files: libs/core/src/api/hooks/use-review-lifecycle-base.ts, libs/core/src/api/hooks/index.ts, apps/web/src/features/review/hooks/use-lifecycle.ts (post-T-103), cli/diffgazer/src/features/review/hooks/use-lifecycle.ts (post-T-132)
      Change: Rename the only `-base` basename in the repo to name the concept it owns (single-file rename, keep its symbol): `libs/core/src/api/hooks/use-review-lifecycle-base.ts`→`use-review-lifecycle-controller.ts` (it is the shared lifecycle controller the two app wrappers consume). Repoint the `api/hooks/index.ts` re-export and both app wrappers' imports in the same lockstep commit.
      Accept: `use-review-lifecycle-controller.ts` exists; no `*-base.ts` basename anywhere in core; core + web + cli/diffgazer type-check pass.

---

### Batch 1.K — libs/keys
**Runs AFTER Batch 1.O** (see the Phase-1 batch-serialization note above): 1.K shares `libs/keys/src/index.ts` and `libs/keys/src/providers/keyboard-provider.tsx` with 1.O's T-173. 1.O renames `keyboard-provider.tsx`→`providers/keyboard.tsx` and rewrites the provider re-export line in `src/index.ts` FIRST; 1.K then edits the keyboard-context re-export line in `src/index.ts` (a DIFFERENT line) and the cross-import inside the now-renamed `providers/keyboard.tsx`. 1.K is disjoint from 1.F, so the two may run in parallel after 1.O.
files: libs/keys/src/dom/dom.ts (+ test), libs/keys/src/context/keyboard-context.ts, libs/keys/src/providers/keyboard.tsx (post-T-173 rename of keyboard-provider.tsx), libs/keys/src/index.ts, libs/keys/registry/examples/** (+ libs/registry/src/docs-data/examples.ts for F-046 doc note)

- [ ] T-155 (fixes F-045) — files: libs/keys/src/dom/dom.ts, libs/keys/src/dom/dom.test.ts, and the 7 importing sites (hooks/use-focus-zone.ts, use-focus-trap.ts, providers/keyboard.tsx [post-T-173 rename of keyboard-provider.tsx], focusable.ts, keyboard-utils.ts, focus-restore.ts, etc.)
      Change: Rename the path-echo `libs/keys/src/dom/dom.ts`→`libs/keys/src/dom/element-guards.ts` (it holds `getOwnerView`/`isHTMLElement`/`isHTMLInputElement`/`isHTMLTextAreaElement`/`isNode`). Move `dom.test.ts`→`element-guards.test.ts`. Keep symbols. ts-morph rewrites the 7 explicit-`.js` import specifiers (one of them lives in the post-T-173 `providers/keyboard.tsx`). No public-registry surface.
      Accept: `libs/keys/src/dom/element-guards.ts` (+ test) exists; no `dom/dom.ts`; `pnpm --filter @diffgazer/keys type-check` + keys tests pass.

- [ ] T-156 (fixes F-071) — files: libs/keys/src/context/keyboard-context.ts, libs/keys/src/providers/keyboard.tsx (post-T-173 rename of keyboard-provider.tsx), libs/keys/src/index.ts
      Change: Move the single-file-folder path-echo `libs/keys/src/context/keyboard-context.ts`→`libs/keys/src/providers/keyboard-context.ts` (it already imports the contexts FROM the provider module — now `../providers/keyboard.js` after T-173 renamed `keyboard-provider.tsx`→`keyboard.tsx`; providers/ becomes a real multi-file unit). Delete the empty `src/context/` folder. Rewrite the keyboard-context re-export line in `src/index.ts:75` (a DIFFERENT line from the provider re-export T-173 already updated) and the internal cross-import inside `providers/keyboard.tsx`.
      Accept: `libs/keys/src/providers/keyboard-context.ts` exists; `src/context/` gone; keys type-check + tests pass. (Note: this co-locates the file but does NOT change which symbols live where — the context/provider ownership inversion R-151 is a logic concern for a later phase.)

- [ ] T-157 (fixes F-046) — files: libs/keys/registry/examples/**/*.tsx, libs/registry/src/docs-data/examples.ts, apps/docs demo-index consumers
      Change: This finding is INFO and its real fix requires changing `generateDemoIndex` to namespace demo keys by `${item.name}/${exampleName}` — that is a LOGIC edit, not a pure move, so it is OUT OF SCOPE for Phase 1. Phase-1 action: DOCUMENT the path-echo as a deliberate global-demo-key constraint (add a one-line comment at `libs/registry/src/docs-data/examples.ts:23-38` noting the prefix is load-bearing for the collision-guarded global key) — but if even that comment edit is considered a logic touch, defer the entire finding to the split/logic phase. Do NOT rename the example files in Phase 1 (it would collide on the global demo key).
      Accept: No example files renamed in Phase 1; finding explicitly carried forward (either the one-line constraint comment exists, or the finding is annotated as deferred in the phase report). Keys type-check + artifact validation unchanged.

---

### Batch 1.L — libs/ui (registry source + scripts + src/validation + shared) — public-surface lockstep
files: libs/ui/registry/ui/**, libs/ui/registry/hooks/**, libs/ui/registry/lib/**, libs/ui/src/validation/**, libs/ui/shared/**, libs/ui/scripts/**, libs/ui/testing/utils.ts, libs/ui/registry/registry.json, libs/ui/public/r/*.json, libs/ui/tsup.config.ts, libs/ui/scripts/build-declarations.ts, libs/ui/tsconfig*.json. Every task here is a D7 lockstep across source + registry.json + public/r + generated bundle paths.

- [ ] T-158 (fixes F-010, F-051, F-053) — files: libs/ui/src/validation/{registry-exports-validator,registry-import-validator,registry-orphan-validator,registry-validation-fs}.ts, libs/ui/scripts/registry/ (new), libs/ui/scripts/validate-registry-metadata.ts, libs/ui/scripts/transform-public-registry-keys-imports.ts, libs/ui/scripts/build-shadcn-registry.ts, libs/ui/registry/lib/testing/registry-validators.test.ts, libs/ui/tsconfig.json, libs/ui/tsconfig.tools.json
      Change: (F-010) Move the four build-time validators out of the misleading runtime `src/` shell into `libs/ui/scripts/registry/`, dropping the `registry-`/`validation` path-echo (F-051): `src/validation/registry-exports-validator.ts`→`scripts/registry/exports.ts`, `registry-import-validator.ts`→`scripts/registry/imports.ts`, `registry-orphan-validator.ts`→`scripts/registry/orphans.ts`, `registry-validation-fs.ts`→`scripts/registry/fs.ts`. Delete the empty `libs/ui/src/` directory. (F-053) Rename `scripts/transform-public-registry-keys-imports.ts`→`scripts/registry/rewrite-keys-imports.ts`. Rewrite imports in `scripts/validate-registry-metadata.ts`, `scripts/build-shadcn-registry.ts`, and `registry/lib/testing/registry-validators.test.ts`. Remove the `src/**` entry (and the now-redundant `src/**/*.test.ts` exclude) from `tsconfig.tools.json`; ensure `scripts/registry/**` stays type-checked.
      Accept: `libs/ui/src/` no longer exists; `libs/ui/scripts/registry/{exports,imports,orphans,fs,rewrite-keys-imports}.ts` exist; `transform-public-registry-keys-imports.ts` gone; `pnpm --filter @diffgazer/ui type-check` (incl. tools config) passes; ui tests pass.

- [ ] T-159 (fixes F-185) — files: libs/ui/shared/registry-types.ts, libs/ui/tsup.config.ts, libs/ui/scripts/build-declarations.ts
      Change: Dissolve the grab-bag single-file folder `libs/ui/shared/`. Move `shared/registry-types.ts`→`libs/ui/scripts/registry-types.ts` (alongside its only consumers, the tsup/declarations tooling). Delete the empty `shared/` folder. Rewrite the two import specifiers in `tsup.config.ts` (`./shared/registry-types.js`→`./scripts/registry-types.js`) and `scripts/build-declarations.ts` (`../shared/registry-types.js`→`./registry-types.js`). (The F-083 type DUPLICATION against the relocated validators is a Phase-2 DRY merge — not here.)
      Accept: `libs/ui/shared/` gone; `libs/ui/scripts/registry-types.ts` exists; ui type-check + build (`tsup`, `build-declarations`) succeed.

- [ ] T-160 (fixes F-047, F-049-select) — files: libs/ui/registry/ui/select/select-utils.ts, get-visible-enabled-options.ts, sibling select/* importers, libs/ui/registry/registry.json, libs/ui/public/r/select.json, generated bundle
      Change: (F-047) Rename `registry/ui/select/select-utils.ts`→`registry/ui/select/selection.ts` (drop the grab-bag + folder echo). (F-049 select half) Rename `registry/ui/select/get-visible-enabled-options.ts`→`registry/ui/select/visible-options.ts`. Keep symbols. Rewrite the sibling imports (incl. `select-content.tsx`), the `registry.json` file paths, `public/r/select.json` path+content entries, and let the tsup bundle regenerate. D7 lockstep.
      Accept: `select/selection.ts` and `select/visible-options.ts` exist; no `select-utils.ts`/`get-visible-enabled-options.ts`; `pnpm run prepare:artifacts` + `pnpm run validate:artifacts:check` pass; ui type-check + select tests pass.

- [ ] T-161 (fixes F-049-logo) — files: libs/ui/registry/ui/logo/get-figlet-text.ts, libs/ui/registry/ui/logo/figlet.ts (re-export), libs/ui/tsup.config.ts:54, libs/ui/scripts/build-declarations.ts:225, libs/ui/registry/registry.json, libs/ui/public/r/logo.json
      Change: Rename `registry/ui/logo/get-figlet-text.ts`→`registry/ui/logo/figlet-text.ts` (drop the `get-` verb prefix; aligns the impl with the public `logo/figlet` concept). Keep symbols. Repoint the `logo/figlet.ts` re-export, `tsup.config.ts:54`, `build-declarations.ts:225`, `registry.json`, and `public/r/logo.json`. D7 lockstep.
      Accept: `logo/figlet-text.ts` exists; no `get-figlet-text.ts`; `prepare:artifacts` + `validate:artifacts:check` pass; ui type-check passes.

- [ ] T-162 (fixes F-048) — files: libs/ui/registry/ui/{select/use-select-state.ts,select/use-select-typeahead.ts,accordion/use-accordion-state.ts,stepper/use-stepper-state.ts,command-palette/use-command-palette-state.ts,toast/use-toast-dismiss.ts,toast/use-toast-container.ts,spinner/use-spinner-animation.ts,popover/use-popover-behavior.ts}, sibling importers, registry.json, public/r/*.json, generated bundle
      Change: Folder-context move dropping the component prefix, naming the concept to avoid `useState` collision: `use-select-state.ts`→`use-state-machine.ts`, `use-select-typeahead.ts`→`use-typeahead.ts`, `use-accordion-state.ts`/`use-stepper-state.ts`/`use-command-palette-state.ts`→`use-state.ts` (each in its own folder), `use-toast-dismiss.ts`→`use-dismiss.ts`, `use-toast-container.ts`→`use-container.ts`, `use-spinner-animation.ts`→`use-animation.ts`, `use-popover-behavior.ts`→`use-behavior.ts`. Keep hook symbols. Rewrite sibling imports + `registry.json`/`public/r` entries; regenerate bundle. D7 lockstep.
      Accept: None of the nine `use-<component>-*` basenames remain in their folders; the renamed `use-*` files exist; `prepare:artifacts` + `validate:artifacts:check` pass; ui type-check + the affected component tests pass.

- [ ] T-163 (fixes F-050) — files: libs/ui/registry/hooks/use-listbox-dom.ts, use-listbox-metadata.ts (+ sibling tests), use-listbox.ts (importer), registry.json, public/r/*.json, docs
      Change: Rename the two misused `use-` prefixed non-hook helper modules: `registry/hooks/use-listbox-dom.ts`→`registry/hooks/listbox-dom.ts`, `use-listbox-metadata.ts`→`listbox-metadata.ts` (they export plain functions, not hooks). Move sibling tests. Rewrite the import in `use-listbox.ts`, `registry.json` file paths, `public/r` JSON, and docs references. D7 lockstep.
      Accept: `registry/hooks/listbox-dom.ts` and `listbox-metadata.ts` exist; no `use-listbox-dom.ts`/`use-listbox-metadata.ts`; `prepare:artifacts` + `validate:artifacts:check` pass; ui type-check passes.

- [ ] T-164 (fixes F-118) — files: libs/ui/registry/hooks/compute-floating-position.ts, floating-position-constants.ts, use-floating-position.ts (importer), registry.json
      Change: Move the two misplaced non-hook pure modules out of `registry/hooks/` into the `registry/lib/` tier (registry convention: hooks/ holds hooks, lib/ holds pure logic): `hooks/compute-floating-position.ts`→`lib/floating-position.ts` (the compute functions), `hooks/floating-position-constants.ts`→`lib/floating-position-constants.ts` (types + const maps; Phase-1 keeps it as its own file — folding constants in is a split-phase merge). Keep symbols. Rewrite the import in `use-floating-position.ts` and the `floating-position` `registry.json` item file paths. D7 lockstep.
      Accept: Both files live under `registry/lib/`; neither remains under `registry/hooks/`; `prepare:artifacts` + `validate:artifacts:check` pass; ui type-check passes.

- [ ] T-165 (fixes F-131) — files: libs/ui/registry/lib/aria-utils.ts, importers (8+ primitives incl. ui/field/field.tsx), registry.json, public/r/aria-utils.json, generated bundle
      Change: Rename the grab-bag public-registry module `registry/lib/aria-utils.ts`→`registry/lib/aria.ts` (the dominant ARIA concept). Phase-1 single-file rename — keep `isHTMLElementForContainer` in the file for now (moving it to a DOM-guard home is a split-phase concern). Keep symbols. Rewrite all `@/lib/aria-utils` import sites, the `registry.json` item name + file path, and `public/r/aria-utils.json` (→ `aria.json`). D7 lockstep; the gitignored docs mirror regenerates via `prepare:artifacts`.
      Accept: `registry/lib/aria.ts` exists; no `aria-utils.ts`; `public/r/aria.json` present and `aria-utils.json` removed; `prepare:artifacts` + `validate:artifacts:check` pass; ui type-check + field tests pass.

- [ ] T-166 (fixes F-225) — files: libs/ui/registry/lib/sidebar-variants.ts, sidebar-intent.ts, libs/ui/registry/ui/sidebar/* (importers + destination), registry.json, public/r/sidebar-variants.json
      Change: Move the two single-component sidebar modules out of the shared `registry/lib/` tier into the component folder (matching `menu/menu-item-variants.ts`, `toast/toast-variants.ts`): `lib/sidebar-variants.ts`→`ui/sidebar/sidebar-variants.ts`, `lib/sidebar-intent.ts`→`ui/sidebar/sidebar-intent.ts`. Keep symbols. Rewrite the three sidebar component imports, the `registry.json` item paths (~lines 1739, 2408-2422), `public/r/sidebar-variants.json`, and the sidebar registry item's file list. Keep `sidebar-variants` as its own registry item name (external copy-consumers depend on it) — only the source path/location changes. D7 lockstep.
      Accept: `ui/sidebar/sidebar-variants.ts` and `ui/sidebar/sidebar-intent.ts` exist; neither remains under `registry/lib/`; `prepare:artifacts` + `validate:artifacts:check` pass; ui type-check + sidebar tests pass.

- [ ] T-167 (fixes F-052) — files: libs/ui/testing/utils.ts, registry test importers
      Change: Rename the grab-bag `libs/ui/testing/utils.ts`→`libs/ui/testing/axe.ts` (it exports a single `axe()` helper; distinct from the sanctioned `registry/lib/utils.ts` `cn()`). Rewrite the `../../../testing/utils` imports across the registry test files to `../../../testing/axe`.
      Accept: `libs/ui/testing/axe.ts` exists; no `testing/utils.ts`; ui type-check + tests pass.

---

### Batch 1.M — libs/registry
files: libs/registry/src/docs-data/build-docs-data.ts, libs/registry/src/docs/ + docs-data/ (folder renames), libs/registry/src/cli/logger.ts, libs/registry/src/{logger.ts,index.ts}, libs/registry/src/testing/docs-sync.test.ts

- [ ] T-168 (fixes F-039) — files: libs/registry/src/docs-data/build-docs-data.ts, libs/registry/src/docs-data/index.ts (or root index.ts)
      Change: Rename the path-echo `libs/registry/src/docs-data/build-docs-data.ts`→`libs/registry/src/docs-data/build.ts` (drop the folder echo; the orchestrator `buildDocsData` symbol stays). Repoint the two re-export lines in `docs-data/index.ts` (kept; Phase 3 dissolves it). (Run BEFORE/with T-169 since T-169 may rename the parent folder.)
      Accept: `docs-data/build.ts` exists; no `build-docs-data.ts`; `pnpm --filter @diffgazer/registry type-check` passes.

- [ ] T-169 (fixes F-211) — files: libs/registry/src/docs/ (folder), libs/registry/src/index.ts, libs/registry/src/testing/docs-sync.test.ts
      Change: Resolve the confusable sibling folders `docs/` vs `docs-data/` by renaming the SYNC-engine folder to name its concept: `directory.move` `libs/registry/src/docs/`→`libs/registry/src/docs-sync/` (it owns `syncDocsFromArtifacts` + loader/sync-operations/cache/paths). Keep `docs-data/` (the builders) as-is. Rewrite the four `./docs/...` re-export specifiers in `src/index.ts` and the `../docs/...` import in `src/testing/docs-sync.test.ts`. Public export symbols unchanged.
      Accept: `libs/registry/src/docs-sync/` exists; no `src/docs/` folder; registry type-check + tests pass.

- [ ] T-170 (fixes F-147) — files: libs/registry/src/cli/logger.ts, importers; libs/registry/src/logger.ts (kept)
      Change: Rename the confusable, mislabeled `libs/registry/src/cli/logger.ts`→`libs/registry/src/cli/terminal.ts` (it is a terminal-output/prompting presentation layer: figlet banner, `@clack/prompts`, picocolors, `CancelError`, `setSilent` — not a logger). Keep `libs/registry/src/logger.ts` (the engine `Logger` port). Keep symbols. Rewrite its importers.
      Accept: `libs/registry/src/cli/terminal.ts` exists; no second `logger.ts` under `src/cli/`; registry type-check + tests pass.

---

### Batch 1.N — scripts/monorepo + deploy (build-only, lockstep tooling paths)
files: scripts/monorepo/smoke-*.mjs, scripts/monorepo/smoke/ (new), package.json (smoke script paths), deploy/spa-nginx.conf, deploy/landing.Dockerfile

- [ ] T-171 (fixes F-224) — files: deploy/spa-nginx.conf, deploy/landing.Dockerfile
      Change: Rename `deploy/spa-nginx.conf`→`deploy/landing-nginx.conf` (matches the service-named `registry-nginx.conf`; its sole consumer is the landing Dockerfile). Update the single `COPY deploy/spa-nginx.conf …` reference in `deploy/landing.Dockerfile:31`.
      Accept: `deploy/landing-nginx.conf` exists; no `deploy/spa-nginx.conf`; `rg -n 'spa-nginx' deploy .github docker-compose.yml Dockerfile` returns nothing.

- [ ] T-172 (fixes F-157) — files: scripts/monorepo/smoke-{package-install,package-fixtures,package-runner,shadcn-install,keys-absent,cli,modelsdev,shared}.mjs, scripts/monorepo/smoke/ (new), package.json (smoke:* script paths)
      Change: (LOW value, INFO — execute only if the owner keeps it in scope; otherwise mark deferred in the phase report.) Create `scripts/monorepo/smoke/` and move the 8 `smoke-*.mjs` files in, dropping the `smoke-` prefix: `smoke/install.mjs`, `smoke/fixtures.mjs`, `smoke/runner.mjs`, `smoke/shadcn-install.mjs`, `smoke/keys-absent.mjs`, `smoke/cli.mjs`, `smoke/modelsdev.mjs`, `smoke/shared.mjs`. Rewrite the cross-references between these scripts AND the four `smoke:*` script paths in `package.json:32-35`. (Note: a same-named `scripts/monorepo/artifacts/smoke-modelsdev.mjs` exists — R-006; that file is NOT in this set and is untouched here.)
      Accept: Either `scripts/monorepo/smoke/` holds the 8 prefix-free files and `package.json` smoke scripts resolve, OR the task is explicitly recorded as deferred; `DIFFGAZER_SMOKE_STRICT_SKIPS=1 pnpm run smoke` passes.

---

### Batch 1.O — cross-workspace app-provider tier (shared files across apps/web + cli/diffgazer + libs/keys)
files: apps/web/src/app/providers/{index.tsx,config-provider.tsx,theme-provider.tsx} (+ tests), apps/web/src/main.tsx, apps/web/src/components/layout/global-layout.tsx, apps/web/src/app/routes/__root.tsx, cli/diffgazer/src/app/providers/{keyboard-provider.tsx,server-provider.tsx} (+ tests), cli/diffgazer/src/app/{index.tsx,navigation-context.tsx}, cli/diffgazer/src/tui-entry.tsx, cli/diffgazer/src/theme/theme-context.tsx, cli/diffgazer/src/components/layout/global-layout.tsx, libs/keys/src/providers/keyboard-provider.tsx (+ test), libs/keys/src/index.ts.
This batch is isolated because F-127/F-136/F-169/F-214/F-125 all touch the SAME `app/providers/` and `components/layout/` files across three workspaces; keeping them in one batch guarantees each provider/layout file is renamed exactly once. **This batch is serial-internal** (T-173 → T-174 → T-175 → T-176 → T-177 in listed order): T-176 and T-177 reference `app/root.tsx` (T-174's rename of `app/index.tsx`), so T-174 must land first. Per the Phase-1 batch-serialization note, **this batch runs BEFORE Batches 1.F, 1.G, and 1.K**, which depend on its final paths.

- [ ] T-173 (fixes F-214) — files: apps/web/src/app/providers/{config-provider,theme-provider}.tsx (+ tests), cli/diffgazer/src/app/providers/{keyboard-provider,server-provider}.tsx (+ tests), libs/keys/src/providers/keyboard-provider.tsx (+ test), libs/keys/src/index.ts, and all importers
      Change: Folder-context rename dropping the `-provider` echo of the `providers/` technical-type folder, keeping `*Provider` PascalCase symbols: apps/web `app/providers/config-provider.tsx`→`config.tsx`, `theme-provider.tsx`→`theme.tsx`; cli/diffgazer `app/providers/keyboard-provider.tsx`→`keyboard.tsx`, `server-provider.tsx`→`server.tsx`; libs/keys `src/providers/keyboard-provider.tsx`→`keyboard.tsx`. Move the colocated `*-provider.test.tsx` files (→ `config.test.tsx`, etc.). Rewrite all importers and the `libs/keys/src/index.ts` re-export. (libs/keys is a public package — its `src/index.ts` is the only sanctioned barrel; the public export SYMBOLS are unchanged, so no `public/r`/exports-map edit is needed, but run keys artifact validation to confirm.)
      Accept: No `*-provider.tsx` basenames remain in any `providers/` folder; `config.tsx`/`theme.tsx`/`keyboard.tsx`/`server.tsx` exist at their paths; web + cli/diffgazer type-check, `pnpm --filter @diffgazer/keys type-check`, and `validate:artifacts:check` pass.

- [ ] T-174 (fixes F-127) — files: apps/web/src/app/providers/index.tsx, apps/web/src/main.tsx, cli/diffgazer/src/app/index.tsx, cli/diffgazer/src/tui-entry.tsx
      Change: Rename the two app-root orchestrator `index.tsx` files (they hold component logic, not barrels; D2 forbids logic-bearing index barrels in apps/cli): apps/web `app/providers/index.tsx`→`app/providers/app-providers.tsx` (exports `AppProviders`); cli/diffgazer `app/index.tsx`→`app/root.tsx` (exports the root `App`). Rewrite `main.tsx` (`./app/providers`→`./app/providers/app-providers`) and `tui-entry.tsx` (`./app/index`→`./app/root`). Neither is a package boundary, so no public-export change.
      Accept: `apps/web/src/app/providers/app-providers.tsx` and `cli/diffgazer/src/app/root.tsx` exist; no logic-bearing `index.tsx` at those two folders; web + cli/diffgazer type-check pass.

- [ ] T-175 (fixes F-136) — files: cli/diffgazer/src/app/navigation-context.tsx, all importers (useNavigation consumers + app composition)
      Change: Move the loose-at-app-root Context provider `cli/diffgazer/src/app/navigation-context.tsx`→`cli/diffgazer/src/app/providers/navigation-provider.tsx` (joins the established `app/providers/` home with `keyboard.tsx`/`server.tsx`). Keep `NavigationContext`/`NavigationProvider` symbols. Rewrite all importers. Phase-1 keeps the `-context`→`navigation-provider` filename as named in the finding; symbol unchanged. (Per the Phase-1 batch-serialization note, Batch 1.O runs BEFORE 1.F: this task moves the file to its final path FIRST; T-129 in 1.F then rewrites the `back-navigation` import line on the file at this final `app/providers/navigation-provider.tsx` path. Do NOT touch the `back-navigation` import here — leave that single line for T-129.)
      Accept: `cli/diffgazer/src/app/providers/navigation-provider.tsx` exists; no `app/navigation-context.tsx`; cli/diffgazer type-check passes.

- [ ] T-176 (fixes F-169, F-124) — files: cli/diffgazer/src/theme/theme-context.tsx, cli/diffgazer/src/app/providers/theme-provider.tsx (new), cli/diffgazer/src/app/index.tsx (now app/root.tsx post-T-174), cli/diffgazer/src/theme/{palettes,severity,severity-variant}.ts (kept), and ~60 importers of the theme context/provider
      Change: This supersedes T-126. Move the React Context PROVIDER + its consumer hook out of the top-level `src/theme/` data folder into the canonical providers tier: `cli/diffgazer/src/theme/theme-context.tsx`→`cli/diffgazer/src/app/providers/theme-provider.tsx` (mirroring apps/web `app/providers/theme.tsx` from T-173 — name it `theme.tsx` to match the de-suffixed siblings if T-173 ran, else `theme-provider.tsx`; pick the post-T-173 convention `theme.tsx`). Keep `CliThemeProvider`/`useTheme` symbols. Leave `palettes.ts`/`severity.ts`/`severity-variant.ts` as theme DATA in `src/theme/`. ts-morph rewrites the ~60 `../theme/theme-context` import specifiers to the new providers path. This single move resolves BOTH F-169 (provider misplacement) and F-124 (the `theme/theme-context` path-echo, since the file leaves `theme/` entirely).
      Accept: `cli/diffgazer/src/app/providers/theme.tsx` (or `theme-provider.tsx`) exists and exports `CliThemeProvider`; no `theme/theme-context.tsx`; `src/theme/` still holds the data modules; the three composed providers in `app/root.tsx` all import from `app/providers/`; cli/diffgazer type-check + theme tests pass. (T-126 is NOT executed when T-176 runs.)

- [ ] T-177 (fixes F-125) — files: apps/web/src/components/layout/global-layout.tsx, cli/diffgazer/src/components/layout/global-layout.tsx, apps/web/src/app/routes/__root.tsx, cli/diffgazer/src/app/root.tsx (post-T-174), apps/web/src/components/layout/index.ts (repoint)
      Change: Rename the path-echo `components/layout/global-layout.tsx`→`components/layout/global.tsx` in BOTH apps/web and cli/diffgazer (only this file repeats `layout`; `header.tsx`/`footer.tsx` already comply). Keep the `GlobalLayout` symbol. Rewrite cli/diffgazer's `app/root.tsx` import and repoint apps/web's `components/layout/index.ts` re-export line (barrel kept; Phase 3 dissolves it, after which `__root.tsx` points at `@/components/layout/global` directly).
      Accept: Both `components/layout/global.tsx` exist; no `global-layout.tsx` in either; web + cli/diffgazer type-check pass.

---

### Phase exit

All gates run from the repo root in this order (refactor-verification protocol, D7); the phase is complete only when every gate is green:

1. `DIFFGAZER_SKIP_ARTIFACT_PREPARE=1 pnpm exec turbo run type-check` — primary gate; project references turn any cross-package/boundary breakage from a move into a hard error. (Always.)
2. `pnpm run prepare:artifacts` then `pnpm run validate:artifacts:check` — REQUIRED for this phase: Batches 1.L (libs/ui registry source + public/r), 1.J/1.K (libs/core + libs/keys public `exports`/subpaths), and 1.M (libs/registry) touch the public registry/handoff surface; the gitignored `apps/docs/registry` + `apps/docs/styles` mirrors are regenerated, not hand-edited.
3. `DIFFGAZER_SKIP_ARTIFACT_PREPARE=1 pnpm exec turbo run test` — FULL suite, not `--affected` (refactor ripple under-counts). (Always.)
4. `DIFFGAZER_SMOKE_STRICT_SKIPS=1 pnpm run smoke` — REQUIRED: Batch 1.H renames the cli/server serve entry + restructures the review/SSE feature, Batch 1.I restructures the `dgadd` command surface, Batch 1.N renames a deploy nginx conf + (optionally) the smoke script paths; the smoke suite validates the bundled CLI/server + package/shadcn install paths. (Add `DIFFGAZER_SMOKE_ALLOW_NETWORK=1` to also exercise the live models.dev fetch, as CI does.)
5. `pnpm run verify:monorepo` — cross-package invariant/check baseline (subpath-export count, published `files`, etc.).
6. `git diff --check` and `git diff -M --stat` — confirm zero whitespace errors AND that the commit renders as renames (rename detection survived = pure moves with import-only edits, no logic deltas).

Hard rule for the executor: if any task's "Fix" in the source finding proposed a symbol rename, a multi-file split, an inlining, or a `generateDemoIndex`-keying change, that part is OUT OF SCOPE here (deferred to the split/DRY/logic phases) — Phase 1 ships ONLY the file move/rename + import/exports-map/registry-path repoint, and the tree must compile and test green between this phase and the next.


---

## Phase 2 — DRY extractions & architecture/boundary fixes

Sits at position 2 because it must stack on Phase 1's pure-move/rename commit (extractions land on already-relocated, correctly-named files)
and must run before Phase 3 barrel dissolution (new rule-of-two exports go through existing concrete modules/subpaths first, leaving the
barrel/import-path cleanup as a clean follow-on).

This phase stacks on top of Phase 1's pure-move/rename commit: every extraction below lands on an already-relocated, correctly-named file
(Phase 1 renamed e.g. `history-screen-utils.ts`, `summary-view-helpers.ts`, `review-routes.ts`, `schemas/config/capabilities.ts`,
`search-context.tsx`, `history/utils.tsx` and moved the registry build validators to `scripts/registry/`). It runs before Phase 3 (barrel
dissolution) so the rule-of-two homes (`libs/core`, `@diffgazer/registry`) gain their new exports through the existing public `exports` map
and concrete modules.

Scope: promote duplicated logic to its rule-of-two home and delete the reimplementations; fix unidirectional-slice violations
(shared→feature, feature→feature), the inline-in-route-file architecture defect, the shared-tier middleware→feature wrong-direction
edge, and the browser-imports-Node-figlet wrong-runtime boundary defect.

Path note for executors: paths below reflect the post-Phase-1 tree. A few files were renamed in Phase 1 by the grab-bag/path-echo rules
(F-033 renames the TUI `history-screen-utils.ts` and `summary-view-helpers.ts`; F-036 renames `cli/server` `review-routes.ts`; F-040
renames `libs/registry/src/docs-data/utils.ts`; F-027 renames web `history/utils.tsx`). Where a task cites the pre-rename basename, the
finding-defined concept (exported symbol) is the load-bearing anchor — locate the file by the directory + concept if Phase 1 changed the
basename. No task here renames a file; all changes are logic/import edits.

Batches A–E touch disjoint file sets and are parallel-safe. Within a batch, tasks run in listed order (later tasks may consume an export
a prior task added). Batch 2.E is intentionally one sequential batch: the history/review/severity/pluralization extractions share core,
web, TUI, and `cli/server` files (notably `libs/core/src/review/history.ts`, the web/TUI history hooks, `review-summary-view.tsx`, and
`cli/server/src/features/review/summary.ts`), so they cannot be safely parallelized against each other.

---

### Batch 2.A — files: libs/ui/tsup.config.ts, libs/ui/scripts/build-declarations.ts, libs/ui/shared/registry-types.ts (or its Phase-1 scripts/registry location), libs/ui/src/validation/registry-validation-fs.ts, libs/keys/scripts/transform-public-registry-imports.ts, libs/keys/scripts/validate-registry-closure.ts, libs/keys/scripts/verify-dist-esm-imports.ts, libs/keys/scripts/verify-rsc-directives.ts, libs/keys/src/registry-handoff.test.ts, libs/keys/package.json, libs/ui/package.json, libs/core/scripts/verify-dist-esm-imports.ts, libs/core/package.json, libs/registry/src/cli/fs.ts, libs/registry/src/utils/fs.ts, libs/registry/src/docs-data/utils.ts

Build-tooling and registry-helper DRY. These are build/script/test files (no app or library runtime source), disjoint from every other
batch. Tasks 201–203 add new exports to `@diffgazer/registry`; this is registry/public-handoff-adjacent build tooling, so the phase-exit
artifact gates apply.

- [ ] T-201 (fixes F-011) — files: libs/ui/tsup.config.ts, libs/ui/scripts/build-declarations.ts, libs/registry/src/cli/ (new module), libs/registry/src/index.ts (or ./cli subpath)
      Change: Add a single exported helper module to `@diffgazer/registry` (e.g. `libs/registry/src/cli/dist-keys.ts`) exporting
      `registryItemToDistKey(item)` (the byte-identical body currently duplicated at `libs/ui/tsup.config.ts:24-28` and
      `libs/ui/scripts/build-declarations.ts:44-48`) and `resolveKeysHookFiles(items)` (the `extractDiffgazerKeysHookNames` + `use-` prefix
      Set derivation duplicated at `tsup.config.ts:34` / `build-declarations.ts:40-42`). Export both from the registry's existing CLI
      surface (`./cli` subpath or the public `src/index.ts`, matching how `assertNoRelativeJsImports` is already surfaced). Import both into
      `tsup.config.ts` and `build-declarations.ts`; delete both local copies and the `Mirror tsup's keys-hook detection` comment.
      Accept: `registryItemToDistKey` and the keys-hook Set derivation appear exactly once (in `@diffgazer/registry`); `tsup.config.ts` and
      `build-declarations.ts` import them; `pnpm --filter @diffgazer/ui type-check` passes; `pnpm --filter @diffgazer/ui build` produces the
      same dist key set as before (the "mirror" comment is gone and no second copy remains in either file).

- [ ] T-202 (fixes F-175) — files: libs/registry/src/cli/ (new module), libs/registry/src/index.ts (or ./cli subpath), libs/core/scripts/verify-dist-esm-imports.ts, libs/keys/scripts/verify-dist-esm-imports.ts, libs/core/package.json, libs/keys/package.json
      Change: Extract one `assertDistEsmRelativeImports({ distDir, packageLabel, skipDirs })` into `@diffgazer/registry`
      (e.g. `libs/registry/src/cli/verify-dist-esm.ts`), carrying the shared `RELATIVE_IMPORT` regex, the `collectFiles` walker, the offender
      match loop, and the throw currently duplicated near-verbatim across `libs/core/scripts/verify-dist-esm-imports.ts:11-47` and
      `libs/keys/scripts/verify-dist-esm-imports.ts:11-50`. Export it from the registry CLI surface. Replace both package scripts with a small
      caller that passes its dist dir + label, and for keys passes `skipDirs: ['artifacts']` (the keys-only `dist/artifacts` skip at
      `verify-dist-esm-imports.ts:19-21`). Leave each `package.json` build/`verify:dist-esm` script wiring pointing at the (now 5-line) script.
      Accept: the regex + walker + throw exist once in `@diffgazer/registry`; both `verify-dist-esm-imports.ts` scripts are thin callers;
      `pnpm --filter @diffgazer/core build` and `pnpm --filter @diffgazer/keys build` still run the dist-ESM guard and pass (keys still skips
      `dist/artifacts`).

- [ ] T-203 (fixes F-216) — files: libs/keys/scripts/verify-rsc-directives.ts, libs/registry/src/cli/ (new module), libs/registry/src/index.ts (or ./cli subpath), libs/ui/package.json, libs/keys/package.json
      Change: Add a shared `assertRscClientDirectives({ rootDir, registryPath })` to `@diffgazer/registry` (CLI surface) that derives the set
      of client-output files from registry metadata (`item.meta?.client`, the same source of truth `libs/ui/tsup.config.ts:155-170` already
      uses) instead of a hand-maintained allowlist. Rewrite `libs/keys/scripts/verify-rsc-directives.ts` to call it, deleting the hardcoded
      11-path `clientOutputs` array (`verify-rsc-directives.ts:6-18`). Add a `verify:rsc` post-build step to `libs/ui/package.json`'s build
      pipeline invoking the same shared check so the larger client surface is also verified. Keep `libs/keys/package.json`'s existing
      `verify:rsc` wiring pointed at the rewritten script.
      Accept: no hardcoded `clientOutputs` allowlist remains in `libs/keys/scripts/verify-rsc-directives.ts`; both `libs/ui` and `libs/keys`
      `build` scripts run the registry-metadata-driven RSC directive check via the single `@diffgazer/registry` helper; adding a client hook
      to keys' registry metadata is covered without editing the script; `pnpm --filter @diffgazer/keys build` and `pnpm --filter @diffgazer/ui build` pass.

- [ ] T-204 (fixes F-082) — files: libs/keys/scripts/transform-public-registry-imports.ts, libs/keys/scripts/validate-registry-closure.ts, libs/keys/scripts/verify-dist-esm-imports.ts, libs/keys/src/registry-handoff.test.ts
      Change: Define and export `RELATIVE_JS_IMPORT` (and the extensionless `RELATIVE_IMPORT` variant) exactly once from
      `libs/keys/scripts/transform-public-registry-imports.ts` (currently the regex is copy-pasted verbatim there and in
      `validate-registry-closure.ts:5` and `registry-handoff.test.ts:21`, with a 4th near-identical extensionless variant duplicated). Import
      the constant(s) into `validate-registry-closure.ts` and `verify-dist-esm-imports.ts`, and have `registry-handoff.test.ts` import it
      rather than redeclaring. Note: if T-202 already replaced the keys `verify-dist-esm-imports.ts` body with a thin caller, apply the
      shared-regex import only to whatever still declares the regex locally (the transform/closure scripts + the handoff test).
      Accept: the `RELATIVE_JS_IMPORT` / extensionless regex literal is declared once in keys' `scripts/`; `validate-registry-closure.ts` and
      `registry-handoff.test.ts` import it; `pnpm --filter @diffgazer/keys test` passes; `validate:artifacts:check` still passes.

- [ ] T-205 (fixes F-083) — files: libs/ui/shared/registry-types.ts (post-Phase-1 location, likely scripts/registry/types.ts per F-010 move), libs/ui/src/validation/registry-validation-fs.ts, libs/ui/scripts/build-declarations.ts, libs/ui/tsup.config.ts
      Change: Unify the two divergent `RegistryItem`/`RegistryFile` declarations (`libs/ui/shared/registry-types.ts:1-18` consumed by
      `tsup.config.ts` + `build-declarations.ts`, and the wider one in `libs/ui/src/validation/registry-validation-fs.ts:4-19` consumed by the
      validators) into one superset shape. Place it at the consolidated build-tooling home Phase 1 created (per F-010 the validators moved to
      `scripts/registry/`; put the shared types at `libs/ui/scripts/registry/types.ts`). Have `registry-validation-fs.ts`, `build-declarations.ts`,
      and `tsup.config.ts` import from it; delete the duplicate interfaces in `shared/registry-types.ts`. Do not keep two parallel `RegistryItem`
      shapes.
      Accept: one `RegistryItem`/`RegistryFile` declaration remains; both the build (`tsup`/`build-declarations`) and validation paths import it;
      `pnpm --filter @diffgazer/ui type-check` passes; `pnpm --filter @diffgazer/ui build` and `validate:artifacts:check` pass.

- [ ] T-206 (fixes F-081) — files: libs/registry/src/utils/fs.ts, libs/registry/src/docs-data/utils.ts (post-Phase-1 name), libs/registry/src/cli/fs.ts
      Change: Add one canonical predicate `isWithinDir(target, base): boolean` (the plain relative-prefix containment check) to
      `libs/registry/src/utils/fs.ts`. Have `libs/registry/src/docs-data/utils.ts` `assertPathInsideRoot` (`:14-21`) and the plain check in
      `utils/fs.ts:20-39` call it. Keep `libs/registry/src/cli/fs.ts:51-115` layering its realpath/symlink hardening ON TOP of `isWithinDir`
      rather than re-implementing the relative-prefix check inline, so the three sites share the same core containment logic and the
      docs-data/utils paths no longer diverge.
      Accept: the relative-prefix containment check exists once (`isWithinDir` in `utils/fs.ts`); `docs-data/utils.ts` and `cli/fs.ts` both call
      it; `cli/fs.ts` retains its symlink/realpath hardening as a wrapper; `pnpm --filter @diffgazer/registry test` passes (including any
      path-containment tests).

---

### Batch 2.B — files: cli/server/src/shared/middlewares/setup-guard.ts, cli/server/src/shared/lib/config/ (new setup-status.ts), cli/server/src/features/config/service.ts, cli/server/src/features/review/diff.ts, cli/server/src/shared/lib/diff/ (new total-stats.ts or parser.ts), cli/server/src/shared/lib/diff/parser.ts, cli/server/src/shared/lib/diff/types.ts, cli/server/src/app.ts, cli/server/src/shared/lib/http/request.ts, cli/server/src/shared/lib/log.ts, cli/server/src/shared/lib/paths.ts (or new env.ts)

`cli/server` architecture + DRY fixes that do NOT touch `features/review/summary.ts` or `shared/lib/review/analysis.ts` (those are owned by
Batch 2.E because F-177/F-179 share them). This batch is disjoint from 2.E. Smoke applies at phase exit because these are CLI/server-runtime files.

- [ ] T-211 (fixes F-012) — files: cli/server/src/shared/lib/config/setup-status.ts (new), cli/server/src/shared/middlewares/setup-guard.ts, cli/server/src/features/config/service.ts
      Change: Move `getSetupStatus` and its private `isKeyReadable` helper out of `cli/server/src/features/config/service.ts:43-...` into a new
      shared-tier module `cli/server/src/shared/lib/config/setup-status.ts` (it only reads `getStore()` from `shared/lib/config/store.js`, so it
      belongs in shared). Update `cli/server/src/shared/middlewares/setup-guard.ts:3` to import `getSetupStatus` from `../lib/config/setup-status.js`
      (shared→shared, matching how the sibling `trust-guard.ts:3` already imports `getStore` from `../lib/config/store.js`). Have
      `features/config/service.ts` import `getSetupStatus` from the shared module too (or re-export it if other config-feature code needs it),
      keeping `SetupStatus`/`SetupField` types sourced from `@diffgazer/core/schemas/config` as today. Net: the `shared/middlewares → features/config`
      edge is removed; both middleware and feature depend downward on shared.
      Accept: `setup-guard.ts` no longer imports from `../../features/config/service.js`; `getSetupStatus`/`isKeyReadable` live under
      `shared/lib/config/`; no `cli/server/src/shared/**` file imports from `cli/server/src/features/**`; `pnpm --filter @diffgazer/server test`
      and `type-check` pass.

- [ ] T-212 (fixes F-080) — files: cli/server/src/shared/lib/diff/total-stats.ts (new), cli/server/src/shared/lib/diff/parser.ts, cli/server/src/features/review/diff.ts, cli/server/src/shared/lib/diff/types.ts
      Change: Add `computeTotalStats(files: FileDiff[]): ParsedDiff['totalStats']` to `cli/server/src/shared/lib/diff/` (a new `total-stats.ts`
      next to `parser.ts`, or inline in `parser.ts` and export it). Replace the three byte-identical `files.reduce(...)` blocks producing
      `{ filesChanged, additions, deletions, totalSizeBytes }` at `parser.ts:176-184`, `features/review/diff.ts:38-46`, and
      `features/review/diff.ts:85-93` with calls to it. `FileDiff`/`ParsedDiff['totalStats']` types come from `shared/lib/diff/types.ts:27-35`.
      Accept: the total-stats reduce exists once; all three former sites call `computeTotalStats`; `pnpm --filter @diffgazer/server test`
      (including diff parser tests) passes.

- [ ] T-213 (fixes F-246) — files: cli/server/src/shared/lib/paths.ts (or new cli/server/src/shared/lib/env.ts), cli/server/src/app.ts, cli/server/src/shared/lib/http/request.ts, cli/server/src/shared/lib/log.ts
      Change: Add one `export const isPackaged = (): boolean => process.env.DIFFGAZER_PACKAGED === "1";` to a shared boundary module — prefer
      the existing `cli/server/src/shared/lib/paths.ts` (already owns env-derived path/mode helpers); otherwise a small `shared/lib/env.ts`.
      Replace the three private re-declarations at `app.ts:17-18`, `shared/lib/http/request.ts:4`, and `shared/lib/log.ts:17` (the
      `packagedDefault` const) with imports of the shared `isPackaged`.
      Accept: `process.env.DIFFGAZER_PACKAGED === "1"` is evaluated through one shared `isPackaged` helper; `app.ts`, `http/request.ts`, and
      `log.ts` import it; no other private `isPackaged`/`packagedDefault` copies remain; `pnpm --filter @diffgazer/server test` passes and the
      smoke suite still gates packaged-mode behavior.

---

### Batch 2.C — files: apps/docs/src/components/docs-mdx/feature-mdx-components.tsx, apps/docs/src/components/docs-mdx/index.ts, apps/docs/src/mdx-components.tsx, apps/docs/src/features/theme/components/color-grid.tsx, apps/docs/src/features/theme/components/theme-playground.tsx, apps/docs/src/features/theme/components/variable-diagram.tsx, apps/docs/src/features/theme/tui-primitives.ts (new), apps/docs/src/features/search/search-context.tsx (Phase-1 name), apps/docs/src/lib/ (or src/app/) search-context home, apps/docs/src/features/home/components/search-hero.tsx, apps/docs/src/layouts/header.tsx, apps/docs/src/routes/__root.tsx, apps/docs/src/features/search/components/search-dialog.tsx, apps/docs/src/components/breadcrumbs.tsx, apps/docs/src/components/breadcrumbs.test.ts, apps/docs related tests

All `apps/docs` DRY + boundary fixes. Self-contained to `apps/docs`. F-078 and F-256 both touch `color-grid.tsx`, so this batch is sequential
internally and cannot be split into parallel sub-batches. This batch does NOT touch the 642-file `apps/docs/registry/` mirror (that removal is
Phase 5, D5) and does NOT dissolve the `docs-mdx/index.ts` barrel (that is F-014, Phase 3) — keep the barrel intact here.

- [ ] T-221 (fixes F-256) — files: apps/docs/src/components/docs-mdx/feature-mdx-components.tsx, apps/docs/src/mdx-components.tsx, apps/docs/src/components/docs-mdx/index.ts
      Change: Stop the app-shared `components/docs-mdx/` tier from importing feature components. Relocate the four `features/theme/components`
      imports + their map entries (`ColorGrid`, `DiffgazerPreview`, `ThemePlayground`, `VariableDiagram` at `feature-mdx-components.tsx:3-6` and
      their entries at `:25-28`) into the app-shell composition point `apps/docs/src/mdx-components.tsx` — i.e. import those theme components in
      `mdx-components.tsx` and merge them into the final `mdxComponents` map there, alongside `...markdownMdxComponents` and the
      now-generic-only `...featureMdxComponents`. Keep only generic block components (`Example`, `PropsTable`, `HookSource`, etc.) and the
      `DocDataProvider` exports in the shared `docs-mdx` module. Leave `docs-mdx/index.ts` re-exporting whatever still lives in the shared module
      (do not delete the barrel — F-014 handles that in Phase 3).
      Accept: no file under `apps/docs/src/components/` imports from `apps/docs/src/features/`; the theme feature components are wired into the
      MDX map at `mdx-components.tsx` (app-shell tier); `pnpm --filter @diffgazer/docs type-check` passes and the docs MDX still renders the
      `ThemePlayground`/`VariableDiagram`/`ColorGrid`/`DiffgazerPreview` blocks (docs build/tests pass).

- [ ] T-222 (fixes F-078) — files: apps/docs/src/features/theme/tui-primitives.ts (new), apps/docs/src/features/theme/components/color-grid.tsx, apps/docs/src/features/theme/components/theme-playground.tsx, apps/docs/src/features/theme/components/variable-diagram.tsx
      Change: Create one canonical data module `apps/docs/src/features/theme/tui-primitives.ts` exporting the TUI primitive palette as
      `{ name, darkValue, lightValue?, semantics? }[]` (use `variable-diagram.tsx` `VARIABLE_MAP` `:9-106` as the superset source of the hex
      values). Derive `color-grid.tsx` `PRIMITIVES` (`:10-37`) swatches and `theme-playground.tsx` `DEFAULT_PRIMITIVES` (`:8-23`) from it, and
      have `variable-diagram.tsx` consume the same module, so each dark hex value lives in exactly one place.
      Accept: the primitive palette + dark hex values are declared once (in `tui-primitives.ts`); all three theme components import from it; no
      hardcoded duplicate primitive list remains in `color-grid.tsx`/`theme-playground.tsx`/`variable-diagram.tsx`; `pnpm --filter @diffgazer/docs type-check` passes and theme docs render unchanged.

- [ ] T-223 (fixes F-241) — files: apps/docs/src/lib/search-context.tsx (or apps/docs/src/app/search-context.tsx — new shared home), apps/docs/src/features/search/search-context.tsx, apps/docs/src/features/home/components/search-hero.tsx, apps/docs/src/layouts/header.tsx, apps/docs/src/routes/__root.tsx, apps/docs/src/features/search/components/search-dialog.tsx, apps/docs/src/features/home/components/home-view.test.tsx, apps/docs/src/features/search/search-context.test.tsx
      Change: Promote the search open/close context out of the feature slice. `SearchProvider`/`useSearchOpen` is app-shell state (mounted at
      `routes/__root.tsx:79`, consumed by the non-feature `layouts/header.tsx`), so move it from `features/search/search-context.tsx` to an
      app-shared tier — `apps/docs/src/lib/search-context.tsx` (docs has no `src/app/` or `src/hooks/`; `src/lib/` exists). Update all importers
      to the shared path: `routes/__root.tsx`, `layouts/header.tsx`, `features/home/components/search-hero.tsx` (`:1`, removing the home→search
      feature→feature edge), `features/search/components/search-dialog.tsx`, and the two colocated tests
      (`features/home/components/home-view.test.tsx`, the moved `search-context.test.tsx` — relocate it next to the new location).
      Accept: `features/home` no longer imports from `features/search`; `useSearchOpen`/`SearchProvider` live in the shared `src/lib/` tier; all
      five consumers + tests import from the shared location; `pnpm --filter @diffgazer/docs type-check` and `pnpm --filter @diffgazer/docs test`
      pass.

- [ ] T-224 (fixes F-242) — files: apps/docs/src/components/breadcrumbs.tsx, apps/docs/src/components/breadcrumbs.test.ts, apps/docs docs-tree/page-tree source (apps/docs/src/lib/docs-tree.ts or the prepare:generated step)
      Change: Eliminate the hand-maintained 18-entry `SECTIONS_WITH_INDEX` Set (`breadcrumbs.tsx:11-30`) by deriving the "sections that have an
      index.mdx" set from the same `source.config`/page-tree data that already drives `docs-tree.ts` (which knows which sections have index
      pages), or by emitting it during the `prepare:generated` step — the same single source of truth, not a hardcoded list guarded by a test.
      Update `breadcrumbs.tsx` to consume the derived data. Then the filesystem-walking `breadcrumbs.test.ts` (`sectionsWithIndexOnDisk()` +
      equality assertion at `:15-42`) is no longer guarding a duplicated constant: convert it to a content-validation check or remove it as a
      component unit test (per the finding, the test's derivation WAS the non-duplicated implementation).
      Accept: no hardcoded `SECTIONS_WITH_INDEX` Set remains in `breadcrumbs.tsx`; the section-with-index data is derived from the page-tree /
      generated source; `pnpm --filter @diffgazer/docs type-check` and `pnpm --filter @diffgazer/docs test` pass; breadcrumbs render the same
      index/non-index distinction as before.

---

### Batch 2.D — files: apps/web/src/app/routes/help.tsx, apps/web/src/features/help/components/page.tsx (new), apps/web/src/features/home/components/page.tsx, apps/web/src/features/history/hooks/use-review-history.ts, apps/web/src/hooks/use-review-history.ts (new shared location), apps/web/src/components/layout/header.tsx, apps/web/package.json, apps/web/src/components/ui/severity/constants.ts, apps/web/src/features/review/components/severity-filter-group.tsx, apps/web/src/features/review/components/issue-preview-item.tsx, cli/diffgazer/src/lib/highlight-navigation.ts, cli/diffgazer/src/components/ui/radio.tsx

`apps/web` architecture/boundary fixes plus the figlet wrong-runtime boundary defect, the web-local severity-label dedup, and the TUI
single-caller wrapper deletion. These files are disjoint from the history/review/settings/providers extraction cluster in Batch 2.E and from all
other batches; `libs/core/package.json` is NOT edited here (T-202 in Batch 2.A owns the only `libs/core`/`libs/keys` manifest edits), and
`libs/core/src/get-figlet.ts` + `cli/diffgazer/src/banner.ts` are referenced as scoping targets but left unchanged. Web-adoption and CLI files
are touched, so the web focused tests + smoke apply at phase exit.

- [ ] T-231 (fixes F-054) — files: apps/web/src/features/help/components/page.tsx (new), apps/web/src/app/routes/help.tsx
      Change: Move the full `HelpPage` component (the `SHORTCUTS` data, `useScope`/`useKey` wiring, JSX, and `Panel` layout currently inline at
      `apps/web/src/app/routes/help.tsx:21-65`) into a new feature module `apps/web/src/features/help/components/page.tsx`, matching the
      thin-route-shim pattern every other apps/web route uses (cf. `home.tsx`/`review.tsx` `:1-3`). Reduce `app/routes/help.tsx` to a 3-line
      re-export shim into the feature page. Leave the `router.tsx` lazy import unchanged (it resolves through the shim).
      Accept: `app/routes/help.tsx` contains no component logic (only a re-export shim); `HelpPage` lives under `features/help/components/page.tsx`;
      `pnpm --filter @diffgazer/web type-check` and focused web tests pass; the Help route renders identically.

- [ ] T-232 (fixes F-055) — files: apps/web/src/hooks/use-review-history.ts (new shared location), apps/web/src/features/history/hooks/use-review-history.ts, apps/web/src/features/home/components/page.tsx, apps/web/src/features/history (history consumers of the hook)
      Change: Remove the feature→feature import (`features/home/components/page.tsx:8` imports `useReviewHistory` from `@/features/history/hooks/use-review-history`).
      `useReviewHistory` is a thin wrapper over `@diffgazer/core/api/hooks` now consumed by two features (history + home) — promote it to the
      app-shared tier: move `apps/web/src/features/history/hooks/use-review-history.ts` to `apps/web/src/hooks/use-review-history.ts` and update
      both the history feature consumers and `features/home/components/page.tsx` to import from `@/hooks/use-review-history`.
      Accept: no `apps/web` feature imports from another feature (`features/home` no longer reaches into `features/history`); `useReviewHistory`
      lives in `apps/web/src/hooks/`; `pnpm --filter @diffgazer/web type-check` and focused web tests pass.

- [ ] T-233 (fixes F-215) — files: apps/web/src/components/layout/header.tsx, apps/web/package.json, libs/core/src/get-figlet.ts (referenced, unchanged — stays Node/CLI-only), cli/diffgazer/src/banner.ts (referenced, unchanged — legitimate Node consumer)
      Change: Stop importing the Node-only eager figlet renderer from the browser. In `apps/web/src/components/layout/header.tsx`, remove the
      `import { getFigletText } from "@diffgazer/core/get-figlet"` (`:2`) and the module-init call `const WORDMARK_ASCII = getFigletText(WORDMARK_TEXT)`
      (`:45`). Replace it with a precomputed static ASCII constant passed to `Logo`'s `asciiText` prop, per `PACKAGE_GOVERNANCE.md:176` ("The
      default @diffgazer/ui/components/logo entry must not import figlet; it accepts precomputed asciiText instead") — the wordmark text is fixed
      ("diffgazer"), so a constant is deterministic and keeps figlet+Big.js out of the browser bundle. (Alternative if a runtime-computed wordmark
      is required: switch to the async optional-peer path `@diffgazer/ui/components/logo/figlet`, await it in an effect, AND declare `figlet`
      `^1.10.0` as an `apps/web` dependency — but the static constant is preferred and avoids the undeclared dependency entirely.) Scope
      `@diffgazer/core/get-figlet` to Node/CLI consumers only; `cli/diffgazer/src/banner.ts` remains its legitimate consumer (leave unchanged).
      Accept: `apps/web/src/components/layout/header.tsx` does not import `@diffgazer/core/get-figlet`; the apps/web build no longer bundles
      `figlet`/`Big.js` (no transitive figlet pull-in); `apps/web/package.json` carries no undeclared/phantom figlet edge; the header wordmark
      renders unchanged; `pnpm --filter @diffgazer/web type-check`, focused web tests, and smoke pass; `cli/diffgazer` banner still works.

- [ ] T-234 (fixes F-077) — files: apps/web/src/components/ui/severity/constants.ts, apps/web/src/features/review/components/severity-filter-group.tsx, apps/web/src/features/review/components/issue-preview-item.tsx
      Change: Drop the `label` field from `SeverityConfig`/`SEVERITY_CONFIG` in `apps/web/src/components/ui/severity/constants.ts:10-16` (it is
      byte-identical to `libs/core` `SEVERITY_LABELS`; the icon/color fields are web-only and stay). Change the two readers
      (`severity-filter-group.tsx:79`, `issue-preview-item.tsx:80`) to import `SEVERITY_LABELS` from `@diffgazer/core/schemas/presentation` and
      index it by severity, matching how `severity-breakdown.tsx` already consumes it.
      Accept: `SEVERITY_CONFIG` no longer carries a `label` field; both readers source labels from core `SEVERITY_LABELS`; the severity label
      text rendered in the filter group and issue preview is unchanged; `pnpm --filter @diffgazer/web type-check` and focused web tests pass.

- [ ] T-235 (fixes F-079) — files: cli/diffgazer/src/lib/highlight-navigation.ts, cli/diffgazer/src/components/ui/radio.tsx
      Change: Delete the single-caller pass-through wrapper `stepIndex(currentIndex, direction, length, wrap)` from
      `cli/diffgazer/src/lib/highlight-navigation.ts:48-59` (it only `return clampIndex(...)` with the identical signature and adds nothing; its
      JSDoc claim of being "used by list primitives" is false — `radio.tsx` is its sole caller). In `cli/diffgazer/src/components/ui/radio.tsx`,
      replace the import (`:7`, `import { stepIndex } from "../../lib/highlight-navigation"`) with `import { clampIndex } from "@diffgazer/keys"`
      and change the call site (`:134`, inside `moveBy`) from `stepIndex(highlightIndex, direction, selectableItems.length, wrap)` to
      `clampIndex(highlightIndex, direction, selectableItems.length, wrap)`.
      Accept: `stepIndex` no longer exists in `highlight-navigation.ts`; `radio.tsx` calls `clampIndex` from `@diffgazer/keys` directly; radio
      keyboard navigation behavior is unchanged; `pnpm --filter @diffgazer/diffgazer type-check` and TUI focused tests pass.

---

### Batch 2.E — files (shared-core extractions + their web/TUI/server consumers): libs/core/src/review/history.ts, libs/core/src/review/build-summary.ts, libs/core/src/review/display.ts, libs/core/src/review/event-to-log.ts, libs/core/src/review/index.ts, libs/core/src/strings.ts, libs/core/src/format.ts, libs/core/src/onboarding/use-wizard-state.ts, libs/core/src/onboarding/index.ts, libs/core/src/providers/use-model-filter.ts (new), libs/core/src/providers/index.ts, libs/core/src/forms/derive-save-state.ts (new), libs/core/src/forms/index.ts, libs/core/src/schemas/presentation/shortcuts.ts, libs/core/src/schemas/presentation/severity.ts, libs/core/src/schemas/presentation/index.ts, apps/web/src/features/history/hooks/use-history-page.ts, apps/web/src/features/history/utils.tsx (Phase-1 name), apps/web/src/features/review/components/review-summary-view.tsx, apps/web/src/features/review/components/review-progress-view.tsx, apps/web/src/features/onboarding/hooks/use-onboarding.ts, apps/web/src/features/onboarding/hooks/onboarding-reducer.ts (+ its test), apps/web/src/features/providers/hooks/use-model-filter.ts, apps/web/src/features/settings/components/storage/page.tsx, apps/web/src/features/settings/components/agent-execution/page.tsx, apps/web/src/features/settings/components/theme/page.tsx, apps/web/src/config/navigation.ts, cli/diffgazer/src/features/history/hooks/use-history-screen.ts, cli/diffgazer/src/features/history/hooks/history-screen-utils.ts (Phase-1 name), cli/diffgazer/src/features/review/components/review-summary-view.tsx, cli/diffgazer/src/features/review/components/review-progress-view.tsx, cli/diffgazer/src/features/review/components/context-snapshot-preview.tsx, cli/diffgazer/src/features/review/components/summary-view-helpers.ts (Phase-1 name), cli/diffgazer/src/features/providers/components/model-select-overlay.tsx, cli/diffgazer/src/features/settings/storage/derive-save-state.ts, cli/diffgazer/src/features/settings/lens-selection.ts, cli/diffgazer/src/config/navigation.ts, cli/server/src/shared/lib/review/analysis.ts, cli/server/src/features/review/summary.ts

ONE sequential batch. These extractions promote duplicated review/history/severity/pluralization/onboarding/save-state/model-filter logic into
`libs/core` (and consume already-existing shared helpers), then delete the web/TUI/server reimplementations. They are grouped together because
they repeatedly share the same files — `libs/core/src/review/history.ts` (F-084, F-177, F-178), the web/TUI history hooks (F-084, F-178, F-188),
`review-summary-view.tsx` web+TUI (F-085, F-177, F-188), `libs/core/src/strings.ts` (F-085, F-177), and `cli/server/src/features/review/summary.ts`
(F-177, F-179) — so they cannot run in parallel. Run tasks in the listed order; core-side exports (T-241..T-246) precede the consumer rewrites
they enable. Web, TUI, and CLI/server runtime are all touched: focused web/keys/server tests + smoke apply at phase exit.

All new `libs/core` exports in this batch route through ALREADY-EXISTING public subpaths and their `index.ts` barrels (`./review`,
`./forms`, `./providers`, `./schemas/presentation`, `./format`, `./onboarding` all exist today in `libs/core/package.json`), so NO task here
edits `libs/core/package.json` — that manifest is owned solely by Batch 2.A's T-202 (the `@diffgazer/registry` dep edge), keeping the two
batches disjoint.

- [ ] T-241 (fixes F-177) — files: libs/core/src/strings.ts, libs/core/src/review/event-to-log.ts, libs/core/src/review/display.ts, libs/core/src/review/history.ts, cli/server/src/shared/lib/review/analysis.ts, cli/server/src/features/review/summary.ts, apps/web/src/features/history/utils.tsx, apps/web/src/features/review/components/review-progress-view.tsx, cli/diffgazer/src/features/review/components/review-summary-view.tsx, cli/diffgazer/src/features/review/components/review-progress-view.tsx, cli/diffgazer/src/features/review/components/context-snapshot-preview.tsx
      Change: Export `pluralize(count, word)` from `libs/core/src/strings.ts` (move the file-private body from `event-to-log.ts:11-12`:
      `${count} ${word}${count === 1 ? "" : "s"}`), delete the private copy and import it in `event-to-log.ts`. Replace the 12 remaining inline
      `${n} ${word}${n === 1 ? "" : "s"}` / `!== 1 ? "s" : ""` sites with `pluralize(n, "issue"|"file"|"agent"|"blocker")`:
      `cli/server/src/shared/lib/review/analysis.ts:138,224`; `cli/server/src/features/review/summary.ts:34` (issue + file); `apps/web/src/features/history/utils.tsx:23`;
      `apps/web/src/features/review/components/review-progress-view.tsx:243`; `cli/diffgazer/src/features/review/components/review-summary-view.tsx:93,97,106`;
      `cli/diffgazer/src/features/review/components/review-progress-view.tsx:158`; `cli/diffgazer/src/features/review/components/context-snapshot-preview.tsx:30`;
      `libs/core/src/review/display.ts:28`; `libs/core/src/review/history.ts:72`. Do NOT touch the `libs/ui` instance
      (`command-palette-content.tsx:27`) — registry copy-quarantine boundary.
      Accept: `pluralize` is exported once from `@diffgazer/core` strings; `rg '=== 1 \? "" : "s"|!== 1 \? "s" : ""'` returns only the
      `libs/ui` registry instance; all 13 former sites (helper + 12 callers) use the shared `pluralize`; `pnpm --filter @diffgazer/core test`,
      web/server focused tests pass.

- [ ] T-242 (fixes F-179) — files: cli/server/src/features/review/summary.ts, libs/core/src/schemas/presentation/severity.ts
      Change: In `cli/server/src/features/review/summary.ts`, replace the inline severity-count init+loop (`:12-21`, the manual
      `{ blocker:0, high:0, medium:0, low:0, nit:0 }` + `for (issue) counts[issue.severity]++`) with
      `const severityCounts = calculateSeverityCounts(issues);` imported from `@diffgazer/core/schemas/presentation` — matching the existing usage
      in `cli/server/src/shared/lib/storage/reviews.ts:98,125`. (Run after T-241 so the same file's pluralize edits are already applied.)
      Accept: `summary.ts` no longer hand-rolls the severity-count loop; it calls the shared `calculateSeverityCounts`; executive-summary output
      is unchanged; `pnpm --filter @diffgazer/server test` passes.

- [ ] T-243 (fixes F-084, F-178) — files: libs/core/src/review/history.ts, libs/core/src/review/index.ts, apps/web/src/features/history/hooks/use-history-page.ts, cli/diffgazer/src/features/history/hooks/use-history-screen.ts, cli/diffgazer/src/features/history/hooks/history-screen-utils.ts (Phase-1 name)
      Change: In `libs/core/src/review/history.ts` add (a) `metadataToSeverityCounts(metadata: ReviewMetadata | null): SeverityCounts | null`
      (the field-rename projection duplicated as TUI `buildHistorySeverityCounts` at `history-screen-utils.ts:41-50` and the web inline
      `severityCounts` const at `use-history-page.ts:44-52`); and (b) `filterReviewsForHistory(reviews, selectedDateId, searchQuery)` capturing the
      byte-identical date-section + trimmed-query + `matchesHistoryQuery` filter block (`use-history-page.ts:82-87`, `use-history-screen.ts:71-77`).
      Export both via `libs/core/src/review/index.ts` (the `@diffgazer/core/review` subpath). Replace both local SeverityCounts projections with
      `metadataToSeverityCounts(...)`; replace both inline filter blocks with `filterReviewsForHistory(...)`; and replace the run→`{id,displayId,branch,timestamp,summary}`
      mapping (web inline `use-history-page.ts:89-97`; TUI `mapHistoryRun` in `history-screen-utils.ts:31-39`) by consuming the already-exported
      but unused `buildReviewListItem` from `libs/core/src/review/history.ts:77` (or a trimmed `buildHistoryRunSummary` returning that subset),
      deleting the TUI `mapHistoryRun` and the web inline mapping.
      Accept: `metadataToSeverityCounts` + `filterReviewsForHistory` exist in `libs/core/src/review/history.ts` and are exported via `./review`;
      both history hooks call them; `buildReviewListItem` has real consumers (no longer dead); the TUI `mapHistoryRun` and web inline run-mapping
      are gone; `pnpm --filter @diffgazer/core test`, web focused tests, and TUI focused tests pass; history lists render identically.

- [ ] T-244 (fixes F-188) — files: cli/diffgazer/src/features/review/components/review-summary-view.tsx, libs/core/src/format.ts
      Change: Replace the local `durationSeconds = durationMs !== undefined ? (durationMs / 1000).toFixed(1) : undefined` derivation at
      `cli/diffgazer/src/features/review/components/review-summary-view.tsx:76-77` (rendered as `{durationSeconds}s` at `:114`) with
      `formatDuration(durationMs)` from `@diffgazer/core/format` (the canonical formatter `libs/core/src/format.ts:47-54`, already consumed by
      both history surfaces) and render its full returned string instead of appending a hardcoded `s`. If the summary genuinely needs a fixed
      decimal-seconds format distinct from the history `Xm Ys` format, add that named variant to `libs/core/src/format.ts` and have both call
      sites use it — do not open-code the math in the component. (Run after T-241, which also edits this TUI file.)
      Accept: the TUI review-summary uses `formatDuration` from core (no inline `(ms/1000).toFixed(1)`); the same review duration renders
      consistently between the summary panel and history; `pnpm --filter @diffgazer/core test` and TUI focused tests pass.

- [ ] T-245 (fixes F-085) — files: libs/core/src/review/build-summary.ts, libs/core/src/review/index.ts, libs/core/src/strings.ts, cli/diffgazer/src/features/review/components/summary-view-helpers.ts (Phase-1 name), apps/web/src/features/review/components/review-summary-view.tsx
      Change: Add `buildLensStats(issues: ReviewIssue[]): LensStats[]` to `libs/core/src/review/build-summary.ts` (next to `buildReviewSummary`),
      using the existing `capitalize` from `libs/core/src/strings.ts` for the title-casing (do not re-implement title-casing). Export it via
      `libs/core/src/review/index.ts` (`@diffgazer/core/review`). Delete the TUI `buildLensStats` copy in `summary-view-helpers.ts:4-16` and
      import core's. In `apps/web/src/features/review/components/review-summary-view.tsx:29-49` replace the inline count+map with
      `buildLensStats(issues).map(s => ({ ...s, ...CATEGORY_META[...] }))` so the icon/iconColor enrichment stays app-local.
      Accept: `buildLensStats` exists once in `@diffgazer/core/review` and uses core `capitalize`; the TUI copy is deleted; web enriches the
      shared result with app-local `CATEGORY_META`; `pnpm --filter @diffgazer/core test`, web + TUI focused tests pass.

- [ ] T-246 (fixes F-104) — files: apps/web/src/features/onboarding/hooks/use-onboarding.ts, apps/web/src/features/onboarding/hooks/onboarding-reducer.ts, apps/web/src/features/onboarding/hooks/onboarding-reducer.test.ts, libs/core/src/onboarding/use-wizard-state.ts
      Change: Migrate apps/web onboarding onto the shared `libs/core` state machine the TUI already consumes. Have
      `apps/web/src/features/onboarding/hooks/use-onboarding.ts` call `useWizardState(getInitialWizardData(), { saveCredentials, deleteCredentials })`
      from `@diffgazer/core/onboarding` (as `cli/diffgazer/src/features/onboarding/hooks/use-onboarding-wizard.ts:47-54` does) and route final
      submission through the existing `saveWizard` helper, instead of the inline machine at `use-onboarding.ts:12-145`. Delete
      `apps/web/src/features/onboarding/hooks/onboarding-reducer.ts` and its colocated test. Keep only web-specific glue in `use-onboarding.ts`;
      do not duplicate STEPS/INITIAL_DATA/next/back/setProvider. While here, the `|| null` parity note in `use-wizard-state.ts:97-101` references
      the pre-extraction web hook — once web consumes the shared machine, drop the stale parity comment if the behavior is now identical.
      Accept: `use-onboarding.ts` consumes `useWizardState` from `@diffgazer/core/onboarding`; `onboarding-reducer.ts` and its test are deleted;
      no STEPS/INITIAL_DATA/next/back/setProvider reimplementation remains in apps/web; onboarding flow behavior is unchanged; web focused tests
      and `pnpm --filter @diffgazer/core test` pass.

- [ ] T-247 (fixes F-207) — files: libs/core/src/forms/derive-save-state.ts (new), libs/core/src/forms/index.ts, apps/web/src/features/settings/components/storage/page.tsx, apps/web/src/features/settings/components/agent-execution/page.tsx, apps/web/src/features/settings/components/theme/page.tsx, cli/diffgazer/src/features/settings/storage/derive-save-state.ts, cli/diffgazer/src/features/settings/lens-selection.ts
      Change: Extract a generic `deriveSaveState<T>({ persisted, choice, saving, fallback }): { effective, isDirty, canSave }` into
      `libs/core/src/forms/derive-save-state.ts` (`effective = choice ?? persisted ?? fallback`, `isDirty = persisted !== effective`,
      `canSave = !saving && isDirty`), exported via the existing `@diffgazer/core/forms` subpath (`libs/core/src/forms/index.ts`). It is the
      generalization the TUI already wrote at `cli/diffgazer/src/features/settings/storage/derive-save-state.ts:17-26`. Replace the inline
      `effective/isDirty/canSave` blocks in the three web settings pages (`storage/page.tsx:26-32`, `agent-execution/page.tsx:31,37,38`,
      `theme/page.tsx:57`) with calls to it, and have the TUI `derive-save-state.ts` re-export/consume the shared helper instead of redefining.
      Keep the array-dirty idea (`lens-selection.ts:3-9`) as a sibling helper in the same core module.
      Accept: `deriveSaveState` exists once in `@diffgazer/core/forms`; the three web settings pages and the TUI helper consume it (no inline
      `effective/isDirty/canSave` redefinitions remain); save/dirty behavior is unchanged; `pnpm --filter @diffgazer/core test`, web + TUI
      focused tests pass.

- [ ] T-248 (fixes F-208) — files: libs/core/src/providers/use-model-filter.ts (new), libs/core/src/providers/index.ts, apps/web/src/features/providers/hooks/use-model-filter.ts, cli/diffgazer/src/features/providers/components/model-select-overlay.tsx
      Change: Move `useModelFilter(models)` into `libs/core/src/providers/use-model-filter.ts`, exported via the `@diffgazer/core/providers`
      subpath, returning `{ searchQuery, setSearchQuery, tierFilter, setTierFilter, filteredModels, cycleTierFilter, resetFilters }` (the body
      currently at apps/web `use-model-filter.ts:11-34`, built on the already-shared `filterModels`/`cycleTierFilter` core primitives — pure React,
      no DOM/Ink coupling). Have `apps/web/src/features/providers/hooks/use-model-filter.ts` re-export the shared hook (or delete it and import
      directly). Replace the inline `searchQuery`/`tierFilter`/`filteredModels`/cycle/open-reset state in
      `cli/diffgazer/src/features/providers/components/model-select-overlay.tsx:107-128,170` with the shared hook, keeping only the Ink-specific
      `focusZone`/`highlightIndex` state local.
      Accept: `useModelFilter` lives in `@diffgazer/core/providers`; both web and the TUI overlay consume it (the TUI no longer inlines the filter
      state machine); filtering/search/tier-cycle behavior unchanged; web + TUI focused tests and `pnpm --filter @diffgazer/core test` pass.

- [ ] T-249 (fixes F-164) — files: libs/core/src/schemas/presentation/shortcuts.ts, libs/core/src/schemas/presentation/index.ts, apps/web/src/config/navigation.ts, cli/diffgazer/src/config/navigation.ts, apps/web/src/features/settings/components/hub/page.tsx, cli/diffgazer/src/app/screens/settings/hub-screen.tsx
      Change: Move `SETTINGS_SHORTCUTS` (the byte-identical `[{key:"↑/↓",label:"Navigate"},{key:"Enter",label:"Edit"},{key:"Esc",label:"Back"}]`
      duplicated in `apps/web/src/config/navigation.ts:3` and `cli/diffgazer/src/config/navigation.ts:3`) to
      `libs/core/src/schemas/presentation/shortcuts.ts` next to the existing shared `MAIN_MENU_SHORTCUTS`, exported via the same
      `@diffgazer/core/schemas/presentation` subpath. Import it in both `usePageFooter` consumers (`apps/web/.../settings/components/hub/page.tsx:51`,
      `cli/diffgazer/.../app/screens/settings/hub-screen.tsx:30`). Delete both `config/navigation.ts` copies (and their now-empty single-file
      folders if Phase 1 has not already collapsed them).
      Accept: `SETTINGS_SHORTCUTS` lives once in `libs/core` presentation shortcuts (beside `MAIN_MENU_SHORTCUTS`); both hub pages import it from
      `@diffgazer/core/schemas/presentation`; no per-app `config/navigation.ts` `SETTINGS_SHORTCUTS` copy remains; settings footer shortcuts render
      unchanged; `pnpm --filter @diffgazer/core test`, web + TUI focused tests pass.

---

### Phase exit

This phase changed `libs/core`, `@diffgazer/registry`, `@diffgazer/ui`/`@diffgazer/keys` build tooling and RSC/dist guards, `apps/docs`,
`apps/web`, `cli/diffgazer`, and `cli/server` — crossing libraries, the registry/public-handoff surface, and the CLI/server/web runtime. All
gates below must pass before Phase 3 starts (D7 / refactor-verification protocol; run narrowest first, then the full set):

1. `DIFFGAZER_SKIP_ARTIFACT_PREPARE=1 pnpm exec turbo run type-check` (project references make any boundary/import breakage a hard error).
2. FULL `DIFFGAZER_SKIP_ARTIFACT_PREPARE=1 pnpm exec turbo run test` (not `--affected` — refactor ripple under-counts).
3. `pnpm run prepare:artifacts` then `pnpm run validate:artifacts:check` (Batch 2.A touches registry build tooling, RSC/dist guards, and the
   registry-types/keys-regex handoff helpers; Batch 2.C touches docs that consume the registry — the public handoff contract must still validate).
4. `DIFFGAZER_SMOKE_STRICT_SKIPS=1 pnpm run smoke` (Batches 2.B/2.D/2.E touch `cli/server` runtime, the apps/web figlet bundle boundary, and the
   `diffgazer` CLI consumers — validates the bundled offline snapshot; CI adds `DIFFGAZER_SMOKE_ALLOW_NETWORK=1`).
5. `pnpm run verify:monorepo`.
6. `git diff --check`.

Targeted gates worth running per batch before the full set: `pnpm --filter @diffgazer/ui type-check` + `pnpm --filter @diffgazer/keys type-check`
(2.A); `pnpm --filter @diffgazer/server test` (2.B); `pnpm --filter @diffgazer/docs type-check`/`test` (2.C); `pnpm --filter @diffgazer/web type-check`
+ focused web tests (2.D); `pnpm --filter @diffgazer/core test` + focused web/TUI/server tests (2.E).


---

## Phase 3 — Barrel dissolution (D6)

Stacked after the Phase 1 pure-move/rename commits and Phase 2 DRY/extraction work so every concrete re-export target already sits at its final path; this phase only deletes internal pure re-export barrels, repoints each lib's `exports` map and self-package imports at concrete modules, shrinks the over-fat `libs/core` root `.` entry, aligns the `@diffgazer/keys` subpath exports with its README/invariant, and renames the two non-boundary orchestrator `index.ts` files. It KEEPS every lib's single public `src/index.ts`, the granular subpath exports, and `libs/ui` per-component `index.ts`.

Batches below touch disjoint file sets and are parallel-safe across batches. Within a batch, tasks may share files and MUST run in listed order.

### Batch 3.A — files: apps/web/src/features/{history,home,providers,review,onboarding}/index.ts, apps/web/src/features/{onboarding/components,onboarding/hooks,history/hooks,providers/hooks,review/hooks}/index.ts, apps/web/src/components/{layout,shared,ui/progress,ui/severity}/index.ts, apps/web/src/testing/index.ts, apps/web/src/app/routes/onboarding.tsx, apps/web/src/app/routes/__root.tsx, apps/web/src/features/review/components/page.tsx, apps/web/src/features/review/components/analysis-summary.tsx, apps/web/src/features/review/components/review-progress-view.tsx, plus the apps/web test files listed below

- [ ] T-301 (fixes F-001) — files: the 15 `index.ts` barrels above + the 14 consumer files below
      Change: Delete all 15 internal pure re-export barrels in apps/web:
        `apps/web/src/features/history/index.ts`, `apps/web/src/features/home/index.ts`,
        `apps/web/src/features/providers/index.ts`, `apps/web/src/features/review/index.ts`,
        `apps/web/src/features/onboarding/index.ts`, `apps/web/src/features/onboarding/components/index.ts`,
        `apps/web/src/features/onboarding/hooks/index.ts`, `apps/web/src/features/history/hooks/index.ts`,
        `apps/web/src/features/providers/hooks/index.ts`, `apps/web/src/features/review/hooks/index.ts`,
        `apps/web/src/components/layout/index.ts`, `apps/web/src/components/shared/index.ts`,
        `apps/web/src/components/ui/progress/index.ts`, `apps/web/src/components/ui/severity/index.ts`,
        `apps/web/src/testing/index.ts`.
        Then repoint the only remaining barrel consumers to concrete files:
          - `apps/web/src/app/routes/onboarding.tsx:1`: change `from "@/features/onboarding"` to `from "@/features/onboarding/components/onboarding-wizard"`.
          - `apps/web/src/features/review/components/page.tsx:12`: change `from "../hooks"` to `from "../hooks/use-review-error-handler"`.
          - `apps/web/src/features/review/components/analysis-summary.tsx`: change the `@/components/ui/severity` import of `SeverityBreakdown` to `@/components/ui/severity/severity-breakdown`.
          - `apps/web/src/features/review/components/review-progress-view.tsx:9`: change `from "@/components/ui/progress"` (`ProgressList`, `ProgressStepData`) to `from "@/components/ui/progress/progress-list"`.
          - `apps/web/src/app/routes/__root.tsx:6`: change `@/components/layout` (`GlobalLayout`) to `@/components/layout/global-layout`.
          - `apps/web/src/components/layout/footer.integration.test.ts:4`, `apps/web/src/features/providers/components/api-key-dialog/dialog-footer.integration.test.tsx:7`, `apps/web/src/features/review/components/review-results-view.keyboard.test.tsx:7`, `apps/web/src/features/review/components/review-progress-view.test.tsx:5`: change `@/components/layout` (`Footer`) to `@/components/layout/footer`.
          - `@/testing` consumers → concrete files: `escapeRegExp` from `@/testing/utils`, `renderWithProviders` from `@/testing/render`, `makeIssue`/`makeReview` from `@/testing/factories`, in: `apps/web/src/features/onboarding/hooks/use-onboarding.test.tsx:16`, `apps/web/src/features/onboarding/components/steps/provider-step.test.tsx:6`, `apps/web/src/features/onboarding/components/steps/model-step.test.tsx:14`, `apps/web/src/features/settings/components/agent-execution/page.test.tsx:4`, `apps/web/src/features/history/components/history-insights-pane.test.tsx:5`, `apps/web/src/features/history/components/page.test.tsx:5`, `apps/web/src/features/settings/components/analysis/page.test.tsx:4`, `apps/web/src/features/settings/components/storage/page.test.tsx:4`, `apps/web/src/features/review/components/issue-list-pane.test.tsx:3`, `apps/web/src/features/review/components/page.test.tsx:79`, `apps/web/src/features/review/components/issue-details-pane.test.tsx:5`.
        Do NOT touch `apps/web/src/app/providers/index.tsx` — it defines the `AppProviders` composition component, not a barrel; KEEP it.
      Accept: No file named `index.ts` remains under `apps/web/src/features/**` or `apps/web/src/components/**` or `apps/web/src/testing/`; `rg "@/features/(history|home|providers|review|onboarding)\"" apps/web/src`, `rg "@/components/(layout|shared|ui/progress|ui/severity)\"" apps/web/src`, `rg "@/testing\"" apps/web/src`, and `rg 'from "\.\./hooks"' apps/web/src/features` all return zero matches. `pnpm --filter @diffgazer/web type-check` and `pnpm --filter @diffgazer/web test` pass.

### Batch 3.B — files: libs/core/src/** (all self-importing modules + tests), libs/core/src/index.ts, libs/core/package.json, libs/core/src/footer/index.ts, libs/core/src/onboarding/steps.ts, libs/core/src/onboarding/use-wizard-state.ts, cli/diffgazer/src/hooks/use-terminal-dimensions.ts

- [ ] T-302 (fixes F-007) — files: every `libs/core/src/**/*.ts(x)` that imports `@diffgazer/core/<subpath>` (97 import statements across ~58 files), excluding `libs/core/src/catalog/catalog-snapshot.ts` (generated; its `@diffgazer/core` occurrence is a comment, not an import)
      Change: Using a ts-morph codemod over the `libs/core` project, rewrite every intra-package import specifier of the form `@diffgazer/core/<subpath>` inside `libs/core/src/**` to the equivalent relative `.js` path that resolves to the same module the subpath export maps to. Map each subpath to its source module then compute the relative path from the importing file:
        `@diffgazer/core/result`→`result.js`, `/errors`→`errors.js`, `/format`→`format.js`, `/strings`→`strings.js`, `/env`→`env.js`, `/json`→`json.js`, `/catalog`→`catalog/index.js`, `/review`→`review/index.js`, `/schemas/config`→`schemas/config/index.js`, `/schemas/review`→`schemas/review/index.js`, `/schemas/events`→`schemas/events/index.js`, `/schemas/presentation`→`schemas/presentation/index.js`, `/schemas/git`→`schemas/git/index.js`, `/schemas/context`→`schemas/context/index.js`. Example: in `libs/core/src/api/review.ts` rewrite `@diffgazer/core/result`→`../result.js`, `@diffgazer/core/review`→`../review/index.js`, `@diffgazer/core/schemas/review`→`../schemas/review/index.js`. Preserve named/type import lists verbatim; only the module specifier changes. Save the whole plan once via `project.save()`.
      Accept: `rg 'from "@diffgazer/core' libs/core/src` returns zero matches. `pnpm --filter @diffgazer/core type-check` and `pnpm --filter @diffgazer/core test` pass with no behavior change.

- [ ] T-303 (fixes F-020) — files: libs/core/package.json, libs/core/src/index.ts, cli/diffgazer/src/hooks/use-terminal-dimensions.ts
      Change: Add a `./breakpoints` subpath export to `libs/core/package.json` `exports` pointing at the breakpoints module's built location (`{ "types": "./dist/layout/breakpoints.d.ts", "import": "./dist/layout/breakpoints.js" }`, matching the source file `libs/core/src/layout/breakpoints.ts` at its final post-Phase-1 path). Shrink `libs/core/src/index.ts`: remove the `export *` lines for `./result.js`, `./errors.js`, `./format.js`, `./strings.js`, `./env.js`, `./json.js` (each already has a dedicated subpath export and zero root-`.`-barrel consumers); also remove the `export *` of `./layout/breakpoints.js` now that it has its own subpath. If that empties the file, delete `src/index.ts` and remove the `.` entry from the `exports` map; otherwise leave only genuinely-`.`-only symbols. Repoint `cli/diffgazer/src/hooks/use-terminal-dimensions.ts:3` from `@diffgazer/core` to `@diffgazer/core/breakpoints` for `getBreakpointTier`, `buildResponsiveResult`, `ResponsiveResult`.
      Accept: `rg 'from "@diffgazer/core"' apps cli libs --glob '!**/playwright-report/**'` returns zero matches (no remaining root-`.`-barrel consumer). `pnpm --filter @diffgazer/core type-check`, `pnpm --filter diffgazer type-check`, and `pnpm --filter @diffgazer/core test` pass.

- [ ] T-304 (fixes F-092) — files: libs/core/src/footer/index.ts
      Change: Delete the line `export { MAIN_MENU_SHORTCUTS } from "../schemas/presentation/index.js";` from `libs/core/src/footer/index.ts`. The `./footer` subpath must expose only footer symbols; every real consumer imports `MAIN_MENU_SHORTCUTS` from `@diffgazer/core/schemas/presentation`.
      Accept: `libs/core/src/footer/index.ts` no longer re-exports `MAIN_MENU_SHORTCUTS`. `pnpm --filter @diffgazer/core type-check` and `pnpm --filter @diffgazer/core test` pass (footer/footer.test.ts must be updated to import `MAIN_MENU_SHORTCUTS` from `../schemas/presentation/index.js` if it relied on the footer re-export).

- [ ] T-305 (fixes F-148) — files: libs/core/src/onboarding/steps.ts, libs/core/src/onboarding/use-wizard-state.ts
      Change: Delete the pass-through line `export { WIZARD_STEPS } from "./types.js";` (line 3) from `libs/core/src/onboarding/steps.ts`. In `libs/core/src/onboarding/use-wizard-state.ts`, remove `WIZARD_STEPS` from the `import { ... } from "./steps.js"` group (leaving `getStepAt`, `isFirstStepIndex`, `isLastStepIndex`) and add `WIZARD_STEPS` to the existing `import type { OnboardingStep, WizardData } from "./types.js"` line — converting it to a value+type import that includes `WIZARD_STEPS` from `./types.js`.
      Accept: `steps.ts` no longer re-exports `WIZARD_STEPS`; `use-wizard-state.ts` imports `WIZARD_STEPS` from `./types.js`. `pnpm --filter @diffgazer/core type-check` and `pnpm --filter @diffgazer/core test` pass.

### Batch 3.C — files: apps/docs/src/components/docs-mdx/index.ts, apps/docs/src/components/docs-mdx/blocks/index.ts, apps/docs/src/mdx-components.tsx, apps/docs/src/components/docs-mdx/feature-mdx-components.tsx

- [ ] T-306 (fixes F-014) — files: apps/docs/src/components/docs-mdx/index.ts, apps/docs/src/components/docs-mdx/blocks/index.ts, apps/docs/src/mdx-components.tsx, apps/docs/src/components/docs-mdx/feature-mdx-components.tsx
      Change: Delete both internal pure re-export barrels `apps/docs/src/components/docs-mdx/index.ts` and `apps/docs/src/components/docs-mdx/blocks/index.ts`, then repoint their single consumers each:
        - `apps/docs/src/mdx-components.tsx:2-5`: replace the `from "@/components/docs-mdx"` import of `featureMdxComponents` and `markdownMdxComponents` with two concrete imports: `featureMdxComponents` from `@/components/docs-mdx/feature-mdx-components` and `markdownMdxComponents` from `@/components/docs-mdx/markdown-renderers`.
        - `apps/docs/src/components/docs-mdx/feature-mdx-components.tsx:7-22`: replace the `from "./blocks"` import block with concrete per-file imports from `./blocks/<file>`, preserving the existing aliases: `AccessibilityNotes` from `./blocks/accessibility-notes`; `APIReference` from `./blocks/api-reference`; `ConsumptionBlock` from `./blocks/consumption-block`; `Example`/`Examples` from `./blocks/example` and `./blocks/examples`; `KeyboardNav` from `./blocks/keyboard-nav`; `Notes` from `./blocks/notes`; `{ ParameterTableBlock as ParameterTable }` from `./blocks/parameter-table-block`; `{ PropsTableBlock as PropsTable }` from `./blocks/props-table-block`; `ReturnsTable` from `./blocks/returns-table`; `{ SourceViewerBlock as SourceViewer }` from `./blocks/source-viewer-block`; `{ Step, Steps }` from `./blocks/steps`; `UsageSnippet` from `./blocks/usage-snippet`.
      Accept: Neither barrel file exists. `rg '"@/components/docs-mdx"' apps/docs/src` and `rg 'from "\./blocks"' apps/docs/src/components/docs-mdx` return zero matches. `pnpm --filter @diffgazer/docs type-check` and the docs build/tests pass.

### Batch 3.D — files: cli/server/src/dev.ts, cli/server/src/shared/lib/http/sse.ts, cli/server/src/features/review/sse-replay.ts, cli/server/src/features/review/sse-replay.test.ts

- [ ] T-307 (fixes F-015) — files: cli/server/src/dev.ts
      Change: In `cli/server/src/dev.ts:3` change `import { createApp } from "./index.js";` to import `createApp` directly from the concrete factory module: `import { createApp } from "./app.js";` (matching `cli/server/src/app.test.ts` and `cli/server/src/index.ts`, which already source `createApp` from `./app.js`). This removes the self-package-barrel hop through the package's own public entry `index.ts`. KEEP `cli/server/src/index.ts` as the package's public entry.
      Accept: `cli/server/src/dev.ts` imports `createApp` from `./app.js`; `rg 'from "\./index\.js"' cli/server/src/dev.ts` returns zero matches. `pnpm --filter @diffgazer/server type-check` and `pnpm --filter @diffgazer/server test` pass.

- [ ] T-308 (fixes F-245) — files: cli/server/src/shared/lib/http/sse.ts, cli/server/src/features/review/sse-replay.ts, cli/server/src/features/review/sse-replay.test.ts
      Change: Delete line 3 of `cli/server/src/shared/lib/http/sse.ts` (`export type { SSEWriter } from "./types.js";`), leaving `sse.ts` to export only its real concept `writeSSEError` (keep the local `import type { SSEWriter } from "./types.js"` it uses internally). Repoint the two consumers that imported the type via the re-export: in `cli/server/src/features/review/sse-replay.ts:3` and `cli/server/src/features/review/sse-replay.test.ts:4`, change `import type { SSEWriter } from "../../shared/lib/http/sse.js";` to `from "../../shared/lib/http/types.js";` — matching `cli/server/src/features/review/service.test.ts`, which already imports `SSEWriter` from the source module `http/types.js`.
      Accept: `SSEWriter` is importable only from `cli/server/src/shared/lib/http/types.ts`; `rg 'SSEWriter.*http/sse' cli/server/src` returns zero matches. `pnpm --filter @diffgazer/server type-check` and `pnpm --filter @diffgazer/server test` pass.

### Batch 3.E — files: libs/registry/src/index.ts, libs/registry/src/artifacts.ts, libs/registry/src/docs-data/index.ts, libs/registry/src/shadcn/index.ts, libs/registry/src/docs/index.ts, libs/registry/src/cli/bundler/index.ts, libs/registry/src/cli/index.ts, libs/registry/src/testing/docs-sync.test.ts, libs/registry/src/testing/bundler.test.ts

- [ ] T-309 (fixes F-016, F-019) — files: libs/registry/src/index.ts, libs/registry/src/docs-data/index.ts
      Change: Dissolve the internal pure re-export barrel `libs/registry/src/docs-data/index.ts`. In `libs/registry/src/index.ts`, replace the two blocks that re-export from `./docs-data/index.js` (the type block at lines 69-90 and the value+type blocks at lines 92-120) with re-exports pointing at the concrete `docs-data/*` modules, using this symbol→module map (from the current `docs-data/index.ts`): all the `DocNote`/`ExampleRef`/.../`ConsumptionMetadata` types → `./docs-data/types.js`; `createDocsHighlighter`/`highlightCode` + types `HighlightLanguage`/`DocsHighlighter`/`CreateHighlighterOptions` → `./docs-data/highlight.js`; `generateHooksSource`/`generateEnrichedHookData` + types `HookRegistryItem`/`GenerateHooksSourceOptions`/`GenerateEnrichedHookDataOptions` → `./docs-data/hooks-source.js`; `docsCodeTheme`/`DOCS_CODE_THEME_NAME` → `./docs-data/code-theme.js`; `kebabToCamelCase`/`toDocExportName`/`toYamlString`/`createHookDocLoader` → `./docs-data/utils.js`; `findExamples`/`generateDemoIndex` → `./docs-data/examples.js`; `buildDocsData` + types `BuildDocsDataConfig`/`BuildDocsDataResult`/`DemoIndexConfig`/`LibsConfig` → `./docs-data/build-docs-data.js`; `buildComponentsData` + `ComponentsConfig` → `./docs-data/build-components.js`; `buildHooksData` + `HooksConfig` → `./docs-data/build-hooks.js`. Then delete `libs/registry/src/docs-data/index.ts`.
      Accept: `libs/registry/src/docs-data/index.ts` does not exist; `rg 'docs-data/index' libs/registry/src` returns zero matches; the public `.` entry still exports every symbol it exported before (verify via the `./schemas`/`.`/`./cli` consumers and `pnpm --filter @diffgazer/registry type-check`). `pnpm --filter @diffgazer/registry test` passes.

- [ ] T-310 (fixes F-017) — files: libs/registry/src/index.ts, libs/registry/src/artifacts.ts, libs/registry/src/shadcn/index.ts
      Change: Dissolve the internal pure re-export barrel `libs/registry/src/shadcn/index.ts`. In `libs/registry/src/index.ts` (lines 10-23) repoint the value+type re-exports to the concrete shadcn modules: `runShadcnRegistryBuild` + `RunShadcnRegistryBuildOptions` → `./shadcn/runner.js`; `validatePublicRegistryFresh` + `ValidatePublicRegistryFreshOptions` → `./shadcn/validate.js`; `buildShadcnRegistryWithOrigin`/`ensurePublicRegistryReady` + `BuildShadcnRegistryWithOriginOptions`/`BuildShadcnRegistryWithOriginResult`/`EnsurePublicRegistryReadyOptions` → `./shadcn/build.js`; `resolveLocalShadcnBin` → `./shadcn/runner.js`. In `libs/registry/src/artifacts.ts:8` change `from "./shadcn/index.js"` to `from "./shadcn/build.js"` for `ensurePublicRegistryReady`/`EnsurePublicRegistryReadyOptions`. Then delete `libs/registry/src/shadcn/index.ts`.
      Accept: `libs/registry/src/shadcn/index.ts` does not exist; `rg 'shadcn/index' libs/registry/src` returns zero matches; the `.` entry still exports all five shadcn value symbols. `pnpm --filter @diffgazer/registry type-check` and `pnpm --filter @diffgazer/registry test` pass.

- [ ] T-311 (fixes F-018) — files: libs/registry/src/docs/index.ts, libs/registry/src/cli/bundler/index.ts, libs/registry/src/index.ts, libs/registry/src/cli/index.ts, libs/registry/src/testing/docs-sync.test.ts, libs/registry/src/testing/bundler.test.ts
      Change: Rename the two non-boundary orchestrator `index.ts` files to concept-named siblings (orchestrator-split rule), keeping their sibling-relative imports intact since the folder is unchanged:
        - Rename `libs/registry/src/docs/index.ts` → `libs/registry/src/docs/sync.ts` (it exports the `syncDocsFromArtifacts` orchestrator). Repoint `libs/registry/src/index.ts:28` (`from "./docs/index.js"`) and `libs/registry/src/testing/docs-sync.test.ts:14` (`from "../docs/index.js"`) to `./docs/sync.js` / `../docs/sync.js`.
        - Rename `libs/registry/src/cli/bundler/index.ts` → `libs/registry/src/cli/bundler/bundle.ts` (it exports the `createBundler` orchestrator). Repoint `libs/registry/src/cli/index.ts` (`from "./bundler/index.js"`) and `libs/registry/src/testing/bundler.test.ts:7` (`from "../cli/bundler/index.js"`) to `./bundler/bundle.js` / `../cli/bundler/bundle.js`.
      Accept: No `index.ts` remains under `libs/registry/src/docs/` or `libs/registry/src/cli/bundler/`; `rg 'docs/index|bundler/index' libs/registry/src` returns zero matches. `pnpm --filter @diffgazer/registry type-check` and `pnpm --filter @diffgazer/registry test` pass. (KEEP `libs/registry/src/cli/index.ts` — it backs the public `./cli` subpath export.)

- [ ] T-312 (fixes F-187) — files: libs/registry/src/index.ts
      Change: Make `@diffgazer/registry/schemas` (backed by `libs/registry/src/schemas.ts`) the single public home for the `RegistrySchema`/`RegistryItemSchema`/`RegistryFileSchema` + `Registry`/`RegistryItem`/`RegistryFile` family. Delete the redundant root-`.` re-export block at `libs/registry/src/index.ts:122-129` (the `export { RegistryFileSchema, RegistryItemSchema, RegistrySchema, type RegistryFile, type RegistryItem, type Registry } from "./registry-types.js";`). No external consumer imports these symbols from the bare `.` root (verified: cli/add uses `@diffgazer/registry/schemas`; docs uses `.` only for `docsCodeTheme`/`HookDoc`/`REGISTRY_ORIGIN`), so no consumer repoint is required. Sequence this after T-309/T-310 so the index edits do not conflict.
      Accept: `libs/registry/src/index.ts` no longer re-exports the `RegistrySchema`/`RegistryItem` family; those symbols remain reachable via `@diffgazer/registry/schemas`. `pnpm --filter @diffgazer/registry type-check`, the cli/add type-check, and `pnpm --filter @diffgazer/registry test` pass.

### Batch 3.F — files: libs/keys/package.json

- [ ] T-313 (fixes F-105) — files: libs/keys/package.json
      Change: Remove the 5 subpath export entries (`./navigation`, `./focus-restore`, `./focus-trap`, `./scroll-lock`, `./focusable`) and the entire `typesVersions` block from `libs/keys/package.json`, leaving `exports` as exactly `{ ".": { "types": "./dist/index.d.ts", "import": "./dist/index.js" }, "./package.json": "./package.json" }`. This matches README.md:84 ("Root-only, no subpath exports") and the `["."]` baseline asserted by `scripts/monorepo/check-invariants.mjs`. No consumer imports the removed subpaths (verified zero matches repo-wide) and no `public/r` JSON or docs reference them, so no lockstep edits are needed.
      Accept: `libs/keys/package.json` `exports` has exactly the `.` and `./package.json` keys and no `typesVersions` field. `pnpm --filter @diffgazer/keys type-check`, focused keys tests, and `pnpm run verify:monorepo` (check-invariants) pass.

### Phase exit

All gates must pass before Phase 4 begins (run from repo root):
- `DIFFGAZER_SKIP_ARTIFACT_PREPARE=1 pnpm exec turbo run type-check` (FULL — project references make any boundary/import-path breakage a hard error).
- `DIFFGAZER_SKIP_ARTIFACT_PREPARE=1 pnpm exec turbo run test` (FULL suite, not `--affected` — barrel/import ripple under-counts affected).
- `pnpm run prepare:artifacts` then `pnpm run validate:artifacts:check` (this phase touches the registry/public-handoff surface: `libs/registry` exports map, `libs/keys` package.json exports, and `apps/docs` MDX consumers).
- `DIFFGAZER_SMOKE_STRICT_SKIPS=1 pnpm run smoke` (this phase touches `cli/server` and `apps/web`/docs build inputs).
- `pnpm run verify:monorepo` (re-validates the `check-invariants.mjs` export baselines after the keys/core/registry exports-map edits).
- `git diff --check`.


---

## Phase 4 — Splits & local fixes (SRP, simplicity, dead code, slop)

This phase sits after Phase 1 (pure moves/renames), Phase 2 (DRY extractions / boundaries), and Phase 3 (barrel dissolution) because every task here is a pure local edit — a within-file split, a symbol deletion, an `export`-keyword removal, or a file/scratch-doc deletion — that must land on files already at their final paths, already deduped, and already off the dissolved internal barrels. Nothing here ripples across packages beyond removing now-dead import lines, so it is the right moment to drop dead weight before the heavier Phase 5 docs-mirror removal and the Phase 7 enforcement wiring (knip will then have a clean baseline). Batches below touch disjoint file sets and are parallel-safe; the only intra-batch coupling (shared registry/manifest files) is contained inside a single batch.

---

### Batch 4.A — files: cli/server/src/shared/lib/review/utils.ts, cli/server/src/shared/lib/review/analysis.ts

- [ ] T-401 (fixes F-037) — files: cli/server/src/shared/lib/review/utils.ts, cli/server/src/shared/lib/review/analysis.ts
      Change: Inline the two functions from `cli/server/src/shared/lib/review/utils.ts` (`estimateTokens(text)` and `getThinkingMessage(lens)`, plus the `import type { Lens } from "@diffgazer/core/schemas/review"`) into their sole consumer `cli/server/src/shared/lib/review/analysis.ts` (add the `Lens` type import there if not already present), then delete `cli/server/src/shared/lib/review/utils.ts`. Remove the now-stale import of `./utils.js` from `analysis.ts`.
      Accept: `cli/server/src/shared/lib/review/utils.ts` no longer exists; `rg "review/utils" cli/server/src` returns nothing; `pnpm --filter @diffgazer/server type-check` and focused review tests pass.

---

### Batch 4.B — files: cli/server/src/shared/lib/ai/disk-cache.ts, cli/server/src/shared/lib/ai/disk-cache.test.ts, cli/server/src/shared/lib/ai/models-dev-catalog.ts

- [ ] T-402 (fixes F-006) — files: cli/server/src/shared/lib/ai/disk-cache.ts, cli/server/src/shared/lib/ai/disk-cache.test.ts, cli/server/src/shared/lib/ai/models-dev-catalog.ts
      Change: Delete the `loadDiskCacheState` export (disk-cache.ts:21-33) and its colocated `describe` block (disk-cache.test.ts:44-65). In `models-dev-catalog.ts`, fix the stale JSDoc: replace the `{@link loadDiskCacheState}` reference at :62 and the false "deliberately reuses loadDiskCacheState/persistDiskCache" parenthetical at :211 to name the primitives actually reused (`readJsonFileSyncSafe`, `persistDiskCache`, `isEntryFresh`). Do NOT remove `persistDiskCache`, the `DiskCacheState` type, or `isEntryFresh` — those are live.
      Accept: `rg -w loadDiskCacheState cli/server/src` returns nothing; `models-dev-catalog.ts` JSDoc names only live symbols; `pnpm --filter @diffgazer/server type-check` and disk-cache/models-dev-catalog tests pass.

---

### Batch 4.C — files: cli/server/src/shared/lib/ai/openrouter-models.ts, cli/server/src/shared/lib/ai/openrouter-models.test.ts

- [ ] T-403 (fixes F-170) — files: cli/server/src/shared/lib/ai/openrouter-models.ts, cli/server/src/shared/lib/ai/openrouter-models.test.ts
      Change: Delete the dead `loadOpenRouterModelCache` export (openrouter-models.ts:83) and remove its `describe` block plus its import/usages from openrouter-models.test.ts (lines 11, 35-60). Leave `getOpenRouterModelsWithCache` (openrouter-models.ts:120) untouched — it is the live cache-aware path consumed by `features/config/service.ts`. Do NOT edit `features/config/service.ts`.
      Accept: `rg -w loadOpenRouterModelCache cli/server/src` returns nothing; `pnpm --filter @diffgazer/server type-check` and openrouter-models tests pass.

---

### Batch 4.D — files: cli/server/src/shared/lib/fs.ts

- [ ] T-404 (fixes F-171) — files: cli/server/src/shared/lib/fs.ts
      Change: Delete the dead `readJsonFileSyncWithMtime` const (fs.ts:59-70) and the now-orphaned `JsonFileWithMtime<T>` interface (fs.ts:38-41) whose only consumer was that function's signature. Leave `readJsonFileSync`, `getFileMtimeMs`, and `readJsonFileSyncSafe` untouched.
      Accept: `rg -w "readJsonFileSyncWithMtime|JsonFileWithMtime" cli/server` returns nothing; `pnpm --filter @diffgazer/server type-check` passes.

---

### Batch 4.E — files: cli/server/src/shared/lib/review/prompts.ts, cli/server/src/shared/lib/review/prompts.test.ts

- [ ] T-405 (fixes F-138) — files: cli/server/src/shared/lib/review/prompts.ts, cli/server/src/shared/lib/review/prompts.test.ts
      Change: Delete the superseded `DEFAULT_RUBRIC` const (prompts.ts:8-14) and remove its import/usages from prompts.test.ts (lines 8, 34, 93-94). Rework the affected test assertions to exercise a per-lens rubric sourced from `lenses.ts` (e.g. `CORRECTNESS_SEVERITY_RUBRIC` via `lens.severityRubric`), matching production wiring. Do NOT edit `lenses.ts` (it is referenced only as the live rubric source).
      Accept: `rg -w DEFAULT_RUBRIC cli/server/src` returns nothing; the rewritten prompts test asserts a per-lens rubric and passes; `pnpm --filter @diffgazer/server type-check` passes.

---

### Batch 4.F — files: cli/server/src/features/settings/schemas.ts

- [ ] T-406 (fixes F-139) — files: cli/server/src/features/settings/schemas.ts
      Change: Delete the fully dead `export const ProjectIdQuerySchema` (schemas.ts:6-8). Leave `SettingsSchema` (consumed by router.ts) intact.
      Accept: `rg -w ProjectIdQuerySchema cli/server/src` returns nothing; `pnpm --filter @diffgazer/server type-check` passes.

---

### Batch 4.G — files: cli/server/src/features/review/workspace-discovery.ts

- [ ] T-407 (fixes F-230) — files: cli/server/src/features/review/workspace-discovery.ts
      Change: Remove the `export` keyword from `parseWorkspaceYaml` (:31), `resolveWorkspaceRoots` (:54), `filterEscapedRoots` (:64), and `getWorkspaceRoots` (:80), making them module-local. Keep `discoverWorkspacePackages`, `formatWorkspaceGraph`, and `readFileDirectory` exported (those are the real public surface consumed by context.ts / file-tree.ts). No consumer or test imports the four de-exported helpers, so no other file changes.
      Accept: `rg "parseWorkspaceYaml|resolveWorkspaceRoots|filterEscapedRoots|getWorkspaceRoots" cli/server/src` shows references only inside workspace-discovery.ts; `pnpm --filter @diffgazer/server type-check` and review tests pass.

---

### Batch 4.H — files: cli/diffgazer/src/hooks/use-key.ts, cli/diffgazer/src/app/providers/keyboard-provider.tsx, cli/diffgazer/src/banner.ts, cli/diffgazer/src/hooks/use-servers.ts, cli/diffgazer/src/hooks/use-exit.ts, cli/diffgazer/src/lib/servers/stop-all.ts (new), cli/diffgazer/src/lib/servers/factories.ts, cli/diffgazer/src/lib/servers/git-root.ts (new), cli/diffgazer/src/lib/servers/browser-launch.ts (new), cli/diffgazer/src/web-launcher.ts, cli/diffgazer/src/app/index.tsx

- [ ] T-408 (fixes F-005) — files: cli/diffgazer/src/hooks/use-key.ts, cli/diffgazer/src/app/providers/keyboard-provider.tsx
      Change: Delete `cli/diffgazer/src/hooks/use-key.ts` (the dead `useKey` hook, zero importers). In `keyboard-provider.tsx` remove the dead scoped-handler dispatch infrastructure: remove `registerHandler` from `KeyboardContextValue` (8-12) and from the context value object, delete the `ScopeEntry` interface (26-29), delete the `scopesRef` ref (40), delete the `registerHandler` useCallback (60-87), and delete the scoped-dispatch branch in the `useInput` handler (134-145). Keep the global-handler dispatch path and `pushScope`/`popScope`/`activeScope` exactly as-is.
      Accept: `cli/diffgazer/src/hooks/use-key.ts` does not exist; `rg -w "useKey|registerHandler|ScopeEntry|scopesRef" cli/diffgazer/src` returns nothing dead; `pnpm --filter @diffgazer/diffgazer type-check` and keyboard-provider tests pass.

- [ ] T-409 (fixes F-090) — files: cli/diffgazer/src/banner.ts
      Change: Inline the figlet resolution from `getDiffgazerBanner` directly into `printDiffgazerBanner` and drop the `export` from `getDiffgazerBanner` (or make it a non-exported local), leaving `printDiffgazerBanner` as the module's only public function.
      Accept: `rg -w getDiffgazerBanner cli/diffgazer/src` shows references only inside banner.ts (and no `export`); `pnpm --filter @diffgazer/diffgazer type-check` passes.

- [ ] T-410 (fixes F-156) — files: cli/diffgazer/src/hooks/use-servers.ts, cli/diffgazer/src/hooks/use-exit.ts, cli/diffgazer/src/lib/servers/stop-all.ts (new)
      Change: Move the non-hook `stopAllServers(): Promise<void>` function (and the module-level server state it operates on) out of `cli/diffgazer/src/hooks/use-servers.ts` into a new `cli/diffgazer/src/lib/servers/stop-all.ts` next to the other launcher adapters. Re-import `stopAllServers` from `../lib/servers/stop-all.js` into both `use-servers.ts` and `use-exit.ts` (use-exit.ts:4,21). Leave `useServers` as the only export of `use-servers.ts` so the `use-` prefix names only a hook.
      Accept: `use-servers.ts` exports only `useServers`; `stopAllServers` lives in `lib/servers/stop-all.ts`; both former call sites import it from there; `pnpm --filter @diffgazer/diffgazer type-check` and servers/exit tests pass.

- [ ] T-411 (fixes F-163) — files: cli/diffgazer/src/lib/servers/factories.ts (renamed from server-factories.ts), cli/diffgazer/src/lib/servers/git-root.ts (new), cli/diffgazer/src/lib/servers/browser-launch.ts (new), cli/diffgazer/src/web-launcher.ts, cli/diffgazer/src/app/index.tsx
      Change: Split the grab-bag `cli/diffgazer/src/lib/servers/server-factories.ts` (renamed to `factories.ts` during the Phase-1 F-034 `-server` path-echo pass — assume it is already `factories.ts` at this point; if the rename did not land, rename it now keeping the exported `createServerFactories`/`createDevServerFactories`/`createProdServerFactories`). Move `findGitRoot` to a new `cli/diffgazer/src/lib/servers/git-root.ts` (or reuse a canonical VCS-root helper in libs/core if one exists — prefer the local file unless a libs/core export is already imported elsewhere in cli/diffgazer). Move `openBrowserAddress` and `createReadyHandler` to a new sibling `cli/diffgazer/src/lib/servers/browser-launch.ts`. Keep only the `create*Factories` orchestration in `factories.ts`. Update the two consumers `web-launcher.ts` and `app/index.tsx` to import each symbol from its new home.
      Accept: `factories.ts` exports only the `create*Factories` functions; `findGitRoot` and `openBrowserAddress`/`createReadyHandler` live in their new files; `web-launcher.ts` and `app/index.tsx` import from the new homes; `pnpm --filter @diffgazer/diffgazer type-check` and servers tests pass.

---

### Batch 4.I — files: apps/web/src/features/home/components/storage-wizard.tsx, apps/web/src/lib/config-guard-cache.ts, apps/web/src/lib/config-guards.test.ts, apps/web/src/features/onboarding/hooks/use-onboarding.test.tsx, apps/web/src/features/onboarding/hooks/onboarding-settings-sync.test.ts

- [ ] T-412 (fixes F-106) — files: apps/web/src/features/home/components/storage-wizard.tsx
      Change: Delete the orphaned dead component file `apps/web/src/features/home/components/storage-wizard.tsx` in full (the `StorageWizard` component + `StorageWizardProps` type). It has zero importers and no test. No barrel or consumer update needed.
      Accept: file does not exist; `rg -w StorageWizard apps/web/src` returns nothing; `pnpm --filter @diffgazer/web type-check` passes.

- [ ] T-413 (fixes F-172) — files: apps/web/src/lib/config-guard-cache.ts, apps/web/src/lib/config-guards.test.ts, apps/web/src/features/onboarding/hooks/use-onboarding.test.tsx, apps/web/src/features/onboarding/hooks/onboarding-settings-sync.test.ts
      Change: Remove the production-named dead export `invalidateConfigGuardCache` (config-guard-cache.ts:8-10), which has zero production callers. Update the three test files that called it for module-state reset (config-guards.test.ts:36, use-onboarding.test.tsx:162, onboarding-settings-sync.test.ts:77) to reset state via `vi.resetModules()` + re-import instead. Keep `getConfiguredGuardCache` and `setConfiguredGuardCache` (both production-live). Do NOT edit `use-onboarding.ts`.
      Accept: `rg -w invalidateConfigGuardCache apps/web/src` returns nothing; the three tests reset cache state without the deleted export and pass; `pnpm --filter @diffgazer/web type-check` passes.

---

### Batch 4.J — files: apps/landing/src/content.ts

- [ ] T-414 (fixes F-089) — files: apps/landing/src/content.ts
      Change: Drop the `export` keyword from `interface ValueProp` (content.ts:18-21) so it is a module-local type annotating the local `VALUE_PROPS` const; it has no external importer.
      Accept: `ValueProp` is not exported; `apps/landing` type-check and tests pass.

---

### Batch 4.K — files: apps/docs/src/lib/styles.ts, apps/docs/src/lib/utils.ts, apps/docs/vite.config.ts, apps/docs/tsconfig.json

- [ ] T-415 (fixes F-087) — files: apps/docs/src/lib/styles.ts
      Change: Delete `apps/docs/src/lib/styles.ts` (single dead export `DOT_GRID_BG`, zero references repo-wide).
      Accept: `rg -w DOT_GRID_BG` repo-wide returns nothing; file does not exist; `apps/docs` type-check passes.

- [ ] T-433 (fixes F-086) — files: apps/docs/src/lib/utils.ts, apps/docs/vite.config.ts, apps/docs/tsconfig.json
      Change: Delete the dead grab-bag re-export `apps/docs/src/lib/utils.ts` (a one-line `export { cn } from "@diffgazer/ui/lib/utils"`) together with its `@/lib/utils` path alias in `vite.config.ts:131` and `tsconfig.json:28`. No `src/` file imports `@/lib/utils` — real consumers import `cn` straight from `@diffgazer/ui/lib/utils`; the only `@/lib/utils` consumers are the 642-file `apps/docs/registry/` mirror that Phase 5 (D5) deletes. SEQUENCING: this file + alias removal MUST land after, or atomically with, the Phase-5 mirror removal (otherwise the mirror's `@/lib/utils` imports break). If Phase 5 has not yet run when Phase 4 executes, defer only this single task to land in lockstep with the D5 mirror deletion; do the file delete + both alias removals in one commit at that point. Verify with `rg "@/lib/utils" apps/docs/src` (must be empty before removing the alias) — the mirror under `apps/docs/registry/` is the only place `@/lib/utils` may still appear, and it goes away in Phase 5.
      Accept: `apps/docs/src/lib/utils.ts` does not exist; the `@/lib/utils` alias is gone from `vite.config.ts` and `tsconfig.json`; `rg "@/lib/utils" apps/docs` returns nothing (mirror already removed); `apps/docs` build + type-check pass.

---

### Batch 4.L — files: libs/registry/src/index.ts, libs/registry/src/docs-data/utils.ts (split into docs-data/naming.ts + docs-data/hook-doc-loader.ts), libs/registry/src/docs-data/index.ts, libs/registry/src/utils/fs.ts, libs/registry/src/testing/docs-data.test.ts, libs/registry/src/cli/add-helpers.ts (split), libs/registry/src/cli/command-helpers.ts (split), libs/registry/src/cli/command-factories.ts, plus cli/add consumers of the split cli/ modules

- [ ] T-416 (fixes F-040) — files: libs/registry/src/docs-data/utils.ts, libs/registry/src/docs-data/naming.ts (new), libs/registry/src/docs-data/hook-doc-loader.ts (new), libs/registry/src/utils/fs.ts, libs/registry/src/docs-data/index.ts, libs/registry/src/index.ts, libs/registry/src/testing/docs-data.test.ts
      Change: Split the grab-bag `libs/registry/src/docs-data/utils.ts` by concept: (1) move `kebabToCamelCase`, `toDocExportName`, `toYamlString` into a new `libs/registry/src/docs-data/naming.ts`; (2) move `createHookDocLoader` together with its private helpers `assertSafeRelativeFileName`, `assertPathInsideRoot`, `isHookDoc`, the `HOOK_DOC_NAME` regex and the `HOOK_DOC_OPTIONAL_*` field arrays into a new `libs/registry/src/docs-data/hook-doc-loader.ts` (it imports `kebabToCamelCase`/`toDocExportName` from `./naming.js`, the `HookDoc` type from `./types.js`, and the logger from `../logger.js`); (3) relocate the generic `cleanDir(dir, ext)` into the existing `libs/registry/src/utils/fs.ts`. Delete `docs-data/utils.ts`. Update `docs-data/index.ts` re-exports, the public-entry re-exports in `libs/registry/src/index.ts`, and the imports in `libs/registry/src/testing/docs-data.test.ts` atomically (D7 lockstep — these symbols are on the public surface).
      Accept: `docs-data/utils.ts` does not exist; the five former exports resolve from their new homes; `rg "docs-data/utils" libs/registry` returns nothing; `pnpm --filter @diffgazer/registry type-check` and docs-data tests pass.

- [ ] T-417 (fixes F-128) — files: libs/registry/src/cli/add-helpers.ts, libs/registry/src/cli/command-helpers.ts, libs/registry/src/cli/command-factories.ts, new concept files under libs/registry/src/cli/, and the cli/add + workflows/ consumers of these symbols
      Change: Split the two grab-bag `-helpers` files by concept. From `add-helpers.ts`: `writeFilesWithRollback` + `formatWriteSummary` → `file-write-rollback.ts`; `showDryRunPreview` + `showDryRunDeps` → `dry-run-preview.ts`; `installDepsWithRollback` → `install-deps.ts`. From `command-helpers.ts`: `withErrorHandler` → `with-error-handler.ts`; `createRequireConfig` → `require-config.ts`; `parseEnumOption` → `parse-enum-option.ts`; `createInstallChecker` → `install-checker.ts`; `createItemAccessors` → `item-accessors.ts` (or fold the `create*` factory functions into the existing `command-factories.ts` if they share its concept — choose by whether each `create*` returns a command factory). Delete the two emptied `-helpers` files. Update every importer in `libs/registry/src/cli/`, `libs/registry/src/workflows/`, and any cli/add consumer to point at the new concept files. `command-factories.ts` itself is fine and only changes if `create*` functions are folded into it.
      Accept: `add-helpers.ts` and `command-helpers.ts` no longer exist; each former export resolves from its concept file; `rg "add-helpers|command-helpers" libs/registry cli/add` returns nothing; `pnpm --filter @diffgazer/registry type-check` and cli tests pass.

- [ ] T-418 (fixes F-091) — files: libs/registry/src/index.ts, libs/registry/package.json
      Change: Trim `libs/registry/src/index.ts` to only the symbols an external in-repo consumer actually imports. First run `rg "from \"@diffgazer/registry\"" apps cli libs --glob '!libs/registry/**'` to enumerate the real external import set, then drop the value/const/type re-exports that appear nowhere outside libs/registry (e.g. `ensurePublicRegistryReady`, `loadArtifactsFromPackage`, `validateManifest`, `generateDemoIndex`, `runShadcnRegistryBuild`, `ARTIFACT_MANIFEST_FILENAME`, internal-only schemas). Keep externally-consumed symbols including `highlightCode`, `findExamples`, `DOCS_CODE_THEME_NAME`. Internal modules and tests already import concrete files directly, so no internal-import rewrites are needed. Coordinate this trim with T-416/T-417 since all three edit `index.ts` — apply T-416 and T-417 re-export updates first, then trim. Re-grep every `from "@diffgazer/registry"` site after trimming to confirm zero breakage.
      Accept: every symbol still re-exported from `index.ts` has at least one consumer outside libs/registry; `pnpm --filter @diffgazer/registry type-check` and any downstream consumer type-check pass; `rg "from \"@diffgazer/registry\"" ` shows no unresolved import.

---

### Batch 4.M — files: libs/keys/src/dom/keyboard-utils.ts (split into dom/hotkey.ts + merge predicates), libs/keys/src/dom/focusable.ts (or the editable-predicate home), libs/keys/src/index.ts, libs/keys/public/r/registry.json, libs/keys/public/r/navigation.json, libs/keys/src/hooks/use-navigation.ts, libs/keys/src/providers/keyboard-provider.tsx; libs/keys/src/context/keyboard-context.ts; libs/keys/tsconfig.json; libs/keys/components.json; libs/keys/package.json; libs/keys/docs/api.md, libs/keys/docs/guides/, libs/keys/docs/design/

- [ ] T-419 (fixes F-132) — files: libs/keys/src/dom/keyboard-utils.ts, libs/keys/src/dom/hotkey.ts (new), libs/keys/src/dom/focusable.ts, libs/keys/src/index.ts, libs/keys/public/r/registry.json, libs/keys/public/r/navigation.json, libs/keys/src/hooks/use-navigation.ts, libs/keys/src/providers/keyboard-provider.tsx
      Change: Split the grab-bag `libs/keys/src/dom/keyboard-utils.ts`. Move the hotkey-string concern (`canonicalizeHotkey`, `matchesHotkey` and the `KEY_ALIASES`/`KNOWN_MODIFIERS`/`isMac` tables) into a new `libs/keys/src/dom/hotkey.ts`. Merge the element predicates (`isInputElement`, `isEditableElement`) into the existing editable/focusable concept file (`dom/focusable.ts` if it owns the editable-element predicates; otherwise the file that already exports the related editable-target helper). Delete `keyboard-utils.ts`. Update the `src/index.ts` re-export (was :56), the consumers `use-navigation.ts` and `keyboard-provider.tsx`, and — because keys ships a copy handoff — update `public/r/registry.json` and `public/r/navigation.json` file paths/targets in the same atomic commit (D7 lockstep). Run `pnpm run prepare:artifacts` so generated bundles reflect the new file names.
      Accept: `keyboard-utils.ts` does not exist; hotkey + predicate symbols resolve from their new homes; `public/r` JSON references the new paths and `validate:artifacts:check` passes; `pnpm --filter @diffgazer/keys type-check` and focused keys tests pass.

- [ ] T-420 (fixes F-151) — files: libs/keys/src/context/keyboard-context.ts, libs/keys/src/providers/keyboard-provider.tsx
      Change: Fix the inverted context/provider ownership (lockstep with the Phase-1 F-071 single-file-folder flatten, which moves both files to `src/` siblings — assume they are already flattened to `libs/keys/src/keyboard-context.ts` and `libs/keys/src/keyboard-provider.tsx`; adjust paths if the flatten did not land). Relocate the `createContext` objects `KeyboardRegistryContext` / `KeyboardScopeContext` and the `KeyboardContextValue` value type FROM `keyboard-provider.tsx` (currently :65-84) INTO `keyboard-context.ts`, so the contexts live alongside their consumer accessor hooks (`useKeyboardRegistryContext`, `useKeyboardScopeContext`, `useKeyboardContext`). Leave `keyboard-provider.tsx` holding only the `KeyboardProvider` component, importing the contexts and value type from `keyboard-context.ts`. Verify no import cycle is introduced (provider→context only). Note: this edits `keyboard-provider.tsx`, which T-419 (use-navigation/provider consumer update) and the Phase-3 keys barrel work also touch — sequence T-419 before T-420 within this batch, or fold both edits into one pass on the provider file.
      Accept: `keyboard-context.ts` owns the `createContext` objects + `KeyboardContextValue`; `keyboard-provider.tsx` imports them and exports only `KeyboardProvider`; no cycle; `pnpm --filter @diffgazer/keys type-check` and keyboard-provider/context tests pass.

- [ ] T-421 (fixes F-247, F-248) — files: libs/keys/tsconfig.json
      Change: Delete the dead `"src/cli"` entry from the `exclude` array (tsconfig.json:27) — no such directory exists in libs/keys. Delete the inert `paths` block `{ "@/*": ["./src/*"] }` (tsconfig.json:4-6) — no `@/` import specifier exists anywhere in libs/keys.
      Accept: tsconfig.json has no `src/cli` exclude and no `paths` block; `pnpm --filter @diffgazer/keys type-check` passes (project-references build unaffected).

- [ ] T-422 (fixes F-249) — files: libs/keys/components.json
      Change: Delete `libs/keys/components.json` — a vestigial shadcn UI-component config on a hooks-only package (every registry item is `registry:hook`); the build reads `registry/registry.json`, never this file, and nothing references it.
      Accept: file does not exist; `pnpm --filter @diffgazer/keys build:shadcn` (or `prepare:artifacts`) still produces the keys public registry; `validate:artifacts:check` passes.

- [ ] T-423 (fixes F-099, F-140) — files: libs/keys/package.json
      Change: In `libs/keys/package.json` delete the broken `"playground"` script (line 86, `pnpm --filter playground dev` — `playground` is not a workspace member) and delete the fully dead `"verify:registry-cleanup"` script (line 83, points at the nonexistent `../../apps/docs/scripts/verify-registry-cleanup.mjs`). Both are dead/broken per-package scripts with zero invokers; the working playground entry is the root `keys:playground`.
      Accept: neither script key exists in `libs/keys/package.json`; `rg "verify:registry-cleanup|filter playground" libs/keys` returns nothing; root `keys:playground` is unaffected.

- [ ] T-424 (fixes F-093, F-094) — files: libs/keys/docs/api.md, libs/keys/docs/guides/navigation.md, libs/keys/docs/guides/scopes.md, libs/keys/docs/guides/focus-zones.md, libs/keys/docs/design/playground-spec.md, libs/keys/docs/design/playground-research-prompt.md
      Change: Delete the stale duplicate bare-Markdown docs that the live Fumadocs MDX tree (`docs/content/`) shadows: `docs/api.md` and the whole `docs/guides/` folder (`navigation.md`, `scopes.md`, `focus-zones.md`). Also delete the unreferenced design scratch docs `docs/design/playground-spec.md` and `docs/design/playground-research-prompt.md` (recoverable from git, consistent with D8). Do NOT touch `docs/content/`, `internal-docs-manifest.json`, or `scripts/monorepo/artifacts/validation.mjs` — they reference only the live `docs/content` tree.
      Accept: `docs/api.md`, `docs/guides/`, and `docs/design/` no longer exist; `rg "docs/guides/|docs/api\.md|docs/design/" ` repo-wide returns nothing; keys docs build / `validate:artifacts:check` still pass against `docs/content`.

---

### Batch 4.N — files: libs/ui/registry/lib/focus.ts, libs/ui/registry/lib/testing/focus.test.ts, libs/ui/registry/lib/resolve-tab-target.ts, libs/ui/registry/lib/testing/resolve-tab-target.test.ts, libs/ui/registry/lib/testing/ui-three-path-readiness.test.ts, libs/ui/registry/registry.json, libs/ui/public/r/focus.json, libs/ui/public/r/resolve-tab-target.json, libs/ui/docs/content/utils/index.mdx, libs/ui/registry/examples/presence/, libs/ui/registry/examples/use-presence/, libs/ui/registry/examples/keyscope-copy-mode/, libs/ui/registry/examples/keyscope-package-mode/, libs/ui/scripts/build-docs-data.ts, libs/ui/test-setup.ts, libs/ui/registry/ui/pager/DESIGN.md, libs/ui/registry/ui/popover/DESIGN.md, libs/ui/prompts/

- [ ] T-425 (fixes F-008, F-009) — files: libs/ui/registry/lib/focus.ts, libs/ui/registry/lib/testing/focus.test.ts, libs/ui/registry/lib/resolve-tab-target.ts, libs/ui/registry/lib/testing/resolve-tab-target.test.ts, libs/ui/registry/lib/testing/ui-three-path-readiness.test.ts, libs/ui/registry/registry.json, libs/ui/public/r/focus.json, libs/ui/public/r/resolve-tab-target.json, libs/ui/docs/content/utils/index.mdx
      Change: Delete the two fully orphaned registry modules and their dead-only tests: `lib/focus.ts` + `lib/testing/focus.test.ts`, and `lib/resolve-tab-target.ts` + `lib/testing/resolve-tab-target.test.ts`. Remove the `focus` and `resolve-tab-target` items from `registry/registry.json` (focus ~2349-2360, resolve-tab-target ~2256-2267) and delete the committed `public/r/focus.json` and `public/r/resolve-tab-target.json`. Remove both from the `HIDDEN_ITEMS` list in `lib/testing/ui-three-path-readiness.test.ts` (:156 focus, :157 resolve-tab-target) and from `docs/content/utils/index.mdx:43`. These two findings share `registry.json`, `ui-three-path-readiness.test.ts`, and `docs/content/utils/index.mdx`, so do both in this single task. Lockstep per D7; run `pnpm run prepare:artifacts` afterward.
      Accept: the four source/test files and two public/r JSON files do not exist; `rg "lib/focus|resolve-tab-target|resolveTabTarget|FOCUSABLE_SELECTOR" libs/ui` returns nothing dead; `pnpm run validate:artifacts:check` and `pnpm --filter @diffgazer/ui type-check` pass.

- [ ] T-426 (fixes F-095) — files: libs/ui/registry/examples/presence/use-presence-basic.tsx, libs/ui/registry/examples/presence/use-presence-tooltip.tsx, libs/ui/registry/examples/use-presence/
      Change: Inline the two real example implementations from `examples/use-presence/use-presence-basic.tsx` and `examples/use-presence/use-presence-tooltip.tsx` into the same-named files under `examples/presence/` (overwriting the 3-line re-export stubs there), then delete the entire `examples/use-presence/` folder. The `presence` registry item discovers examples under `examples/presence/`, and `hook-docs/presence.ts` already references the `use-presence-basic`/`use-presence-tooltip` basenames, so keep those basenames and no docs change is needed.
      Accept: `examples/use-presence/` does not exist; `examples/presence/use-presence-basic.tsx` and `use-presence-tooltip.tsx` contain the real implementations (no re-export stub); `pnpm run prepare:artifacts` and docs-data build succeed; `validate:artifacts:check` passes.

- [ ] T-427 (fixes F-250) — files: libs/ui/registry/examples/keyscope-copy-mode/keyscope-copy-mode.tsx, libs/ui/registry/examples/keyscope-package-mode/keyscope-package-mode.tsx, libs/ui/scripts/build-docs-data.ts, libs/ui/registry/registry.json
      Change: Delete the two orphaned dead example folders `examples/keyscope-copy-mode/` and `examples/keyscope-package-mode/` (no matching registry item, no `companionExamples` reference, zero `rg keyscope` hits, stale "Keyscope" brand). No `registry.json` / `public/r` lockstep entry references them, so no JSON edit is required — but after deletion run the docs-data build (`build-docs-data.ts` via `prepare:artifacts`) to confirm example discovery still resolves cleanly. Verify by inspecting `build-docs-data.ts` example-discovery (`findExamples`) and `registry.json` that neither folder was referenced before deleting.
      Accept: both folders do not exist; `rg keyscope libs/ui` (excluding the deleted files) returns nothing; `pnpm run prepare:artifacts` / docs-data build succeed; `validate:artifacts:check` passes.

- [ ] T-428 (fixes F-098) — files: libs/ui/test-setup.ts
      Change: Delete the inert `// eslint-disable-next-line @typescript-eslint/no-explicit-any` comment at test-setup.ts:9 (Biome ignores ESLint directives; no ESLint exists in the repo). If the `any` genuinely needs suppression under Biome, replace it with `// biome-ignore lint/suspicious/noExplicitAny: jest-dom matcher augmentation`; otherwise just remove the line.
      Accept: no `eslint-disable` comment remains in test-setup.ts; `pnpm --filter @diffgazer/ui type-check` and UI tests pass; Biome check (where wired) is clean.

- [ ] T-429 (fixes F-173, F-096) — files: libs/ui/registry/ui/pager/DESIGN.md, libs/ui/registry/ui/popover/DESIGN.md, libs/ui/prompts/library-readiness-audit.md
      Change: Delete the two stale committed scratch docs `libs/ui/registry/ui/pager/DESIGN.md` and `libs/ui/registry/ui/popover/DESIGN.md` (only 2 of 49 component folders carry one, unreferenced, not in any registry.json item file list — so no handoff lockstep). Also delete the stale single-file `libs/ui/prompts/` folder (`library-readiness-audit.md`, the prompt that drove the now-stale 020/030 readiness-audit specs, zero live references). All recoverable from git history.
      Accept: the two DESIGN.md files and `libs/ui/prompts/` do not exist; `rg "DESIGN.md|library-readiness-audit" libs/ui` returns nothing referencing them; no package.json script / turbo task / source imported them; `pnpm --filter @diffgazer/ui type-check` and `validate:artifacts:check` pass.

---

### Batch 4.O — files: apps/docs/scripts/generate-sitemap.mjs → generate-sitemap.ts, apps/docs/scripts/generate-sitemap.d.mts, apps/docs/scripts/generate-sitemap.test.ts, apps/docs/package.json

- [ ] T-430 (fixes F-180) — files: apps/docs/scripts/generate-sitemap.mjs, apps/docs/scripts/generate-sitemap.ts (new), apps/docs/scripts/generate-sitemap.d.mts, apps/docs/scripts/generate-sitemap.test.ts, apps/docs/package.json
      Change: Convert `apps/docs/scripts/generate-sitemap.mjs` to `apps/docs/scripts/generate-sitemap.ts` (run via tsx, matching the other docs/scripts entrypoints) and delete the hand-written declaration sidecar `generate-sitemap.d.mts`. Update the colocated `generate-sitemap.test.ts` import from `./generate-sitemap.mjs` to the `.ts` module, and update any `package.json` script that invokes `generate-sitemap.mjs` to call the `.ts` via tsx.
      Accept: `generate-sitemap.mjs` and `generate-sitemap.d.mts` do not exist; the test imports the `.ts` directly with no manual declaration; the sitemap-generation script still runs; `apps/docs` type-check and the generate-sitemap test pass.

---

### Batch 4.P — files: cli/add/scripts/copy-docs-artifacts.ts

- [ ] T-431 (fixes F-197) — files: cli/add/scripts/copy-docs-artifacts.ts
      Change: Delete the dead build script `cli/add/scripts/copy-docs-artifacts.ts` (zero invokers; superseded by the sibling `copy-generated.ts` which the build and `prepare:library-artifacts` actually run). No script-wiring change is needed since nothing references it.
      Accept: file does not exist; `rg copy-docs-artifacts` repo-wide returns nothing; `pnpm --filter @diffgazer/add build` and root `prepare:library-artifacts` still produce `dist/generated` via `copy-generated.ts`.

---

### Batch 4.Q — files: scripts/monorepo/check-invariants.mjs

- [ ] T-432 (fixes F-198) — files: scripts/monorepo/check-invariants.mjs
      Change: Delete the dead `--json` flag plumbing: remove line 184 (`const jsonOut = process.argv.includes("--json")`) and the entire `if (jsonOut) { writeFileSync("docs/migration/014-monorepo-restructure/invariant-check-results.json", ...) }` block (~382-387). No caller passes `--json`, and the target `docs/migration/` path does not exist / is gitignored.
      Accept: `rg "jsonOut|docs/migration|--json" scripts/monorepo/check-invariants.mjs` returns nothing; `pnpm run verify:monorepo` runs clean (invariant check unaffected).

---

### Phase exit

All gates run in the D7 / refactor-verification order; broaden as blast radius crosses packages. Because this phase touches the libs/ui + libs/keys public registry handoff (T-419, T-425, T-426, T-427, T-422, T-429) and the docs build (T-415, T-430), the artifact gates are mandatory in addition to the always-on type-check + test gates:

1. `DIFFGAZER_SKIP_ARTIFACT_PREPARE=1 pnpm exec turbo run type-check` — green across all workspaces (project references make any boundary/import breakage from a deleted export or moved file a hard error).
2. `DIFFGAZER_SKIP_ARTIFACT_PREPARE=1 pnpm exec turbo run test` — FULL suite (not `--affected`); confirms the deleted dead tests, rewritten cache-reset tests (T-413), rewritten per-lens rubric test (T-405), and the keys context/provider split (T-420) all pass.
3. `pnpm run prepare:artifacts` then `pnpm run validate:artifacts:check` — confirms the keys/ui registry splits and deletions (keyboard-utils split, focus / resolve-tab-target / keyscope / use-presence example removals, components.json removal) keep `public/r` consistent and no `public/r` item references a deleted/`.test.` path.
4. `DIFFGAZER_SMOKE_STRICT_SKIPS=1 pnpm run smoke` — required because cli/diffgazer (server launchers, keyboard provider), cli/server (review/ai/settings libs), cli/add (build script), and the web/docs builds were edited; validates the bundled offline catalog snapshot.
5. `pnpm run verify:monorepo` — confirms invariants (incl. the keys exports baseline and the trimmed check-invariants.mjs from T-432) still hold.
6. `git diff --check` — no whitespace/conflict-marker errors before handoff.


---

## Phase 5 — Docs-mirror removal (D5) + docs build rework

This phase sits here because it depends on the libs/ui public `exports` subpath surface being final (no further component renames after the earlier library/registry phases): every rewritten docs import targets a concrete `@diffgazer/ui/components/<c>` / `@diffgazer/ui/hooks/<h>` subpath, so the package contract must already be settled. It removes the largest known structure issue (the gitignored 642-file `apps/docs/registry/` mirror plus its sibling materialized facets) and reworks the artifact-sync pipeline that produced them, then folds in the docs-build-dependent content dedup (dgadd CLI docs, theme intro) that only makes sense once docs consume the real package.

Binding decision: D5 (REMOVE the apps/docs mirror; docs must consume `@diffgazer/ui` source directly). The mirror is consumed ONLY through the `@/components/ui/*` alias and the single `@/hooks/use-active-heading` import — verified: no docs `src/` file imports any registry-resolved `@/lib/*` alias (`@/lib/*` source imports all resolve to `apps/docs/src/lib/*` via the catch-all `@` → `./src` and stay untouched). `@diffgazer/ui` is already a `workspace:*` dependency of `apps/docs` and exposes a granular `exports` subpath for every consumed component/hook (verified 1:1 in `libs/ui/package.json`).

Batch 5.A is a single coupled batch (not three parallel ones) because F-003, F-143, and F-212 all edit the same three shared files — `scripts/monorepo/artifacts/sync.mjs`, `apps/docs/.gitignore`, and (5.A.1/5.A.2) `apps/docs/src/index.css` — and the registry, styles, and library-assets trees are all materialized by one pipeline; removing one mirror while leaving the others strands orphaned sync/validation code. Batch 5.C (theme intro dedup) touches only `libs/ui/docs/content/theme/`, disjoint from 5.A and 5.B, so it is parallel-safe with both. **Batch 5.B (CLI docs dedup) is NOT parallel-safe against 5.A: T-508 also conditionally edits `scripts/monorepo/artifacts/sync.mjs` (the same file 5.A's T-503/T-505 rework). Run Batch 5.B AFTER Batch 5.A** so its `cli/`-content sync reconciliation lands on the final, reworked `sync.mjs`. 5.B and 5.C may run in parallel with each other (disjoint content subtrees).

Follow D7 lockstep: any change touching the public registry/docs handoff updates source, `public/r` JSON, generated bundles, docs, examples, and consumers atomically, and the tree must compile between commits. Keep `prepare:artifacts` + `validate:artifacts:check` green (registry-handoff verification).

### Batch 5.A — files: apps/docs/vite.config.ts, apps/docs/registry/ (delete), apps/docs/registry/tsconfig.json (delete), apps/docs/src/**/*.{ts,tsx} (~40 import rewrites), apps/docs/src/index.css, apps/docs/styles/ (delete), apps/docs/.gitignore, scripts/monorepo/artifacts/sync.mjs, scripts/monorepo/artifacts/validation.mjs, libs/registry/src/docs/sync-operations.ts, libs/keys/docs/assets/ (delete), libs/keys/internal-docs-manifest.json

This batch is sequential-internal (tasks share `sync.mjs`, `.gitignore`, `index.css`); execute T-501 → T-507 in order on one branch. It is parallel-safe relative to Batch 5.C. Batch 5.B shares `scripts/monorepo/artifacts/sync.mjs` with this batch (T-508 step 5), so **Batch 5.B runs AFTER 5.A**, not in parallel with it.

- [ ] T-501 (fixes F-003) — files: apps/docs/src/**/*.{ts,tsx} (the ~40 files listed below)
      Change: Rewrite every `@/components/ui/*` import and the single `@/hooks/*` import in `apps/docs/src` to the matching `@diffgazer/ui` subpath, using ts-morph (per D7 cross-package codemod rule), NOT find/replace by hand. Mapping rules, applied to the verified import set:
        - `@/components/ui/<comp>/<comp>` → `@diffgazer/ui/components/<comp>` (e.g. `@/components/ui/button/button` → `@diffgazer/ui/components/button`, `@/components/ui/typography/typography` → `@diffgazer/ui/components/typography`, `@/components/ui/spinner/spinner` → `@diffgazer/ui/components/spinner`, `@/components/ui/section-header/section-header`, `@/components/ui/scroll-area/scroll-area`, `@/components/ui/card/card`, `@/components/ui/divider/divider`, `@/components/ui/input/input`, `@/components/ui/kbd/kbd`, `@/components/ui/logo/logo`, `@/components/ui/code-block` → `@diffgazer/ui/components/code-block`).
        - `@/components/ui/<comp>` (no second segment) → `@diffgazer/ui/components/<comp>` (e.g. `@/components/ui/toast`, `@/components/ui/tabs`, `@/components/ui/accordion`, `@/components/ui/breadcrumbs`, `@/components/ui/callout`, `@/components/ui/empty-state`, `@/components/ui/toc`, `@/components/ui/icons`, `@/components/ui/command-palette`, `@/components/ui/select`, `@/components/ui/sidebar`, `@/components/ui/panel`, `@/components/ui/badge`, `@/components/ui/pager`).
        - `@/hooks/use-active-heading` → `@diffgazer/ui/hooks/active-heading` (drops the `use-` prefix per the `@diffgazer/ui` exports map; only one source hit: `apps/docs/src/components/toc.tsx`).
        Do NOT touch `@/lib/*` imports (they resolve to `apps/docs/src/lib/*`) or the `@` catch-all. Exact files to edit (verified consumers): components/breadcrumbs.tsx, components/content-spinner.tsx, components/copy-button.tsx, components/demo-preview.tsx, components/docs-mdx/blocks/accessibility-notes.tsx, components/docs-mdx/blocks/api-reference.tsx, components/docs-mdx/blocks/consumption-block.tsx, components/docs-mdx/blocks/examples.tsx, components/docs-mdx/blocks/keyboard-nav.tsx, components/docs-mdx/blocks/notes.tsx, components/docs-mdx/blocks/source-viewer-block.tsx, components/docs-mdx/blocks/steps.tsx, components/docs-mdx/blocks/usage-snippet.tsx, components/docs-mdx/doc-data-context.tsx, components/docs-mdx/markdown-renderers.tsx, components/docs-not-found.tsx, components/docs-page.tsx, components/hook-source.tsx, components/not-found-state.tsx, components/not-found.tsx, components/parameter-table.tsx, components/preview-inset-pane.tsx, components/props-table.tsx, components/source-viewer.tsx, components/toc.tsx, features/home/components/home-view.tsx, features/home/components/quick-start-card.tsx, features/home/components/search-hero.tsx, features/search/components/search-dialog.tsx, features/theme/components/color-grid.tsx, features/theme/components/css-output.tsx, features/theme/components/diffgazer-preview.tsx, features/theme/components/preview-panel.tsx, features/theme/components/theme-playground.tsx, layouts/footer.tsx, layouts/header.tsx, layouts/sidebar.tsx, lib/cross-deps-data.ts, routes/__root.tsx, routes/$lib/$.tsx, types/docs-data.ts.
      Accept: `rg -n "@/components/ui|@/hooks/" apps/docs/src --glob '!**/generated/**'` returns zero hits; `pnpm --filter @diffgazer/docs type-check` passes.

- [ ] T-502 (fixes F-003) — files: apps/docs/vite.config.ts, apps/docs/registry/ (delete recursively), apps/docs/registry/tsconfig.json (delete), apps/docs/src/index.css
      Change: Delete the entire gitignored `apps/docs/registry/` tree (the 642-file libs/ui mirror) including `apps/docs/registry/tsconfig.json`. In `apps/docs/vite.config.ts`: remove `"./registry/tsconfig.json"` from the `viteTsConfigPaths({ projects: [...] })` array (line 25), leaving only `"./tsconfig.json"`; delete the entire `resolve.alias` block for the registry mirror — the `@/components/ui`, `@/hooks`, and all `@/lib/*` registry entries (aria-utils, compose-refs, selectable-collection, selectable-variants, segmented-variants, sidebar-variants, sidebar-intent, stepper-variants, input-variants, resolve-tab-target, search, step-status, focus, typeahead, diff) plus `@/lib/utils` → `src/lib/utils` (lines 79–132). KEEP `@diffgazer/keys` (line 133) and the `@` → `./src` catch-all (line 134) and `dedupe`. In `apps/docs/src/index.css` remove the three registry `@source` directives `@source "../registry/ui";`, `@source "../registry/hooks";`, `@source "../registry/examples";`, `@source "../registry/lib";` (T-503 handles the `styles` lines). Verify `apps/docs/src/lib/utils.ts` then has no remaining consumer; if F-086 (dead `src/lib/utils.ts`) is not owned by another phase, leave a note rather than deleting outside scope.
      Accept: `apps/docs/registry/` does not exist; `rg -n "registry/tsconfig|registry/ui|registry/hooks|@/components/ui|@/lib/utils" apps/docs/vite.config.ts` returns zero hits; `pnpm --filter @diffgazer/docs type-check` passes and the docs dev/build resolves UI imports from `@diffgazer/ui`.

- [ ] T-503 (fixes F-143) — files: apps/docs/styles/ (delete), apps/docs/src/index.css, apps/docs/.gitignore, scripts/monorepo/artifacts/sync.mjs
      Change: Delete the materialized `apps/docs/styles/` directory (gitignored copy of libs/ui theme CSS: styles.css, theme.css, theme-base.css, sources.css). In `apps/docs/src/index.css` replace `@import "../styles/styles.css";` with the package-entry imports `@import "@diffgazer/ui/sources.css";` then `@import "@diffgazer/ui/styles.css";` (matching `apps/docs/src/lib/consumption-metadata.ts:139` and `libs/ui/docs/content/getting-started/tailwind-setup.mdx`); keep the leading `@import "tailwindcss";`. In `scripts/monorepo/artifacts/sync.mjs` remove the primary-styles materialization codepath: delete `getMaterializedPrimaryStylesContent` (≈116–135), `materializePrimaryStylesFromArtifact` (≈137–141) and its call site, and `collectPrimaryStyleErrors` plus its invocation in `collectArtifactOutputParityErrors` (line ≈334); remove `"styles/styles.css"` from the `requiredRootFiles` array (line ≈378). In `apps/docs/.gitignore` delete the `styles/` line (currently line 13). If `getRegistryCssFilePaths` becomes unused after removing the styles codepath, delete it too.
      Accept: `apps/docs/styles/` does not exist; `rg -n "styles/styles.css|materializePrimaryStyles|getMaterializedPrimaryStyles|collectPrimaryStyleErrors" scripts/monorepo/artifacts/sync.mjs` returns zero hits; `rg -n "@import \"@diffgazer/ui" apps/docs/src/index.css` shows the two package CSS imports; `rg -n "^styles/$" apps/docs/.gitignore` returns nothing.

- [ ] T-504 (fixes F-212) — files: libs/keys/docs/assets/ (delete), libs/keys/internal-docs-manifest.json, scripts/monorepo/artifacts/sync.mjs, scripts/monorepo/artifacts/validation.mjs, libs/registry/src/docs/sync-operations.ts, apps/docs/.gitignore
      Change: Delete `libs/keys/docs/assets/keys-wordmark.svg` and the now-empty `libs/keys/docs/assets/` folder (the SVG is copied to the gitignored `apps/docs/public/library-assets/keys/` but has zero render references anywhere in repo source). Remove the `"assetsDir": "docs/assets"` key from `libs/keys/internal-docs-manifest.json` so keys matches `libs/ui/internal-docs-manifest.json` (which has no `assetsDir`). `assetsDir` is already `.optional()` in `libs/registry/src/manifest.ts` — keep the generic optional support so the schema is unchanged; the `collectAssetOutputErrors` branch in `scripts/monorepo/artifacts/sync.mjs` (≈172–189) and the `manifest.docs.assetsDir` branch in `scripts/monorepo/artifacts/validation.mjs` (≈261–265) early-return on absent `assetsDir` and become no-ops — leave them as generic optional support unless `libs/registry/src/docs/sync-operations.ts` has a keys-specific assets path that is now dead, in which case remove only the keys-specific dead branch. In `apps/docs/.gitignore` remove the `public/library-assets/` line (currently line 14) since no enabled library now materializes assets.
      Accept: `libs/keys/docs/assets/` does not exist; `rg -n "assetsDir" libs/keys/internal-docs-manifest.json` returns nothing; `rg -n "keys-wordmark|library-assets|assets/keys" apps/docs libs/keys libs/ui --glob '!**/.output/**' --glob '!**/dist/**' --glob '!**/generated/**'` returns zero hits; `pnpm --filter @diffgazer/registry type-check` passes.

- [ ] T-505 (fixes F-003, F-143, F-212) — files: scripts/monorepo/artifacts/sync.mjs, scripts/monorepo/artifacts/validation.mjs, apps/docs/.gitignore
      Change: After T-501–T-504, reconcile the artifact-sync pipeline so the registry mirror itself is no longer materialized or validated. In `scripts/monorepo/artifacts/sync.mjs` remove the primary registry-source mirror logic that writes/validates `apps/docs/registry/` — `createPrimaryRegistryOutputFilter`, `collectPrimarySourceRegistryErrors` and its call (line ≈333), the `registry/examples` secondary-example sync (`collectSecondaryExampleErrors`, ≈260–278) and `rewriteSecondaryDemoIndexImports` (≈280–290) if they exist only to feed `apps/docs/registry/`, and the `"registry/registry.json"` entry in `requiredRootFiles` (line ≈377). Remove the matching registry-mirror parity checks in `scripts/monorepo/artifacts/validation.mjs`. In `apps/docs/.gitignore` remove the `registry/` line (line 12) and the `content/docs/components/` line if it referenced the mirror only. Keep all `public/r/<lib>` and `content/docs/<lib>` sync intact (the legitimate docs-content + public-registry handoff, unrelated to the source mirror). Do NOT remove generic optional branches still used by `public/r` or `content/docs` parity.
      Accept: `rg -n "docsRoot, \"registry\"|registry/registry.json|createPrimaryRegistryOutputFilter|collectPrimarySourceRegistryErrors" scripts/monorepo/artifacts/sync.mjs` returns zero hits; `rg -n "^registry/$" apps/docs/.gitignore` returns nothing; `pnpm run prepare:artifacts` then `pnpm run validate:artifacts:check` both pass (no orphaned-output or missing-output errors for registry/styles/assets).

- [ ] T-506 (fixes F-003) — files: apps/docs (build verification only, no edits)
      Change: Verify the docs app builds and prerenders end-to-end with zero dependency on the removed mirror by running the docs build path. If the build surfaces any residual `@/components/ui` / `@/hooks` / `../registry` / `../styles` reference missed by T-501–T-505, fix it in place (own the failure, do not defer).
      Accept: `pnpm --filter @diffgazer/docs build` (or the repo's configured docs build script) completes without unresolved-import errors; no `apps/docs/registry/` or `apps/docs/styles/` directory is recreated by the build.

- [ ] T-507 (fixes F-143, F-212) — files: scripts/monorepo/artifacts/* (verification only)
      Change: Confirm the trimmed sync pipeline has no dead exports left behind after T-503/T-504/T-505 (e.g. helper functions whose only callers were the deleted styles/assets/registry-mirror paths). Remove any such now-orphaned function in its defining file. This guards against leaving the same orphaned-pipeline smell the findings flagged.
      Accept: `rg` for each deleted function name across `scripts/monorepo/artifacts/` and `libs/registry/src/docs/` returns zero references; `pnpm run validate:artifacts:check` passes.

### Batch 5.B — files: libs/ui/docs/content/cli/ (delete 7), libs/keys/docs/content/cli/ (delete 7), canonical dgadd CLI corpus (new), libs/ui/docs/content/meta.json, libs/keys/docs/content/meta.json, apps/docs/config/docs-libraries.json, scripts/monorepo/artifacts/sync.mjs (conditional cli/-content sync reconciliation, step 5 — shared with Batch 5.A)

**Runs AFTER Batch 5.A** (NOT parallel-safe against it): T-508 step 5 conditionally edits `scripts/monorepo/artifacts/sync.mjs`, the same pipeline file 5.A's T-503/T-505 rework — so 5.B must land its `cli/`-content sync change on 5.A's final `sync.mjs`. Apart from that shared file, 5.B owns only `docs/content/cli/` + the docs-libraries/meta config. **Disjoint from Batch 5.C** (theme content), so 5.B and 5.C may run in parallel with each other once 5.A is done.

- [ ] T-508 (fixes F-176) — files: libs/ui/docs/content/cli/{index,init,add,list,diff,remove}.mdx + meta.json (delete 7), libs/keys/docs/content/cli/{index,init,add,list,diff,remove}.mdx + meta.json (delete 7), new canonical corpus, libs/ui/docs/content/meta.json, libs/keys/docs/content/meta.json, apps/docs/config/docs-libraries.json, scripts/monorepo/artifacts/sync.mjs
      Change: The dgadd installer reference is currently duplicated as two near-identical 6-mdx sets (`cli/meta.json` is byte-identical between ui and keys; per-page diffs of 30–65 lines that will drift). Author it ONCE in the dgadd-owning side and surface it once:
        1. Create a single canonical CLI reference set (index, init, add, list, diff, remove + meta.json) with namespace-agnostic examples (`dgadd add <namespace>/<item>`, not `ui/`- or `keys/`-specific). Place it where the docs site can source it without a library mirror: because `cli/add`/`libs/registry` are NOT docs artifacts (no `internal-docs-manifest.json`, absent from `apps/docs/config/docs-libraries.json`), surface it under the existing content-only `app` (diffgazer) docs library — author the corpus at `apps/docs/content/docs/app/cli/` (the `app` library already has no `artifactSource`, so its content is authored directly in the docs app) and add `"...cli"` (or an explicit `cli` group) to the `app` library's content `meta.json`. If a reviewer instead wants it sourced from a workspace, the alternative is to add an `internal-docs-manifest.json` + `docs/content/cli/` to `cli/add` and register it as a new disabled-by-default docs library — but the `app`-section path is the minimal change and requires no new artifact.
        2. Delete all 7 files under `libs/ui/docs/content/cli/` and all 7 under `libs/keys/docs/content/cli/`.
        3. Remove the `---CLI---` / `...cli` entries from `libs/ui/docs/content/meta.json` and `libs/keys/docs/content/meta.json`.
        4. Keep ONLY genuinely library-specific dgadd guidance as a short "Installing via dgadd" callout inside each library's `getting-started/installation.mdx` (keys: standalone-vs-package-only hook distinction; ui: component-namespace examples), each linking to the canonical reference.
        5. Update `scripts/monorepo/artifacts/sync.mjs` only if it currently syncs a per-library `cli/` content subtree that no longer exists (so removed `cli/` folders do not trip a missing/parity error).
      Accept: `libs/ui/docs/content/cli/` and `libs/keys/docs/content/cli/` do not exist; exactly one CLI reference set exists in the repo; `rg -l "dgadd init" libs/ui/docs libs/keys/docs apps/docs/content` shows the canonical set plus at most the two short install callouts; `pnpm run prepare:artifacts` then `pnpm run validate:artifacts:check` pass; the docs site renders one CLI section.

### Batch 5.C — files: libs/ui/docs/content/theme/index.mdx, libs/ui/docs/content/theme/overview.mdx (delete), libs/ui/docs/content/theme/meta.json

Disjoint from Batches 5.A and 5.B (only the theme content folder). Parallel-safe.

- [ ] T-509 (fixes F-206) — files: libs/ui/docs/content/theme/index.mdx, libs/ui/docs/content/theme/overview.mdx (delete), libs/ui/docs/content/theme/meta.json
      Change: `theme/index.mdx` (section landing, has the "In this section" nav table) and `theme/overview.mdx` open with the same two-layer-variable explanation. Consolidate to one canonical intro: KEEP `index.mdx` as the section landing and move the unique architectural content from `overview.mdx` (Variable Architecture `<VariableDiagram />`, Theme Playground `<ThemePlayground />`, Cascade Layers, Surface Elevation, Z-Index Scale, Floating surface animation tokens) into `index.mdx` (or into the most appropriate existing subpage — colors/typography/dark-mode — where it topically belongs), then DELETE `overview.mdx`. Remove `"overview"` from the `pages` array in `libs/ui/docs/content/theme/meta.json` (currently `["index","overview","colors","typography","dark-mode","diffgazer"]` → `["index","colors","typography","dark-mode","diffgazer"]`) and drop the `[Overview](/ui/theme/overview)` row from the "In this section" table in `index.mdx`. Ensure the "two-layer variable system" explanation appears exactly once.
      Accept: `libs/ui/docs/content/theme/overview.mdx` does not exist; `rg -n "two-layer" libs/ui/docs/content/theme/` matches in exactly one file; `rg -n "overview" libs/ui/docs/content/theme/meta.json` returns nothing; no surviving theme page links to `/ui/theme/overview`; `pnpm run prepare:artifacts` then `pnpm run validate:artifacts:check` pass.

### Phase exit

All gates below must pass before the phase is considered done (this phase touches the registry/docs/public handoff and the docs build, so artifact + smoke gates apply per the registry-handoff verification):

- `DIFFGAZER_SKIP_ARTIFACT_PREPARE=1 pnpm exec turbo run type-check` (full — project references make any unresolved `@diffgazer/ui` subpath or docs boundary breakage a hard error).
- `DIFFGAZER_SKIP_ARTIFACT_PREPARE=1 pnpm exec turbo run test` (full suite, not `--affected`).
- `pnpm run prepare:artifacts` then `pnpm run validate:artifacts:check` (mandatory: the artifact-sync pipeline was reworked; this proves no orphaned/missing registry, styles, or library-assets outputs and that `public/r` + `content/docs` handoff parity still holds).
- `pnpm --filter @diffgazer/docs build` (docs app builds and prerenders with zero dependency on the removed `registry/`/`styles/` mirrors).
- `DIFFGAZER_SMOKE_STRICT_SKIPS=1 pnpm run smoke` (docs/registry handoff + CLI consumption paths unaffected).
- `pnpm run verify:monorepo`.
- `git diff --check`.


---

## Phase 6 — Dependency hygiene (manifests)

Sits here because every code move/rename (Phases 1–2), barrel dissolution (Phase 3), dead-code deletion (Phase 4), and docs-mirror removal (Phase 5) is already settled: the source tree is in its final shape, so the `package.json` / manifest edits in this phase (unused/phantom deps, dev-vs-prod misclassification, version-floor drift, peer-dependency contracts, missing workspace edges, changeset/dependabot coverage) land on stable import graphs and cannot be invalidated by a later relocation. It precedes Phase 7 (enforcement wiring) because `knip`/`dependency-cruiser`/`sherif` should be wired only after the dependency graph is already clean, otherwise they fire on the very drift this phase removes.

### Parallelism note (READ FIRST — this phase is NOT freely parallel-safe)

This is a manifest-only phase and the manifests are pervasively shared: `libs/ui/package.json` is touched by 9 of the 24 findings, root `package.json` by 8, `apps/web/package.json`/`apps/docs/package.json`/`cli/diffgazer/package.json` by 6 each, and `PACKAGE_GOVERNANCE.md`/`libs/core/package.json`/`libs/keys/package.json` by 4–5 each. Keeping each finding whole, all 24 findings form a **single connected component over shared files**, and every batch ultimately funnels into one `pnpm install` lockfile regeneration. Therefore the batches below are concern-grouped for review clarity but **MUST run sequentially in the order 6.A → 6.B → 6.C → 6.D**, not concurrently. Each batch's "files" list is the set it edits; the cross-batch sharing (`libs/ui/package.json`, root `package.json`, `PACKAGE_GOVERNANCE.md`, `cli/diffgazer/package.json`, `libs/keys/package.json`, `cli/add/package.json`, `cli/server/package.json`, `libs/core/package.json`, `apps/web/package.json`, `apps/docs/package.json`, `libs/registry/package.json`, `pnpm-workspace.yaml`, `scripts/monorepo/check-invariants.mjs`) is exactly why ordering matters: a later batch must re-read the manifest the earlier batch left. Run `pnpm install` (lockfile regen) ONCE, at the end of the phase, after all four batches are applied — see Phase exit. Within a single batch, a worker edits the listed manifests directly; do not split one finding across batches.

Note on AGENTS.md Dependency Policy: this phase adds NO new production dependencies — it only removes dead/phantom deps, re-classifies build-only deps to `devDependencies`, re-classifies always-co-required deps to `peerDependencies`, aligns version floors, and adds workspace/coverage metadata. Each task states the placement justification inline. The only `dependencies`→`devDependencies` move (F-229 figlet) and the only `dependencies`→`peerDependencies` moves (F-232 react-query, F-234 keys) are justified per the policy as correcting misclassification, not adding surface.

---

### Batch 6.A — files: root `package.json`, `turbo.json`, `.changeset/config.json`, `libs/registry/package.json` (drift against the root override is read here but registry's typescript range is the registry-owned edit), `cli/diffgazer/package.json` (its `@diffgazer/web` workspace edge + the turbo edge collapse)

Root-level dead deps, the changeset/turbo single-source-of-truth fixes, and the cli/diffgazer→web build edge. These are the least-entangled with the published-library surface.

- [ ] T-601 (fixes F-166) — files: `package.json`
      Change: Remove the line `"next": "^16.2.6"` from the root `package.json` `devDependencies` block. Do NOT touch `postcss` (`^8.5.14`) or `@tailwindcss/postcss` (`^4.3.0`) — they remain referenced by the root pnpm store / smoke fixtures; only `next` is the unreferenced dead root devDependency (smoke fixtures install their own `next@^16.2.0` copy into temp dirs).
      Accept: `grep -c '"next"' package.json` returns 0; `rg "from ['\"]next" --glob '!**/node_modules/**'` returns no source hits; `pnpm install` succeeds and the lockfile no longer pins root `next`.

- [ ] T-602 (fixes F-219) — files: `package.json`, `.changeset/config.json`
      Change: Remove the line `"@changesets/changelog-git": "^0.2.1"` from root `package.json` `devDependencies`. Leave `@changesets/changelog-github` (`^0.6.0`) and `@changesets/cli` intact, and confirm `.changeset/config.json` still wires `"changelog": ["@changesets/changelog-github", { "repo": "b4r7x/diffgazer" }]` (no edit to config.json needed — it is listed only to confirm `changelog-git` is not the active plugin).
      Accept: `rg "changelog-git" --glob '!pnpm-lock.yaml'` returns zero matches; `.changeset/config.json` still references `@changesets/changelog-github`; `pnpm install` succeeds.

- [ ] T-603 (fixes F-205) — files: `libs/registry/package.json`, `package.json`
      Change: In `libs/registry/package.json`, change the `typescript` devDependency range from `^5.9.0` to `^5.9.3` (matching all nine sibling workspaces). Do NOT add `typescript` to the root `pnpm.overrides` block (that is an optional hardening left to Phase 7 enforcement; `package.json` is listed only to confirm typescript is intentionally absent from overrides today).
      Accept: `rg '"typescript"' libs/registry/package.json` shows `^5.9.3`; `rg '"typescript": "\^5\.9\.0"' --glob '**/package.json'` returns zero matches repo-wide; `pnpm install` succeeds.

- [ ] T-604 (fixes F-238) — files: `package.json`, `turbo.json`
      Change: Decide on `@vitest/coverage-v8` (root `package.json` `devDependencies`, currently `^4.1.0`). Default action: remove the `@vitest/coverage-v8` devDependency AND remove the now-orphan `"outputs": ["coverage/**"]` aspiration from the relevant `turbo.json` task (line ~27) since no script runs `vitest --coverage` and no `vitest.config.ts` enables `test.coverage`. (If the owner wants coverage instead, the alternative is to keep the dep and add a `test:coverage` script + vitest `coverage` config — but absent that, remove both the dep and the dead turbo output.)
      Accept: `rg "coverage-v8" --glob '!pnpm-lock.yaml'` returns zero matches; `rg "coverage" turbo.json` returns zero matches; `pnpm install` succeeds and `turbo run test` still passes.

- [ ] T-605 (fixes F-174) — files: `cli/diffgazer/package.json`, `turbo.json`
      Change: Add `"@diffgazer/web": "workspace:*"` to `cli/diffgazer/package.json` `devDependencies` (devDependencies is correct — the web SPA is a build-time embed producing bundled output under `cli/diffgazer/dist/web`, not an importable runtime package, per AGENTS.md dependency policy). Then remove the now-redundant explicit `"@diffgazer/web#build"` entry from the `"diffgazer#build"` task's `dependsOn` array in `turbo.json` (line ~19), leaving only `"^build"` — the new package-graph edge orders the web build naturally.
      Accept: `rg '"@diffgazer/web"' cli/diffgazer/package.json` shows the workspace edge in devDependencies; `turbo.json` `diffgazer#build.dependsOn` no longer contains `@diffgazer/web#build`; `pnpm install` succeeds and `turbo run build --filter=diffgazer` still builds the web SPA before the binary (verify `cli/diffgazer/dist/web` is produced).

---

### Batch 6.B — files: `libs/keys/artifacts/package.json`, `libs/keys/examples/playground/package.json`, `.changeset/config.json`, `.github/dependabot.yml`, `pnpm-workspace.yaml`, `scripts/monorepo/check-invariants.mjs`

Nested-workspace coverage/governance metadata: the keys-artifacts/playground enumeration gaps in changeset-ignore and dependabot. `.changeset/config.json` overlaps Batch 6.A (T-602) — run 6.A first, then re-read config.json here.

- [ ] T-606 (fixes F-196) — files: `.changeset/config.json`, `libs/keys/artifacts/package.json`
      Change: Add `"@diffgazer/keys-artifacts"` to the `ignore` array in `.changeset/config.json` so the ignore list is the complete enumeration of all seven private workspaces (it currently lists 6: `@diffgazer/core`, `/registry`, `/server`, `/web`, `/docs`, `/landing` and omits the 7th, the nested keys-artifacts publisher helper). `libs/keys/artifacts/package.json` is listed only to confirm the exact private package name (`name` field) to add; do not edit it in this task.
      Accept: `.changeset/config.json` `ignore` array contains `"@diffgazer/keys-artifacts"` and the name matches `libs/keys/artifacts/package.json`'s `name` field exactly; `pnpm changeset status` (or `pnpm exec changeset version --snapshot` dry equivalent) does not attempt to version the keys-artifacts workspace.

- [ ] T-607 (fixes F-221) — files: `.github/dependabot.yml`, `pnpm-workspace.yaml`, `scripts/monorepo/check-invariants.mjs`, `libs/keys/artifacts/package.json`, `libs/keys/examples/playground/package.json`
      Change: In `.github/dependabot.yml`, extend the npm ecosystem `directories` list (currently `/`, `/apps/*`, `/cli/*`, `/libs/*`) to also cover the two two-level-deep nested workspaces that the single-level globs miss: add `"/libs/keys/artifacts"` and `"/libs/keys/examples/playground"` to the npm-ecosystem entry's `directories`. (`pnpm-workspace.yaml`, `check-invariants.mjs`, and the two nested `package.json` files are listed as the evidence that these are real, enumerated workspaces with their own third-party deps — `pnpm-workspace.yaml:5` adds `libs/keys/artifacts`, and check-invariants enumerates both; do not edit those files in this task.)
      Accept: `.github/dependabot.yml` npm `directories` includes both `/libs/keys/artifacts` and `/libs/keys/examples/playground`; `rg "keys/examples/playground|keys/artifacts" .github/dependabot.yml` returns both paths; YAML parses (e.g. `python3 -c "import yaml,sys;yaml.safe_load(open('.github/dependabot.yml'))"`).

---

### Batch 6.C — files: `PACKAGE_GOVERNANCE.md`, `libs/ui/package.json`, `libs/ui/README.md`, `libs/ui/internal-docs-manifest.json`, `libs/keys/package.json`, `libs/keys/internal-docs-manifest.json`, `libs/keys/artifacts/package.json`, `cli/add/package.json`, `cli/diffgazer/package.json`, `.github/workflows/release-readiness.yml`, `scripts/monorepo/check-invariants.mjs`

The published-library surface: engines.node governance + format normalization, internal-docs-manifest tarball exclusion, the `@diffgazer/keys` required-peer contract, and the `author` field drift. These all touch `PACKAGE_GOVERNANCE.md` and `libs/ui/package.json`, so they are one sequential cluster. (Shares `libs/keys/artifacts/package.json` with 6.B and `check-invariants.mjs` with 6.B/6.D — run after 6.B.)

- [ ] T-608 (fixes F-234) — files: `libs/ui/package.json`, `PACKAGE_GOVERNANCE.md`, `libs/ui/README.md`
      Change: Make `@diffgazer/keys` a REQUIRED peer of `@diffgazer/ui` (two shipped exports — `accordion.tsx` and `popover/use-auto-focus.ts` — statically import it at module top, so optional is incorrect: `npm install @diffgazer/ui` without keys throws `ERR_MODULE_NOT_FOUND`). In `libs/ui/package.json`, remove the `"@diffgazer/keys"` entry from `peerDependenciesMeta` (the `{ "optional": true }` block, ~lines 338-341), keeping only `figlet` and `lowlight` as optional (those load lazily via dynamic `import()`). Keep `@diffgazer/keys` in `peerDependencies`. Then fix `libs/ui/README.md`: change line ~140 and the "Optional peers by entry" table to DROP `@diffgazer/keys` from the optional list, making it consistent with the already-correct README line ~78 ("required peer for runtime package mode") and `PACKAGE_GOVERNANCE.md:175` ("REQUIRED React, React DOM, and @diffgazer/keys peers"). `PACKAGE_GOVERNANCE.md` is read to confirm the required-peer contract; only amend it if it currently contradicts (it does not — it already says required).
      Accept: `libs/ui/package.json` `peerDependenciesMeta` contains only `figlet` and `lowlight` (no `@diffgazer/keys`); `@diffgazer/keys` remains in `peerDependencies`; `libs/ui/README.md` no longer lists `@diffgazer/keys` as optional in either the prose or the entry table; the README is internally consistent (no required-vs-optional contradiction).

- [ ] T-609 (fixes F-213) — files: `libs/keys/package.json`, `libs/keys/internal-docs-manifest.json`, `libs/ui/package.json`, `libs/ui/internal-docs-manifest.json`, `scripts/monorepo/check-invariants.mjs`
      Change: Remove `"internal-docs-manifest.json"` from the `files` array in `libs/keys/package.json` so it is no longer packed into the published `@diffgazer/keys` tarball (it is a build-time docs-sync/registry config pointing at `docs/content`, `docs/assets`, `public/r` — none of which are in the keys `files` array, so it ships dangling references). This matches `libs/ui/package.json`, which already correctly excludes it. The `internal-docs-manifest.json` files themselves stay in the repo for build tooling (`libs/keys/scripts/build-publish-artifacts.ts`, `check-invariants.mjs`) — do not delete them. Add an invariant to `scripts/monorepo/check-invariants.mjs` asserting that no publishable package lists `internal-docs-manifest.json` in its `files` array (so this cannot regress).
      Accept: `rg "internal-docs-manifest" libs/keys/package.json` returns zero matches in the `files` array; `pnpm --filter @diffgazer/keys pack --dry-run` (or `pnpm pack --dry-run` in `libs/keys`) output does not list `internal-docs-manifest.json`; `node scripts/monorepo/check-invariants.mjs` passes and fails if `internal-docs-manifest.json` is re-added to any published `files` array.

- [ ] T-610 (fixes F-192, F-195) — files: `libs/ui/package.json`, `libs/keys/package.json`, `cli/add/package.json`, `cli/diffgazer/package.json`, `libs/keys/artifacts/package.json`, `PACKAGE_GOVERNANCE.md`, `.github/workflows/release-readiness.yml`, `scripts/monorepo/check-invariants.mjs`
      Change: Unify and govern the `engines.node` floor across the published surface. The cli/diffgazer floor is intentionally `>=20.0.0`; align the rest UP to that single supported floor (CI and Docker run Node 22, so Node 20 is the realistic minimum). Set `engines.node` to `">=20.0.0"` in `libs/ui/package.json` (currently `>=18.0.0`), `libs/keys/package.json` (currently `>=18.0.0`), `cli/add/package.json` (currently `>=18.0.0`), and `libs/keys/artifacts/package.json` (currently the bare `>=18` — normalize to the full `>=20.0.0` patch-segment form). Leave `cli/diffgazer/package.json` at `>=20.0.0` (already correct). Document the React-lib Node floor in `PACKAGE_GOVERNANCE.md` (the "Public package targets" section, ~lines 7-12) so `@diffgazer/ui` and `@diffgazer/keys` engines are now intentional and tracked, not undocumented. Add an invariant to `scripts/monorepo/check-invariants.mjs` asserting all publishable packages declare the same `engines.node`. (`.github/workflows/release-readiness.yml` is referenced as the evidence that CI runs Node 22 — no edit needed there; do not change the CI Node version.)
      Accept: `rg '"node"' libs/ui/package.json libs/keys/package.json cli/add/package.json libs/keys/artifacts/package.json cli/diffgazer/package.json` all show `">=20.0.0"` (no bare `>=18` / `>=18.0.0` remains on any published package); `PACKAGE_GOVERNANCE.md` documents the React-lib Node floor; `node scripts/monorepo/check-invariants.mjs` passes and fails on a mismatched `engines.node`.

- [ ] T-611 (fixes F-203) — files: `cli/diffgazer/package.json`, `libs/ui/package.json`, `cli/add/package.json`, `libs/keys/package.json`, `PACKAGE_GOVERNANCE.md`
      Change: Normalize the `author` manifest field across the four npm-published packages. `cli/add/package.json` and `libs/keys/package.json` declare `"author": "diffgazer"`; add the same `"author": "diffgazer"` to `cli/diffgazer/package.json` and `libs/ui/package.json` so all four published manifests agree. Do NOT touch the `license` fields (the MIT vs Apache-2.0 split is intentional per `PACKAGE_GOVERNANCE.md:284-289`). `PACKAGE_GOVERNANCE.md` is read to confirm `author` is currently ungoverned; optionally add one line under "Publish Metadata" noting `author: "diffgazer"` is uniform across published packages.
      Accept: `rg '"author"' cli/diffgazer/package.json libs/ui/package.json cli/add/package.json libs/keys/package.json` shows `"diffgazer"` in all four; `license` fields are unchanged.

---

### Batch 6.D — files: `package.json` (root), `pnpm-workspace.yaml`, `PACKAGE_GOVERNANCE.md`, `libs/core/package.json`, `libs/ui/package.json`, `libs/ui/vitest.config.ts`, `libs/ui/test-setup.ts`, `libs/keys/package.json`, `libs/registry/package.json`, `cli/server/package.json`, `cli/diffgazer/package.json`, `cli/add/package.json`, `apps/web/package.json`, `apps/docs/package.json`, `apps/landing/package.json`

The large cross-cutting cluster: phantom test-runner deps + repo-wide version drift (vitest/RTL/jsdom, @types/node, @types/react, react-router, react/vite toolchain, figlet, tsx), the dead-dep sweep (chalk, ai-sdk, cva/clsx/tailwind-merge, @diffgazer/core docs edge), the dev-vs-prod misclassification (docs figlet), and the two peer-contract fixes (core react-query, core @types/react). These share root `package.json`, `pnpm-workspace.yaml`, `PACKAGE_GOVERNANCE.md`, `libs/ui/package.json`, `libs/core/package.json`, and several app/cli manifests with earlier batches, so this batch runs LAST.

- [ ] T-612 (fixes F-226) — files: `apps/web/package.json`, `apps/landing/package.json`, `libs/ui/package.json`, `libs/core/package.json`, `cli/server/package.json`, `libs/ui/vitest.config.ts`, `libs/ui/test-setup.ts`, `pnpm-workspace.yaml`, `package.json`
      Change: Declare every directly-imported test tool in the workspace that imports it (today they are phantom deps resolved only via root hoisting). Add `vitest` to `apps/web/package.json`, `apps/landing/package.json`, `libs/ui/package.json`, `libs/core/package.json`, and `cli/server/package.json` devDependencies. Additionally add `jsdom`, `@testing-library/react`, `@testing-library/jest-dom`, and `@chialab/vitest-axe` to `libs/ui/package.json` devDependencies (its `test-setup.ts` imports all of them and it already declares `@types/jsdom` while omitting `jsdom` — the smoking gun); add `@testing-library/react` + `jsdom` to `libs/core/package.json` devDependencies. Then pin ONE shared version repo-wide for `vitest`, `@testing-library/react`, `@testing-library/jest-dom`, `jsdom`, and `@vitejs/plugin-react` via a `catalog:` block in `pnpm-workspace.yaml` (or, if simpler for this repo, `pnpm.overrides` in root `package.json`) and reference `catalog:` from each manifest, eliminating the `vitest ^4.0.0` vs `^4.1.0`, `jsdom ^27` vs `^28`, `@testing-library/react ^16.0.0`/`^16.2.0`/`^16.3.2`, and `@vitejs/plugin-react ^5.0.4` vs `^5.1.3` drift. `libs/ui/vitest.config.ts` and `libs/ui/test-setup.ts` are read to confirm the imported tools; no edit to them is required unless a `catalog:` reference is needed.
      Accept: `vitest` appears in the devDependencies of apps/web, apps/landing, libs/ui, libs/core, cli/server; `jsdom`, `@testing-library/react`, `@testing-library/jest-dom`, `@chialab/vitest-axe` all appear in `libs/ui/package.json`; a single resolved version of each tool is pinned (catalog or override); `pnpm install` succeeds; `pnpm --filter @diffgazer/ui test` and `turbo run test` still pass.

- [ ] T-613 (fixes F-202) — files: `cli/diffgazer/package.json`, `cli/server/package.json`, `libs/core/package.json`, `PACKAGE_GOVERNANCE.md`, `package.json`
      Change: Bump the `@types/node` devDependency range from `^25.2.0` to `^25.2.3` in `cli/diffgazer/package.json`, `cli/server/package.json`, and `libs/core/package.json`, matching the documented governance rule (`PACKAGE_GOVERNANCE.md:198`: declare `^25.2.3` so an override removal does not silently regress) and the root override (`package.json:86` pins `@types/node: ^25.2.3`). The five other workspaces already declare `^25.2.3`. No edit to `PACKAGE_GOVERNANCE.md` or root `package.json` needed (read-only confirmation of the rule and override).
      Accept: `rg '"@types/node": "\^25\.2\.0"' --glob '**/package.json'` returns zero matches; all three named manifests show `^25.2.3`; `pnpm install` succeeds.

- [ ] T-614 (fixes F-231, F-220, F-239) — files: `libs/core/package.json`, `apps/web/package.json`, `apps/docs/package.json`, `libs/ui/package.json`, `libs/keys/package.json`, `cli/add/package.json`, `package.json`, `PACKAGE_GOVERNANCE.md`
      Change: Resolve the React-family + toolchain version drift in one pass. (a) `@types/react`/`@types/react-dom`: add both to root `pnpm.overrides` (in `package.json`) pinned to the React 19.2 line, and align each package's declared range to it — in particular bump `libs/core/package.json` `@types/react` from `^19.1.6` to `^19.2.x` so it matches its own `react` peer floor (`>=19.2.0`) and devDep runtime (`^19.2.4`); align ui/keys/docs (`^19.2.0`) and web/landing/diffgazer (`^19.2.13`) onto the override. (b) `@tanstack/react-router`: align `apps/docs/package.json` (`^1.138.0`) UP to `apps/web/package.json`'s `^1.158.1`. (c) `apps/docs` toolchain lag: bump `apps/docs/package.json` `react`/`react-dom` `^19.2.0`→`^19.2.4`, `@vitejs/plugin-react` `^5.0.4`→`^5.1.3`, and align declared `vite` to `^7.3.x` (note: `vite` is already neutralized by the root override `vite: ^7.3.2`, so this is cosmetic-but-correct). (d) `cli/add/package.json` `tsx` `^4.0.0`→`^4.21.0` (matching root/cli/diffgazer/cli/server). Fold the React-family version policy (`@types/react ^19.2.x`, react-router) into `PACKAGE_GOVERNANCE.md` alongside the existing `@types/node`/`typescript` governance so the drift is machine-checkable in Phase 7.
      Accept: root `pnpm.overrides` includes `@types/react` + `@types/react-dom` on the 19.2 line; `rg '"@types/react": "\^19\.1' --glob '**/package.json'` returns zero matches; `apps/docs` and `apps/web` declare the same `@tanstack/react-router` range; `apps/docs` shows `react`/`react-dom` `^19.2.4`, `@vitejs/plugin-react` `^5.1.3`; `cli/add` shows `tsx ^4.21.0`; `pnpm install` succeeds; `turbo run type-check` passes.

- [ ] T-615 (fixes F-240) — files: `libs/registry/package.json`, `libs/core/package.json`, `libs/ui/package.json`, `cli/add/package.json`
      Change: Align the `figlet` declared range to the lockfile-resolved 1.10.0. Bump `libs/registry/package.json` `figlet` from `^1.8.0` to `^1.10.0` (matching `libs/core` `^1.10.0`, `libs/ui` peer `>=1.10.0`, `cli/diffgazer`/`apps/docs` `^1.10.0`), and in the same pass bump `cli/add/package.json` `figlet` from `^1.8.0` to `^1.10.0`. Do not add `figlet` to root `pnpm.overrides` (intentionally absent). `libs/core/package.json` and `libs/ui/package.json` are read-only confirmation of the canonical `^1.10.0`/`>=1.10.0` floors.
      Accept: `rg '"figlet": "\^1\.8' --glob '**/package.json'` returns zero matches; `libs/registry` and `cli/add` both show `figlet ^1.10.0`; `pnpm install` succeeds with figlet still resolving to a single 1.10.x.

- [ ] T-616 (fixes F-232) — files: `libs/core/package.json`, `apps/web/package.json`, `cli/diffgazer/package.json`
      Change: Fix the React-Query peer contract. In `libs/core/package.json`, move `@tanstack/react-query` (`^5.80.7`) from `dependencies` to `peerDependencies` (libs/core exports RQ-bound hooks in `src/api/hooks/{server,review,config}.ts` and `src/api/query-client.ts` whose `QueryClient` context is a singleton; shipping react-query as a hard dep risks a second context instance and "No QueryClient set" at runtime — react is already a peer, so the always-co-required react-query must be too). Keep `@tanstack/react-query` in `libs/core` `devDependencies` for type/test resolution. Add `peerDependenciesMeta["@tanstack/react-query"].optional = true` only if the RQ subpath is genuinely optional (mirror the existing optional-react treatment). The consumers `apps/web/package.json` and `cli/diffgazer/package.json` already declare `@tanstack/react-query ^5.80.7` as their own dependency — confirm they do and do not remove it (those declarations are what satisfy the new peer); no edit needed to them beyond confirmation.
      Accept: `libs/core/package.json` lists `@tanstack/react-query` under `peerDependencies` (and still under `devDependencies`), not under `dependencies`; `apps/web` and `cli/diffgazer` still declare `@tanstack/react-query`; `pnpm install` succeeds; `turbo run type-check` and `turbo run test` pass (no unresolved-peer or QueryClient errors).

- [ ] T-617 (fixes F-237) — files: `apps/web/package.json`, `libs/ui/package.json`
      Change: Remove `class-variance-authority`, `clsx`, and `tailwind-merge` from `apps/web/package.json` `dependencies` — apps/web imports none of them directly (it gets `cn` from `@diffgazer/ui/lib/utils`), and `libs/ui/package.json` owns all three as its own `dependencies`, so they reach apps/web transitively. Do NOT remove them from `libs/ui` (it is the legitimate owner). `libs/ui/package.json` is read-only confirmation of the transitive ownership.
      Accept: `rg "class-variance-authority|clsx|tailwind-merge" apps/web/package.json` returns zero matches; `libs/ui/package.json` still declares all three; `pnpm install` succeeds; `pnpm --filter @diffgazer/web type-check` and `pnpm --filter @diffgazer/web test` still pass; `apps/web` build still resolves `cn`.

- [ ] T-618 (fixes F-235, F-236) — files: `cli/diffgazer/package.json`, `cli/server/package.json`
      Change: Delete dead production dependencies. In `cli/diffgazer/package.json`, remove `"chalk": "^5.6.2"` from `dependencies` (zero imports anywhere; the TUI styles via Ink/@inkjs/ui). In `cli/server/package.json`, remove `"@ai-sdk/cerebras"` and `"@ai-sdk/groq"` from `dependencies` (neither is imported; `client.ts:114-125` routes both providers through `createOpenAICompatible` from the already-declared `@ai-sdk/openai-compatible`).
      Accept: `rg "chalk" cli/diffgazer/package.json` and `rg "@ai-sdk/cerebras|@ai-sdk/groq" cli/server` (excluding test string literals) return zero matches; `pnpm install` succeeds; `pnpm --filter diffgazer build` and `pnpm --filter @diffgazer/server type-check`/`build` still pass; `DIFFGAZER_SMOKE_STRICT_SKIPS=1 pnpm run smoke` still passes the CLI snapshot.

- [ ] T-619 (fixes F-229) — files: `apps/docs/package.json`
      Change: Move `figlet` (`^1.10.0`) from `dependencies` to `devDependencies` in `apps/docs/package.json` (it is build-only — `scripts/generate-logo-ascii.mjs` renders ASCII into the gitignored `src/generated/` at build time; no runtime SPA source imports figlet, only the generated `LOGO_ASCII` record). Place it next to its already-correctly-placed `@types/figlet`. This corrects a dev-vs-prod misclassification, not a dependency addition.
      Accept: `apps/docs/package.json` lists `figlet` under `devDependencies` (next to `@types/figlet`), not `dependencies`; `pnpm install` succeeds; `pnpm --filter @diffgazer/docs prepare:generated` and the docs build still succeed.

- [ ] T-620 (fixes F-233) — files: `apps/docs/package.json`
      Change: Remove `"@diffgazer/core": "workspace:*"` from `apps/docs/package.json` `dependencies` — it is a dead workspace edge (zero imports of `@diffgazer/core` in `apps/docs/src` or `apps/docs/scripts`; the other three diffgazer deps — keys, ui, registry — are genuinely used). This trims a phantom workspace edge from the docs build-ordering graph.
      Accept: `rg "@diffgazer/core" apps/docs/package.json apps/docs/src apps/docs/scripts` returns zero matches; `pnpm install` succeeds; `pnpm --filter @diffgazer/docs type-check` and the docs build still pass.

---

### Phase exit

All gates run AFTER a single `pnpm install` at the end of the phase (lockfile regenerated once through pnpm — never hand-edit `pnpm-lock.yaml`), then in the D7 / refactor-verification order:

1. `pnpm install` — regenerate the lockfile for every manifest edit in this phase; confirm no unexpected resolution changes beyond the intended dep removals/bumps/moves.
2. `DIFFGAZER_SKIP_ARTIFACT_PREPARE=1 pnpm exec turbo run type-check` — must pass (project references make a broken peer/types/version edge a hard error; specifically catches the F-231/F-232/F-234 peer and @types/react changes).
3. `DIFFGAZER_SKIP_ARTIFACT_PREPARE=1 pnpm exec turbo run test` — FULL suite (not `--affected`); the F-226 test-runner declarations and F-616/F-617 dep moves must not break any package's vitest resolution.
4. `pnpm run prepare:artifacts` and `pnpm run validate:artifacts:check` — required because this phase touches the published-library surface (`libs/ui`, `libs/keys` manifests, peer contracts, `internal-docs-manifest.json` tarball exclusion, `engines.node`, `author`); validate the @diffgazer/ui pack contract and registry/handoff artifacts. Run `pnpm --filter @diffgazer/keys pack --dry-run` and confirm `internal-docs-manifest.json` is absent (F-213).
5. `node scripts/monorepo/check-invariants.mjs` (via `pnpm run verify:monorepo`) — must pass, including the two new invariants added in this phase (engines.node uniformity from T-610, internal-docs-manifest files-array ban from T-609).
6. `DIFFGAZER_SMOKE_STRICT_SKIPS=1 pnpm run smoke` — required because this phase touches CLI manifests (`cli/diffgazer`, `cli/server`, `cli/add`) and the dead-dep removals (F-235/F-236) and the `@diffgazer/web` build edge (F-174); the bundled offline snapshot plus the CLI/package-install smoke fixtures must still pass.
7. `git diff --check` — no whitespace errors; confirm the diff is manifest/config/markdown-only (no source `.ts`/`.tsx` logic changes) plus the regenerated `pnpm-lock.yaml`.


---

## Phase 7 — Enforcement wiring + test additions/moves

This phase sits second-to-last because enforcement must be wired only after the tree has reached its final shape: Phase 1 already performed the pure moves/renames, Phase 3 dissolved the internal barrels, Phase 4 removed the dead code, and Phase 5 removed the docs mirror — so the dependency-cruiser/knip/Biome rules encode the *settled* structure rather than chasing a moving target, and the test-home corrections land on source files that already live at their final paths and final names. Wiring enforcement earlier would force every later phase to fight a green-bar that flags work-in-progress; wiring it now turns the realized structure into a regression gate the final Phase 8 docs can describe as the contract.

Cross-phase anchors this phase depends on (do not redo here):
- Phase 1 moved the `libs/ui/src/validation/*` build-time validators to their non-`src` home (F-010) and renamed the `apps/web/.../api-key-dialog/` compound folder so `dialog.tsx` exists (F-023/F-072 anchor). Tasks below target those *final* paths.
- Phase 1 renamed source modules referenced by split tests (`use-onboarding`/wizard, `providers.ts`, `capabilities.ts`, `config.ts` neighbours). Where a Phase-1 rename is still pending at execution time, use the source's current basename and let the lockstep rename carry the test.
- Phase 2 extracted the shared `RELATIVE_JS_IMPORT` regex (F-082). F-154's moved tests import that deduplicated constant, never re-declare it.
- Phase 6 already reconciled the `vitest`/RTL/jsdom *dependency declarations* (F-226). This phase only wires the *config* (jsdom env + setupFiles) and never re-touches manifests for deps.

D1 resolution applied throughout: the context.md carve-outs for `.keyboard.test` / `.contract.test` / `.ssr.test` are **overridden** by D1's dot-segment ban; those segments are renamed/foldered here (matching the confirmed F-038 precedent).

---

### Batch 7.A — Enforcement tooling + Biome topology + turbo task-graph + packaging assertions — files: `/Users/voitz/Projects/diffgazer-workspace/package.json`, `/Users/voitz/Projects/diffgazer-workspace/turbo.json`, `/Users/voitz/Projects/diffgazer-workspace/biome.root.json` (→ `biome.json`), `/Users/voitz/Projects/diffgazer-workspace/apps/docs/biome.json`, `/Users/voitz/Projects/diffgazer-workspace/apps/docs/package.json`, `/Users/voitz/Projects/diffgazer-workspace/cli/add/package.json`, every workspace `package.json` (check script), new `/Users/voitz/Projects/diffgazer-workspace/.dependency-cruiser.cjs`, new `/Users/voitz/Projects/diffgazer-workspace/knip.json`

This batch shares the four root coordination files (`package.json`, `turbo.json`, the root Biome config, `apps/docs/biome.json`) plus per-workspace `package.json` check scripts, so it is a single serial batch. Run its tasks in the listed order (7.01 Biome topology → 7.02 lint coverage fan-out → 7.03 Biome filename+barrel rules → 7.04 dependency-cruiser → 7.05 knip → 7.06 turbo task-graph reconcile → 7.07 cli/add test dependsOn → 7.08 landing build-env → 7.09 packaging assertion).

- [ ] T-701 (fixes F-182) — files: `/Users/voitz/Projects/diffgazer-workspace/biome.root.json`, `/Users/voitz/Projects/diffgazer-workspace/apps/docs/biome.json`, `/Users/voitz/Projects/diffgazer-workspace/package.json`
      Change: Rename `biome.root.json` to `biome.json` at the repo root (git-mv, content unchanged for now) so Biome auto-discovers it. In `package.json:22`, drop the `--config-path=biome.root.json` flag from the `check` script (it becomes `biome lint scripts/monorepo && turbo run check`, then is superseded by T-702/T-706). Convert `apps/docs/biome.json` into a thin override: add `"extends": "//"` (resolve to the new root `biome.json`) and keep ONLY the docs-specific deltas — `formatter.enabled:true` + `indentStyle:"tab"`, `javascript.formatter.quoteStyle:"double"`, `assist.actions.source.organizeImports:"on"`, and its `files.includes` ignore list (`!src/routeTree.gen.ts`, `!src/index.css`, `!src/generated`). Reconcile `vcs`: keep `vcs.enabled:true` + `useIgnoreFile:true` from root and remove the conflicting `vcs.enabled:false` block from the docs override so the two configs no longer disagree.
      Accept: `npx biome rage` (or `biome check --version` + a `biome lint` dry run from repo root) discovers `biome.json` at the root with no `--config-path`; `apps/docs/biome.json` contains an `extends` referencing the root and no longer redeclares recommended-rules wholesale or a contradictory `vcs.enabled:false`.

- [ ] T-702 (fixes F-013) — files: `/Users/voitz/Projects/diffgazer-workspace/package.json`, `/Users/voitz/Projects/diffgazer-workspace/turbo.json`, and `package.json` of each of `apps/web`, `apps/landing`, `cli/add`, `cli/server`, `cli/diffgazer`, `libs/core`, `libs/keys`, `libs/ui`, `libs/registry` (apps/docs already has a `check` script)
      Change: Give every workspace Biome lint coverage. Add a `"check": "biome check ."` script (lint-only where formatter is off via the inherited root config; docs keeps its formatting `check`) to each of the 9 workspaces listed that currently have no check/lint script. Keep the root `turbo.json` `check` task (`{ "dependsOn": ["^check"] }`) so `turbo run check` now fans out to all 10 workspaces. Update root `package.json:22` `check` to `biome lint scripts/monorepo && turbo run check` (root config now auto-discovered per T-701). Confirm each added `check` resolves against the auto-discovered root `biome.json`.
      Accept: `pnpm exec turbo run check` executes a `check` task in all 10 workspaces (not a single-package no-op); running `biome lint` over each of the 9 previously-unlinted workspace `src` trees emits diagnostics (proving they are now in scope). This unblocks T-703.

- [ ] T-703 (fixes F-013) — files: `/Users/voitz/Projects/diffgazer-workspace/biome.json` (the renamed root config)
      Change: In the root `biome.json` linter rules, enable `style.useFilenamingConvention` with `{ "level":"error", "options": { "filenameCases": ["kebab-case"], "requireAscii": true, "strictCase": false, "match": "export" } }` so file basenames must be kebab-case and may equal the file's primary export; Biome's consecutive-extension handling treats `.test`/`.spec`/`.e2e`/`.stories`/`.config`/`.d` middle-segments correctly. Add a lint ban on internal/self-package barrels via `noRestrictedImports` (or `style.useImportRestrictions`): forbid importing a package through its own published name/subpath from inside that package (e.g. inside `libs/core`, ban `@diffgazer/core` and `@diffgazer/core/*` specifiers), and forbid importing through an internal `index.ts` re-export barrel that Phase 3 removed (encode as a `noRestrictedImports` pattern blocking re-introduction of `./**/index` convenience-barrel imports within `apps/*`/`cli/*`). Add a per-folder override carving out the sanctioned exceptions: the `use-` hook prefix, the `<component>-<part>` compound idiom, and the per-component `libs/ui/registry/ui/**/index.ts` distribution barrels.
      Accept: `biome lint` flags a deliberately path-cased test file (e.g. a temporary `Foo.ts`) as a `useFilenamingConvention` error and flags a temporary self-import of `@diffgazer/core` inside `libs/core/src` as a restricted-import error; the existing repo tree (post Phase 1/3) passes both rules clean.

- [ ] T-704 (fixes F-256-class regression guard for this phase) — files: new `/Users/voitz/Projects/diffgazer-workspace/.dependency-cruiser.cjs`, `/Users/voitz/Projects/diffgazer-workspace/package.json`
      Change: Add `dependency-cruiser` as a root `devDependency` (justification comment in the PR/commit body: "repo is Biome-only with no ESLint boundary plugin; dependency-cruiser is the standalone tool that encodes the AGENTS.md layer boundaries + no-circular + no-orphans across the whole workspace, run from root"). Create `.dependency-cruiser.cjs` at repo root encoding: (a) `no-circular` (error); (b) `no-orphans` (warn, with known generated/entrypoint exceptions: `**/dist/**`, `**/*.d.ts`, package entrypoints, `**/public/r/**`); (c) layer boundaries from AGENTS.md — `libs/core` may not import `apps/*` or `cli/*`; features never import sibling features (`apps/web/src/features/<a>` ↛ `apps/web/src/features/<b>`, same for `apps/docs` and `cli/diffgazer`); the app-shared `components/` tier may not import `features/*` (the F-256 shared→feature direction); `apps/landing` may import only `libs/ui`. Add root script `"depcruise": "depcruise --config .dependency-cruiser.cjs apps cli libs"`. Wire it into the root `check`/`verify` gate (append `&& pnpm run depcruise`). Use the exclusion set from the audit (node_modules, dist, .turbo, coverage, all generated dirs, the catalog snapshot, public/r JSON).
      Accept: `pnpm run depcruise` exits 0 on the post-Phase-1..6 tree; introducing a temporary `import` of a sibling feature, or a `libs/core`→`apps/web` import, makes `pnpm run depcruise` exit non-zero with the matching rule name.

- [ ] T-705 (fixes F-256-class dead-file/export/dep sweep for this phase) — files: new `/Users/voitz/Projects/diffgazer-workspace/knip.json`, `/Users/voitz/Projects/diffgazer-workspace/package.json`
      Change: Add `knip` as a root `devDependency` (justification: "post-move dead-file/export/dependency sweep that neither Biome nor dependency-cruiser performs; run staged, warning-first"). Create root `knip.json` declaring each workspace, its entry points (package `exports` targets, bin entries, vitest/vite/tsup config files, `scripts/**` build modules, the `public/r` registry sources), and ignore patterns for the audit's excluded/generated dirs (`**/dist/**`, `**/generated/**`, `libs/{ui,keys}/public/r/**`, `libs/core/src/catalog/catalog-snapshot.ts`, `apps/docs/registry/**` while it still exists). Add root script `"knip": "knip"`. Stage adoption per D7-enforcement: run it as a non-blocking report first (NOT added to the hard `verify`/`test-ci` gate in this phase) — expect false positives on workspace path aliases; document the staged-to-error promotion as a follow-up note in the config header comment.
      Accept: `pnpm run knip` runs and produces a report; the config parses (no schema errors); it is intentionally NOT in the blocking gate yet (verify the `verify`/`test-ci` scripts do not call `knip`).

- [ ] T-706 (fixes F-190) — files: `/Users/voitz/Projects/diffgazer-workspace/turbo.json`, `/Users/voitz/Projects/diffgazer-workspace/package.json`, `/Users/voitz/Projects/diffgazer-workspace/apps/docs/package.json`
      Change: Remove the dead `prepare:generated` task block from `turbo.json` (lines 40-42) — it is only ever invoked via direct `pnpm --filter` calls and gains nothing from turbo orchestration; leave the `apps/docs` package script and the direct callers untouched. For the `check` task: now that T-702 added a `check` script to every workspace, keep the `turbo.json` `check` task block — it correctly fans out. Verify no remaining `turbo run prepare:generated` reference exists anywhere.
      Accept: `rg "prepare:generated" turbo.json` returns nothing; `rg "turbo run prepare:generated"` returns nothing repo-wide; `pnpm exec turbo run check` still fans out to all workspaces (proving the `check` task is no longer a near-no-op after T-702).

- [ ] T-707 (fixes F-251) — files: `/Users/voitz/Projects/diffgazer-workspace/cli/add/package.json`, `/Users/voitz/Projects/diffgazer-workspace/turbo.json`
      Change: Replace `cli/add/package.json` `test` script value `"pnpm --filter @diffgazer/registry build && pnpm run generate:bundles && vitest run"` with the clean `"vitest run"` (matching cli/server, libs/registry, cli/diffgazer). Wire the prerequisites declaratively in `turbo.json`: add `"^build"` to the `test` task's `dependsOn` (so `["^test", "^build"]`), and add a `generate:bundles` turbo task that `cli/add#test` `dependsOn` locally — define a `@diffgazer/add#test` override `{ "dependsOn": ["^build", "generate:bundles"] }` and a `generate:bundles` task `{ "outputs": ["src/generated/**"] }` so the build graph orders the registry build + bundle codegen instead of the shell string.
      Accept: `cli/add/package.json` `test` is exactly `"vitest run"`; `pnpm exec turbo run test --filter=@diffgazer/add --dry=json` shows `@diffgazer/registry#build` and the local `generate:bundles` task as upstream dependencies of `@diffgazer/add#test`; running the cli/add tests from a clean state produces the registry build + bundles before vitest.

- [ ] T-708 (fixes F-255) — files: `/Users/voitz/Projects/diffgazer-workspace/turbo.json`
      Change: Add `"env": ["VITE_DOCS_ORIGIN"]` to the `@diffgazer/landing#build` task (mirroring `@diffgazer/docs#build`) so the build-time-inlined origin participates in the content-hash cache key. Add a `@diffgazer/web#build` override declaring `"env": ["VITE_API_URL", "VITE_DIFFGAZER_SHUTDOWN_TOKEN"]` (the values `apps/web/src/lib/api.ts` inlines) with `dependsOn:["^build"]` + `outputs:["dist/**"]`; if these are confirmed runtime-injected rather than build-baked for the embedded binary, instead add a one-line `turbo.json` comment-adjacent note (or a `globalPassThroughEnv` entry) documenting the omission as intentional.
      Accept: `@diffgazer/landing#build` in `turbo.json` lists `VITE_DOCS_ORIGIN` in its `env`; changing `VITE_DOCS_ORIGIN` between two `turbo run build --filter=@diffgazer/landing` runs produces a cache MISS (not a stale cache HIT); the web build env is either declared or explicitly documented as intentional.

- [ ] T-709 (fixes F-137) — files: `/Users/voitz/Projects/diffgazer-workspace/libs/ui/tsup.config.ts`, `/Users/voitz/Projects/diffgazer-workspace/libs/ui/scripts/build-declarations.ts`, `/Users/voitz/Projects/diffgazer-workspace/libs/ui/package.json`
      Change: Restrict the emitted dist entry set to exactly the entries backing the `exports` map. Drive both `tsup.config.ts` entry discovery (lines 38-56) and `build-declarations.ts` `.d.ts` emission (lines 203-234) off a SINGLE allowlist — either a `meta.packageEntry: true` flag added to the relevant `registry.json` items, or a shared exported `PACKAGE_ENTRY_KEYS` array consumed by both files — so the 18 orphan dist entries (keys-mirror hooks `use-navigation`/`use-focus-restore`/etc, dead `lib/focus` & `lib/resolve-tab-target`, and the 10 internal `lib/*` helpers) are no longer built or packed. Delete the now-unnecessary `files` deny-list entries in `libs/ui/package.json` (lines 289-294, 300-318) that were the only (incomplete) mitigation. Add a build-time assertion (in `build-declarations.ts` or a new sibling assert step the build runs) that the set of emitted dist `*.js` entry points is exactly equal to the set of `exports`-map `import` targets — fail the build on any mismatch.
      Accept: After `pnpm --filter @diffgazer/ui build`, the count of dist entry `.js` files equals the number of `import` targets in the `exports` map (the 18 orphans are gone); `pnpm --filter @diffgazer/ui pack --dry-run` contains no `dist/` entry absent from `exports`; the build assertion throws when a registry item is added without a corresponding export; the `files` deny-list no longer needs the manual orphan exclusions.

---

### Batch 7.B — libs/core test homes (config schemas + footer + api hooks + catalog fixture + dist test-leak excludes) — files: `/Users/voitz/Projects/diffgazer-workspace/libs/core/src/schemas/config/*.test.ts`, `/Users/voitz/Projects/diffgazer-workspace/libs/core/src/footer/*`, `/Users/voitz/Projects/diffgazer-workspace/libs/core/src/api/hooks/*`, `/Users/voitz/Projects/diffgazer-workspace/libs/core/src/api/config.test.ts`, `/Users/voitz/Projects/diffgazer-workspace/libs/core/src/catalog/__fixtures__/*`, `/Users/voitz/Projects/diffgazer-workspace/libs/core/src/catalog/*.test.ts`, `/Users/voitz/Projects/diffgazer-workspace/libs/core/src/testing/factories.ts`, `/Users/voitz/Projects/diffgazer-workspace/libs/core/tsconfig.json`

Disjoint from every other batch (libs/core only) and internally disjoint per task (different subfolders).

- [ ] T-710 (fixes F-108, F-112) — files: `/Users/voitz/Projects/diffgazer-workspace/libs/core/src/schemas/config/provider-enum.test.ts`, `/Users/voitz/Projects/diffgazer-workspace/libs/core/src/schemas/config/providers.test.ts`, `/Users/voitz/Projects/diffgazer-workspace/libs/core/src/schemas/config/env-vars.test.ts`, `/Users/voitz/Projects/diffgazer-workspace/libs/core/src/schemas/config/capabilities.test.ts`
      Change: Eliminate the two phantom-basename test files. Move the `describe` block(s) from `provider-enum.test.ts` (which imports from `./providers.js`) into `providers.test.ts` as additional disjoint `describe`s, then delete `provider-enum.test.ts`. Move the `describe` block(s) from `env-vars.test.ts` (which imports from `./capabilities.js`) into `capabilities.test.ts`, then delete `env-vars.test.ts`. Preserve every assertion; only relocate.
      Accept: `provider-enum.test.ts` and `env-vars.test.ts` no longer exist; `providers.ts` has exactly one colocated `providers.test.ts` and `capabilities.ts` exactly one `capabilities.test.ts`; `pnpm --filter @diffgazer/core test` passes with the same total assertion count.

- [ ] T-711 (fixes F-109, F-111) — files: `/Users/voitz/Projects/diffgazer-workspace/libs/core/src/api/hooks/use-provider-models.test.ts`, `/Users/voitz/Projects/diffgazer-workspace/libs/core/src/api/hooks/config.ts`
      Change: `use-provider-models.test.ts` imports `useProviderModels` from `./config.js`, but no `use-provider-models.ts` source exists and `config.ts` (10 hooks) has no `config.test.ts`. Rename `use-provider-models.test.ts` → `config.test.ts` so the basename maps 1:1 to its source `config.ts`; keep the `describe('useProviderModels')` block intact as the single test home for `config.ts`'s hooks. (Phase 1/4 may further split `config.ts`; this task only restores the 1:1 pairing for the current source.)
      Accept: `libs/core/src/api/hooks/use-provider-models.test.ts` no longer exists; `config.test.ts` exists beside `config.ts` and imports from `./config.js`; `pnpm --filter @diffgazer/core test` passes.

- [ ] T-712 (fixes F-076) — files: `/Users/voitz/Projects/diffgazer-workspace/libs/core/src/footer/footer.test.ts`, `/Users/voitz/Projects/diffgazer-workspace/libs/core/src/footer/provider.ts`, `/Users/voitz/Projects/diffgazer-workspace/libs/core/src/footer/use-page-footer.ts`
      Change: `footer/footer.test.ts` is a path-echo with no `footer.ts` source and imports everything through `./index.js`. Split it 1:1: create `footer/provider.test.ts` holding the `FooterProvider`/`useFooterData`/`useFooterActions` cases importing from `./provider.js` directly, and `footer/use-page-footer.test.ts` holding the `usePageFooter` cases importing from `./use-page-footer.js` directly. Delete `footer/footer.test.ts`. Import concrete modules, never the barrel.
      Accept: `footer/footer.test.ts` is gone; `provider.test.ts` and `use-page-footer.test.ts` exist beside their sources and import them directly (no `./index.js` import); `pnpm --filter @diffgazer/core test` passes.

- [ ] T-713 (fixes F-041) — files: `/Users/voitz/Projects/diffgazer-workspace/libs/core/src/catalog/__fixtures__/catalog.fixture.ts`, `/Users/voitz/Projects/diffgazer-workspace/libs/core/src/catalog/transform.test.ts`, `/Users/voitz/Projects/diffgazer-workspace/libs/core/src/catalog/schema.test.ts`, `/Users/voitz/Projects/diffgazer-workspace/libs/core/src/catalog/capabilities.test.ts`
      Change: Move `catalog/__fixtures__/catalog.fixture.ts` → `catalog/fixtures.ts` (drops the banned `__fixtures__` dir, the banned `.fixture` dot-segment, and the folder path-echo). Delete the now-empty `__fixtures__` folder. Update the three importing test files (`transform.test.ts`, `schema.test.ts`, `capabilities.test.ts`) to import `RAW_CATALOG`/`RAW_CATALOG_WITH_BAD_MODEL` from `./fixtures.js`.
      Accept: `libs/core/src/catalog/__fixtures__/` no longer exists; `catalog/fixtures.ts` exists; the three test files import from `./fixtures.js`; `pnpm --filter @diffgazer/core test` passes.

- [ ] T-714 (fixes F-142) — files: `/Users/voitz/Projects/diffgazer-workspace/libs/core/src/testing/factories.ts`, `/Users/voitz/Projects/diffgazer-workspace/libs/core/src/api/config.test.ts`, `/Users/voitz/Projects/diffgazer-workspace/libs/core/tsconfig.json`
      Change: `testing/factories.ts` does a top-level `import { vi } from "vitest"`, is not in the `exports` map, and has one consumer (`api/config.test.ts`). Move `createMockClient` into a build-excluded location colocated with its consumer — preferred: a new `libs/core/src/api/test-helpers.ts` that the published build excludes (or inline it into `api/config.test.ts` if it is only used there). Delete `src/testing/factories.ts` and the now-empty `src/testing/` dir if `dom-polyfills.ts` is its only other occupant — KEEP `dom-polyfills.ts` (it is a legitimately-exported, consumed module); if `dom-polyfills.ts` remains, leave `src/testing/` in place and only delete `factories.ts`. Update `api/config.test.ts` import accordingly. Independently, add `"**/testing/**"` to the `exclude` array in `libs/core/tsconfig.json` so no test-only `testing/` module can ever compile into `dist/` (mirrors the keys remediation in T-715).
      Accept: `libs/core/src/testing/factories.ts` no longer exists; `api/config.test.ts` imports `createMockClient` from its new colocated/excluded home; `libs/core/tsconfig.json` `exclude` contains `**/testing/**`; after `pnpm --filter @diffgazer/core build`, `dist/` contains no `factories.js` and no module with a top-level `vitest` import; `dist/testing/dom-polyfills.js` is still emitted only if it was before (it is exported) — verify `./testing/dom-polyfills` still resolves for web/landing test-setup.

---

### Batch 7.C — libs/keys test homes + tarball leak + registry-example type-check coverage — files: `/Users/voitz/Projects/diffgazer-workspace/libs/keys/src/registry-handoff.test.ts`, `/Users/voitz/Projects/diffgazer-workspace/libs/keys/scripts/*`, `/Users/voitz/Projects/diffgazer-workspace/libs/keys/tsconfig.json`, `/Users/voitz/Projects/diffgazer-workspace/libs/keys/tsconfig.test.json`, `/Users/voitz/Projects/diffgazer-workspace/libs/keys/package.json`

Disjoint from all other batches (libs/keys only).

- [ ] T-715 (fixes F-110) — files: `/Users/voitz/Projects/diffgazer-workspace/libs/keys/tsconfig.json`, `/Users/voitz/Projects/diffgazer-workspace/libs/keys/package.json`
      Change: Add `"src/testing/**"` to the `exclude` array in `libs/keys/tsconfig.json` so `src/testing/navigation-behavior.ts` (top-level `vitest` import) and `test-utils.tsx` are never emitted to `dist/testing/`, mirroring `libs/ui/tsconfig.json`. Belt-and-suspenders: add `"!dist/testing"` and `"!dist/testing/**"` to the `files` array in `libs/keys/package.json`.
      Accept: After `pnpm --filter @diffgazer/keys build`, `dist/testing/` is empty/absent; `pnpm --filter @diffgazer/keys pack --dry-run` lists no `dist/testing/*` files; `pnpm --filter @diffgazer/keys type-check` passes.

- [ ] T-716 (fixes F-154) — files: `/Users/voitz/Projects/diffgazer-workspace/libs/keys/src/registry-handoff.test.ts`, `/Users/voitz/Projects/diffgazer-workspace/libs/keys/scripts/transform-public-registry-imports.ts`, `/Users/voitz/Projects/diffgazer-workspace/libs/keys/scripts/validate-registry-closure.ts`
      Change: `src/registry-handoff.test.ts` reaches up out of `src/` into `../scripts/*.js` to test build modules that have no colocated tests. Split and colocate: move the cases exercising `transform-public-registry-imports.ts` into a new `libs/keys/scripts/transform-public-registry-imports.test.ts` (importing `./transform-public-registry-imports.js`), and the cases exercising `validate-registry-closure.ts` into `libs/keys/scripts/validate-registry-closure.test.ts` (importing `./validate-registry-closure.js`). Delete `src/registry-handoff.test.ts`. The moved tests must import the deduplicated `RELATIVE_JS_IMPORT` regex extracted in Phase 2 (F-082), not re-declare it. Ensure `scripts/` is in a vitest include glob (or the keys vitest config covers `scripts/**/*.test.ts`); if not, extend the include so the relocated tests run.
      Accept: `src/registry-handoff.test.ts` no longer exists; `libs/keys/scripts/transform-public-registry-imports.test.ts` and `validate-registry-closure.test.ts` exist beside their sources; neither re-declares `RELATIVE_JS_IMPORT`; `pnpm --filter @diffgazer/keys test` runs and passes both.

- [ ] T-717 (fixes F-253) — files: `/Users/voitz/Projects/diffgazer-workspace/libs/keys/tsconfig.test.json`
      Change: Add registry example handoff sources to the keys type-check, mirroring `libs/ui/tsconfig.test.json`. In `libs/keys/tsconfig.test.json`, add `"registry/**/*.ts"` and `"registry/**/*.tsx"` to `include` and reduce `exclude` to `["node_modules", "dist"]`, so `pnpm --filter @diffgazer/keys type-check` (which runs `tsc -p tsconfig.test.json`) validates the 18 `registry/examples/**/*.tsx` files against the package's public exports.
      Accept: `pnpm --filter @diffgazer/keys type-check` now type-checks files under `registry/examples/`; introducing a deliberate type error in one example `.tsx` fails the keys type-check; `pnpm run validate:artifacts:check` still passes.

---

### Batch 7.D — libs/ui registry test quarantine corrections (build-tooling tests + diff/ phantom buckets + .ssr + ui-collection-root integration) — files: `/Users/voitz/Projects/diffgazer-workspace/libs/ui/registry/lib/testing/*`, `/Users/voitz/Projects/diffgazer-workspace/libs/ui/registry/lib/diff/*`, `/Users/voitz/Projects/diffgazer-workspace/libs/ui/registry/ui/keyboard-navigation.integration.test.tsx`, `/Users/voitz/Projects/diffgazer-workspace/libs/ui/registry/ui/shared/`, `/Users/voitz/Projects/diffgazer-workspace/libs/ui/registry/ui/section-header/`, `/Users/voitz/Projects/diffgazer-workspace/libs/ui/registry/hooks/testing/use-active-heading.ssr.test.tsx`, `/Users/voitz/Projects/diffgazer-workspace/libs/ui/scripts/`, the relocated validators' home from Phase 1 (F-010), `/Users/voitz/Projects/diffgazer-workspace/libs/ui/vitest.config.ts`

Disjoint from all other batches (libs/ui registry/test files only). Note: `libs/ui/tsup.config.ts`/`package.json`/`build-declarations.ts` are owned by T-709 in Batch 7.A — this batch must NOT touch those three files, keeping the batches file-disjoint.

- [ ] T-718 (fixes F-153, F-254) — files: `/Users/voitz/Projects/diffgazer-workspace/libs/ui/registry/lib/testing/registry-validators.test.ts`, `/Users/voitz/Projects/diffgazer-workspace/libs/ui/registry/lib/testing/validate-registry-metadata.test.ts`, `/Users/voitz/Projects/diffgazer-workspace/libs/ui/registry/lib/testing/ui-three-path-readiness.test.ts`, `/Users/voitz/Projects/diffgazer-workspace/libs/ui/registry/lib/testing/registry-dialog-css.test.ts`, the Phase-1 validators home (formerly `libs/ui/src/validation/*`), `/Users/voitz/Projects/diffgazer-workspace/libs/ui/scripts/validate-registry-metadata.ts`, `/Users/voitz/Projects/diffgazer-workspace/libs/ui/scripts/transform-public-registry-keys-imports.ts`
      Change: Move the 4 build-tooling tests OUT of the registry copy-quarantine `registry/lib/testing/` (which must hold only 1:1 tests of copyable `registry/lib/*` source) and colocate each with its actual source: `registry-validators.test.ts` → beside the relocated validators (Phase 1 moved `src/validation/*`; place as `<validators-home>/registry-exports-validator.test.ts` etc., or one `validators.test.ts` if Phase 1 consolidated them); `validate-registry-metadata.test.ts` → `libs/ui/scripts/validate-registry-metadata.test.ts` beside the script it `execFileSync`s; `ui-three-path-readiness.test.ts` → `libs/ui/scripts/transform-public-registry-keys-imports.test.ts` (or `ui-three-path-readiness.test.ts`) beside `transform-public-registry-keys-imports.ts`; `registry-dialog-css.test.ts` → the same scripts/validators build-tooling home (it reads `registry.json` and asserts metadata). Update each moved test's relative imports to its new location. The `registry-dialog-css.test.ts` inline `RegistryFile/RegistryItem/Registry` interface re-declaration (lines 8-21) must import from the single shared registry-types source instead (the F-083/F-185 consolidation target). Ensure the keys/ui vitest include globs cover the new `libs/ui/scripts/**/*.test.ts` and validators-home test paths.
      Accept: `registry/lib/testing/` contains only tests whose basename matches a `registry/lib/*.ts(x)` source (the 6 confirmed 1:1 ones + the diff ones from T-719); the 4 moved tests live beside their build-tooling sources and run under vitest; `registry-dialog-css.test.ts` no longer re-declares registry types inline; `pnpm --filter @diffgazer/ui test` passes; `pnpm run validate:artifacts:check` confirms no `.test.` path leaks into `public/r`.

- [ ] T-719 (fixes F-209) — files: `/Users/voitz/Projects/diffgazer-workspace/libs/ui/registry/lib/testing/diff-algorithms.test.ts`, `/Users/voitz/Projects/diffgazer-workspace/libs/ui/registry/lib/testing/diff-io.test.ts`, `/Users/voitz/Projects/diffgazer-workspace/libs/ui/registry/lib/testing/resolve-diff-input.test.ts` (+ new sibling test files), against sources `/Users/voitz/Projects/diffgazer-workspace/libs/ui/registry/lib/diff/{compute,word,parse,split,resolve,identity,lcs,pairs}.ts`
      Change: Replace the 3 phantom-named cross-cutting diff buckets with 1:1 quarantined tests (kept IN `registry/lib/testing/` to preserve copy/shadcn quarantine — do NOT colocate inside `diff/`). Split `diff-algorithms.test.ts` into `compute.test.ts` (`computeDiff`, importing `../diff/compute.js`) + `word.test.ts` (`computeWordSegments`/`annotateWordDiff`/`createWordDiffBudget`, importing `../diff/word.js`). Split `diff-io.test.ts` into `parse.test.ts` (`../diff/parse.js`) + `split.test.ts` (`../diff/split.js`). Rename `resolve-diff-input.test.ts` → `resolve.test.ts` (`../diff/resolve.js`) and fold its `parse`-specific cases into `parse.test.ts`. Add `identity.test.ts`, `lcs.test.ts`, `pairs.test.ts` covering those three currently-untested modules (or fold their coverage into the test of the module that already exercises them, documenting which). Delete the 3 original bucket files.
      Accept: `registry/lib/testing/` contains one `<source>.test.ts` per `diff/*.ts` module and no `diff-algorithms`/`diff-io`/`resolve-diff-input` basename; every `diff/*.ts` source has a test home; `pnpm --filter @diffgazer/ui test` passes with no loss of assertions; `validate:artifacts:check` confirms no `.test.` leak into the diff copy entry.

- [ ] T-720 (fixes F-107) — files: `/Users/voitz/Projects/diffgazer-workspace/libs/ui/registry/ui/keyboard-navigation.integration.test.tsx`, `/Users/voitz/Projects/diffgazer-workspace/libs/ui/registry/ui/shared/`
      Change: Move `libs/ui/registry/ui/keyboard-navigation.integration.test.tsx` (the only test sitting as a direct child of `registry/ui/`) into `libs/ui/registry/ui/shared/` alongside the other cross-component integration tests (`nested-overlay-escape.test.tsx`, `portal-dialog.test.tsx`). Keep the `.integration.test` suffix and update any relative imports to reflect the one-level-deeper path.
      Accept: `registry/ui/keyboard-navigation.integration.test.tsx` no longer exists at the collection root; `registry/ui/shared/keyboard-navigation.integration.test.tsx` exists; `pnpm --filter @diffgazer/ui test` passes.

- [ ] T-721 (fixes F-183) — files: `/Users/voitz/Projects/diffgazer-workspace/libs/ui/registry/ui/section-header/section-header.ssr.test.tsx`, `/Users/voitz/Projects/diffgazer-workspace/libs/ui/registry/hooks/testing/use-active-heading.ssr.test.tsx`, `/Users/voitz/Projects/diffgazer-workspace/libs/ui/vitest.config.ts`
      Change: Replace the banned `.ssr` dot-segment per D1 by moving the SSR specs into a folder-context home wired via the vitest project's `include` glob (the wiring point is the glob, not the filename). Update the `ssr` project in `libs/ui/vitest.config.ts` (lines 31-44) to `include: ["registry/**/ssr/*.test.tsx"]`, then move `section-header/section-header.ssr.test.tsx` → `section-header/ssr/section-header.test.tsx` and `hooks/testing/use-active-heading.ssr.test.tsx` → `hooks/testing/ssr/use-active-heading.test.tsx` (creating the `ssr/` folders). Fix the stale comment in the (moved) section-header SSR test: remove the `// axe skipped: ... companion client test` line since no `section-header.test.tsx` companion exists (or add the missing companion client test if a11y coverage is genuinely wanted — minimal fix is removing the false claim).
      Accept: No `*.ssr.test.tsx` files remain under `libs/ui/registry`; the `ssr` vitest project still selects the relocated specs via the new `**/ssr/*.test.tsx` glob and runs them under the node environment; the stale companion-test comment is gone; `pnpm --filter @diffgazer/ui test` passes.

---

### Batch 7.E — apps/web test homes + onboarding swap + keys re-test deletion + dot-segment rename — files: `/Users/voitz/Projects/diffgazer-workspace/apps/web/src/hooks/use-action-row-navigation.test.tsx`, `/Users/voitz/Projects/diffgazer-workspace/apps/web/src/features/onboarding/hooks/*`, `/Users/voitz/Projects/diffgazer-workspace/apps/web/src/features/onboarding/components/*`, `/Users/voitz/Projects/diffgazer-workspace/apps/web/src/features/providers/components/api-key-dialog/`, `/Users/voitz/Projects/diffgazer-workspace/apps/web/src/features/review/components/review-results-view.keyboard.test.tsx`

Disjoint from all other batches (apps/web only). Internally, each task targets a distinct subtree.

- [ ] T-722 (fixes F-002) — files: `/Users/voitz/Projects/diffgazer-workspace/apps/web/src/hooks/use-action-row-navigation.test.tsx`
      Change: Delete `apps/web/src/hooks/use-action-row-navigation.test.tsx` and its inline synthetic `TestFooterNavigation` fixture. There is no local `use-action-row-navigation.ts` in apps/web — the hook is imported from `@diffgazer/keys`, whose contract is fully covered by `libs/keys/src/hooks/use-action-row-navigation.test.tsx` (the web cases map 1:1). This is a redundant re-test of upstream library behavior through a synthetic fixture, not a web adoption seam. Do not add a replacement; if a genuine web-integration assertion is later wanted it belongs in the test of a real consuming component.
      Accept: `apps/web/src/hooks/use-action-row-navigation.test.tsx` no longer exists; `pnpm --filter @diffgazer/web test` passes; `pnpm --filter @diffgazer/keys test` still covers `useActionRowNavigation`.

- [ ] T-723 (fixes F-113, F-109) — files: `/Users/voitz/Projects/diffgazer-workspace/apps/web/src/features/onboarding/hooks/use-onboarding.test.tsx`, `/Users/voitz/Projects/diffgazer-workspace/apps/web/src/features/onboarding/hooks/onboarding-settings-sync.test.ts`, `/Users/voitz/Projects/diffgazer-workspace/apps/web/src/features/onboarding/components/onboarding-wizard.tsx`
      Change: Unswap the onboarding test homes. `use-onboarding.test.tsx` actually renders `OnboardingWizard` (a component one dir away) — move it beside its real subject: `hooks/use-onboarding.test.tsx` → `components/onboarding-wizard.test.tsx` (use the component's current basename; if Phase 1 renamed it to `wizard.tsx`, name the test `wizard.test.tsx`). `onboarding-settings-sync.test.ts` has no matching source and actually tests the hook (`useOnboarding` from `./use-onboarding`) — rename it to match its source: `hooks/onboarding-settings-sync.test.ts` → `hooks/use-onboarding.test.ts` (or `use-wizard-state.test.ts` if Phase 1 renamed the hook). Update relative imports in both moved files. Result: the component test sits in `components/` beside the component, the hook test sits in `hooks/` beside the hook, no orphan basename remains.
      Accept: `onboarding-settings-sync.test.ts` no longer exists; the component test lives in `features/onboarding/components/` matching the component's basename; the hook test lives in `features/onboarding/hooks/` matching the hook's basename; `pnpm --filter @diffgazer/web test` passes with the same assertion count.

- [ ] T-724 (fixes F-072) — files: `/Users/voitz/Projects/diffgazer-workspace/apps/web/src/features/providers/components/api-key-dialog/dialog-footer.integration.test.tsx`
      Change: `dialog-footer.integration.test.tsx` imports and tests `ApiKeyDialog` (`./api-key-dialog`), not any `dialog-footer` source. After Phase 1's `api-key-dialog/` compound-folder drop-the-unit-name rename (the dialog component becomes `dialog.tsx`), rename this test to `dialog.integration.test.tsx` so it matches the source it actually exercises. If the Phase-1 rename is not yet applied at execution time, name it `api-key-dialog.integration.test.tsx` to match the current `api-key-dialog.tsx`.
      Accept: No `dialog-footer.integration.test.tsx` remains; the integration test's basename matches the dialog source it imports; `pnpm --filter @diffgazer/web test` passes.

- [ ] T-725 (fixes F-155) — files: `/Users/voitz/Projects/diffgazer-workspace/apps/web/src/features/review/components/review-results-view.keyboard.test.tsx`
      Change: Rename `review-results-view.keyboard.test.tsx` → `review-results-view.test.tsx` (drop the non-tooling `.keyboard` dot-segment per D1; `.keyboard` is matched only by the generic `.test` glob and wired into no vitest project, so this is a pure rename). It is the component's sole test home, so no discriminator segment is justified. This overrides the context.md `.keyboard.test` carve-out in favor of D1 + the F-038 precedent.
      Accept: No `*.keyboard.test.tsx` remains in apps/web; `review-results-view.test.tsx` is the 1:1 colocated test for `review-results-view.tsx`; `pnpm --filter @diffgazer/web test` passes.

---

### Batch 7.F — cli/server + cli/add + cli/diffgazer test homes and dist-leak excludes — files: `/Users/voitz/Projects/diffgazer-workspace/cli/server/src/shared/lib/ai/*`, `/Users/voitz/Projects/diffgazer-workspace/cli/server/tsconfig.json`, `/Users/voitz/Projects/diffgazer-workspace/cli/add/src/commands/cli-behavior.test.ts`, `/Users/voitz/Projects/diffgazer-workspace/cli/add/tests/`, `/Users/voitz/Projects/diffgazer-workspace/cli/add/vitest.config.ts`, `/Users/voitz/Projects/diffgazer-workspace/cli/diffgazer/src/cli-options.test.ts`, `/Users/voitz/Projects/diffgazer-workspace/cli/diffgazer/src/lib/servers/*.test.ts`, `/Users/voitz/Projects/diffgazer-workspace/cli/diffgazer/tests/`, `/Users/voitz/Projects/diffgazer-workspace/libs/registry/tsconfig.json`

Note: `cli/add/package.json`/`turbo.json` are owned by T-707 (Batch 7.A). This batch does not touch them. Each task targets a distinct package subtree.

- [ ] T-726 (fixes F-038) — files: `/Users/voitz/Projects/diffgazer-workspace/cli/server/src/shared/lib/ai/client.contract.test.ts`
      Change: Rename `client.contract.test.ts` → `client-contract.test.ts` (hyphen joins the concept; `.test.ts` tooling suffix stays). It is the only non-tooling dot-segment file in cli/server; the vitest include `src/**/*.test.ts` still matches; no importers reference it.
      Accept: No `*.contract.test.ts` remains in cli/server; `client-contract.test.ts` exists; `pnpm --filter @diffgazer/server test` passes.

- [ ] T-727 (fixes F-065) — files: `/Users/voitz/Projects/diffgazer-workspace/cli/server/src/shared/lib/ai/__fixtures__/models-dev-sample.ts`, `/Users/voitz/Projects/diffgazer-workspace/cli/server/src/shared/lib/ai/models-dev-catalog.test.ts`
      Change: Flatten the Jest-style parallel dir: move `__fixtures__/models-dev-sample.ts` → a colocated sibling `models-dev-sample.ts` beside `models-dev-catalog.test.ts` (drop the `.fixture` dot-segment AND the `__fixtures__` dir, consistent with D1 and the libs/core F-041 resolution in T-713). Delete the empty `__fixtures__` dir. Update the single import in `models-dev-catalog.test.ts:8` to `./models-dev-sample.js`.
      Accept: `cli/server/src/shared/lib/ai/__fixtures__/` no longer exists; `models-dev-sample.ts` sits beside its consuming test; `pnpm --filter @diffgazer/server test` passes.

- [ ] T-728 (fixes F-194) — files: `/Users/voitz/Projects/diffgazer-workspace/cli/server/tsconfig.json`, `/Users/voitz/Projects/diffgazer-workspace/libs/registry/tsconfig.json`
      Change: Stop the plain-`tsc` production builds from compiling colocated tests into `dist/`. Add `"exclude": ["**/*.test.ts", "node_modules", "dist"]` to `cli/server/tsconfig.json` (it currently has none). In `libs/registry/tsconfig.json` replace the dead `"exclude": ["src/__tests__"]` with `"exclude": ["**/*.test.ts", "src/testing", "node_modules", "dist"]` (matching the real test home `src/testing/`). Mirror `libs/core`'s exclude as the canonical pattern.
      Accept: After `pnpm --filter @diffgazer/server build`, `cli/server/dist/` contains no `*.test.js` (e.g. no `app.test.js`/`http-server.test.js`); after `pnpm --filter @diffgazer/registry build`, `libs/registry/dist/testing/` contains no `*.test.js`; both packages' `pnpm --filter ... type-check` still pass.

- [ ] T-729 (fixes F-075) — files: `/Users/voitz/Projects/diffgazer-workspace/cli/add/src/commands/cli-behavior.test.ts`, new `/Users/voitz/Projects/diffgazer-workspace/cli/add/tests/e2e/cli.e2e.ts`, `/Users/voitz/Projects/diffgazer-workspace/cli/add/vitest.config.ts`
      Change: `commands/cli-behavior.test.ts` is an 821-line binary-spawning e2e suite (`execFileSync` against a `mkdtemp` fixture) with no `commands/cli-behavior.ts` twin. Move it to `cli/add/tests/e2e/cli.e2e.ts` (mirroring `apps/docs/tests/e2e/*.e2e.ts`). Update `cli/add/vitest.config.ts` `include` to also match `tests/e2e/**/*.e2e.ts` (add the glob if absent) so the suite still runs. Rewrite the relative imports for the new depth.
      Accept: `cli/add/src/commands/cli-behavior.test.ts` no longer exists; `cli/add/tests/e2e/cli.e2e.ts` exists and is matched by the vitest include; `pnpm --filter @diffgazer/add test` still runs the e2e suite and passes.

- [ ] T-730 (fixes F-152) — files: `/Users/voitz/Projects/diffgazer-workspace/cli/diffgazer/src/cli-options.test.ts`, new `/Users/voitz/Projects/diffgazer-workspace/cli/diffgazer/tests/e2e/cli-options.e2e.ts`, `/Users/voitz/Projects/diffgazer-workspace/cli/diffgazer/src/lib/servers/embedded-server.test.ts`, `/Users/voitz/Projects/diffgazer-workspace/cli/diffgazer/src/lib/servers/server-factories.test.ts`, `/Users/voitz/Projects/diffgazer-workspace/cli/diffgazer/vitest.config.ts`
      Change: Split the grab-bag `cli-options.test.ts` (3 describes). Keep ONLY the `resolveCliAction` describe colocated as `cli-options.test.ts` (pairs with `cli-options.ts`). Move the binary-spawning `diffgazer CLI options` describe (uses `execFileSync`/`spawnSync`) to a new e2e file `cli/diffgazer/tests/e2e/cli-options.e2e.ts` (mirroring T-729 / apps/docs e2e) and extend `cli/diffgazer/vitest.config.ts` `include` to match `tests/e2e/**/*.e2e.ts`. Move the `server launcher options` assertions for `isSpaNavigationRequest` into `lib/servers/embedded-server.test.ts` and for `openBrowserAddress` into `lib/servers/server-factories.test.ts` (their colocated homes, which currently lack that coverage). Rewrite imports for each destination.
      Accept: `cli/diffgazer/src/cli-options.test.ts` contains only the `resolveCliAction` describe; the binary-spawning suite lives in `tests/e2e/cli-options.e2e.ts` (matched by vitest include); `isSpaNavigationRequest`/`openBrowserAddress` coverage lives in the two `lib/servers/*.test.ts` files; `pnpm --filter diffgazer test` passes with no lost coverage.

---

### Batch 7.G — root monorepo-tooling + apps/docs test homes and vitest jsdom config — files: `/Users/voitz/Projects/diffgazer-workspace/scripts/monorepo/*.test.mjs`, `/Users/voitz/Projects/diffgazer-workspace/scripts/monorepo/artifacts/`, `/Users/voitz/Projects/diffgazer-workspace/apps/docs/scripts/artifacts/*`, `/Users/voitz/Projects/diffgazer-workspace/apps/docs/src/lib/docs-library.test.ts`, `/Users/voitz/Projects/diffgazer-workspace/apps/docs/vite.config.ts`, new `/Users/voitz/Projects/diffgazer-workspace/apps/docs/src/test-setup.ts`, the 6 jsdom-pragma docs test files, `/Users/voitz/Projects/diffgazer-workspace/package.json` (test:scripts glob only)

Note: this batch touches `package.json` for the single `test:scripts` glob line (T-731). Batch 7.A also edits `package.json` — to keep batches file-disjoint for parallel execution, run Batch 7.G AFTER Batch 7.A completes, OR have the orchestrator assign the `package.json` `test:scripts` glob edit (T-731) into Batch 7.A's serial chain. Treat Batch 7.G as NOT parallel-safe against 7.A on `package.json`.

Note (vitest-config overlap with 7.F): T-735 in THIS batch edits all 8 non-type-test vitest configs, including `cli/add/vitest.config.ts` and `cli/diffgazer/vitest.config.ts` — the SAME two files that Batch 7.F's T-729 (`cli/add/vitest.config.ts`) and T-730 (`cli/diffgazer/vitest.config.ts`) edit. The edits are independent in content (7.F's T-729/T-730 extend the `include` glob to match `tests/e2e/**/*.e2e.ts`; 7.G's T-735 deletes the dead `typecheck` block), but they touch the same two files, so **Batch 7.G is NOT parallel-safe against Batch 7.F on those two vitest configs.** Run Batch 7.G AFTER Batch 7.F (T-729/T-730 add the e2e include first, then T-735 strips the typecheck block on the same files), OR have the orchestrator fold the two `include`-glob edits into T-735 so each vitest config is written by exactly one task. Apart from `package.json` (vs 7.A) and these two vitest configs (vs 7.F), Batch 7.G is parallel-safe against 7.B–7.E.

- [ ] T-731 (fixes F-074) — files: `/Users/voitz/Projects/diffgazer-workspace/scripts/monorepo/run-checks.test.mjs`, `/Users/voitz/Projects/diffgazer-workspace/scripts/monorepo/benchmark-slo.test.mjs`, `/Users/voitz/Projects/diffgazer-workspace/scripts/monorepo/smoke-modelsdev.test.mjs`, `/Users/voitz/Projects/diffgazer-workspace/scripts/monorepo/artifacts/`, `/Users/voitz/Projects/diffgazer-workspace/package.json`
      Change: Colocate the three stranded tooling tests with their `artifacts/` modules: move `scripts/monorepo/run-checks.test.mjs` → `scripts/monorepo/artifacts/run-checks.test.mjs`, `benchmark-slo.test.mjs` → `artifacts/benchmark-slo.test.mjs`, `smoke-modelsdev.test.mjs` → `artifacts/smoke-modelsdev.test.mjs`, rewriting each import from `./artifacts/x.mjs` to `./x.mjs`. Change the root `package.json` `test:scripts` script glob from `scripts/monorepo/*.test.mjs` to `scripts/monorepo/**/*.test.mjs` (recursive) so both the colocated `artifacts/` tests and the existing root-level `registry-closure.test.mjs`/`package-scripts.test.mjs` run.
      Accept: `scripts/monorepo/artifacts/` holds the three moved `*.test.mjs` beside their modules; root `package.json` `test:scripts` uses `**`; `pnpm run test:scripts` discovers and passes all monorepo tooling tests including the relocated ones.

- [ ] T-732 (fixes F-073) — files: `/Users/voitz/Projects/diffgazer-workspace/apps/docs/scripts/artifacts/sync.test.ts`, `/Users/voitz/Projects/diffgazer-workspace/apps/docs/scripts/artifacts/validation.test.ts`, `/Users/voitz/Projects/diffgazer-workspace/apps/docs/scripts/artifacts/fixture.ts`, `/Users/voitz/Projects/diffgazer-workspace/scripts/monorepo/artifacts/`
      Change: The two docs-hosted tests reach four `../` levels into `scripts/monorepo/artifacts/{sync,validation,pack-surface}.mjs`. Move the ROOT-tooling assertions to colocated siblings of those root modules: create `scripts/monorepo/artifacts/sync.test.mjs` and `validation.test.mjs` (the latter covering `pack-surface`), relocating the shared `fixture.ts` helper there (as `fixture.mjs` to match the node `--test` runner, or keep `.ts` and run via the docs vitest if it stays a vitest test — prefer node `--test` to match T-731's siblings). KEEP in `apps/docs/scripts/` only genuine docs-integration cases (re-targeted as `*.integration.test.ts` against the docs `sync-artifacts.mjs` entry); if no docs-specific case remains, delete the docs-hosted files entirely.
      Accept: `apps/docs/scripts/artifacts/sync.test.ts`/`validation.test.ts` no longer reach into `../../../../scripts/monorepo`; the root-tooling assertions live in `scripts/monorepo/artifacts/*.test.mjs` (covered by T-731's recursive glob); any remaining docs file is a true docs-integration test; `pnpm run test:scripts` and `pnpm --filter @diffgazer/docs test` pass.

- [ ] T-733 (fixes F-184) — files: `/Users/voitz/Projects/diffgazer-workspace/apps/docs/src/lib/docs-library.test.ts`, new `/Users/voitz/Projects/diffgazer-workspace/apps/docs/scripts/artifacts/docs-example-wiring.test.ts`
      Change: Split the 669-line `docs-library.test.ts` by responsibility. Keep a focused `apps/docs/src/lib/docs-library.test.ts` covering ONLY `docs-library.ts`'s own exports (`getInstallCommand`, `LOCAL_DGADD_PREREQUISITE`, `routeSlugsFromSourcePath`, `sourceSlugsForLibrary`). Move the ~240-line repo-walking harness (lines 16-245: `collectExampleRefsFromComponentDocs`, `collectExampleRefsFromHookDocs`, `collectMdxExampleRefs`, `collectPublicDocsSources`, rooted at `repoRoot`) plus its dependent `it`s into a new `apps/docs/scripts/artifacts/docs-example-wiring.test.ts` (alongside the other repo-validation tests T-732 relocates), so each file has one responsibility and a truthful test home.
      Accept: `docs-library.test.ts` is a small unit test of `docs-library.ts`'s exports only (no `repoRoot` filesystem walk); the cross-package example-wiring validation lives in `apps/docs/scripts/artifacts/docs-example-wiring.test.ts`; `pnpm --filter @diffgazer/docs test` passes with no lost assertions.

- [ ] T-734 (fixes F-217) — files: `/Users/voitz/Projects/diffgazer-workspace/apps/docs/vite.config.ts`, new `/Users/voitz/Projects/diffgazer-workspace/apps/docs/src/test-setup.ts`, `/Users/voitz/Projects/diffgazer-workspace/apps/docs/src/features/home/components/home-view.test.tsx`, `/Users/voitz/Projects/diffgazer-workspace/apps/docs/src/components/source-viewer.test.tsx`, and the other 4 docs React test files carrying the jsdom pragma (search-context, toc, seo, docs-library/component tests)
      Change: Add a global jsdom default + setupFiles to the docs vitest config matching the sibling React surfaces. In `apps/docs/vite.config.ts`, extend the `test: isVitest ? {...}` object with `environment: "jsdom"` and `setupFiles: ["./src/test-setup.ts"]` (keep the existing `typecheck` section — but note F-144/T-735 removes that section; coordinate so the final object has jsdom env + setupFiles and no dead typecheck block). Create `apps/docs/src/test-setup.ts` mirroring `apps/web/src/test-setup.ts` (`import "@testing-library/jest-dom/vitest";` + `afterEach(cleanup)` from `@testing-library/react`). Delete the now-redundant `// @vitest-environment jsdom` first-line pragma, the inline `import "@testing-library/jest-dom/vitest"`, and the per-file `afterEach(cleanup)` from the 6 affected docs React test files. The pure-node script tests under `apps/docs/scripts/**` keep working under jsdom (or, if any needs node, gate it with a per-file `// @vitest-environment node`).
      Accept: `apps/docs/vite.config.ts` test block sets `environment:"jsdom"` + `setupFiles:["./src/test-setup.ts"]`; `apps/docs/src/test-setup.ts` exists; none of the 6 React test files carry a `// @vitest-environment jsdom` pragma or inline jest-dom import; `pnpm --filter @diffgazer/docs test` passes (a docs component test that omits a pragma now still renders under jsdom).

- [ ] T-735 (fixes F-144) — files: `/Users/voitz/Projects/diffgazer-workspace/apps/web/vitest.config.ts`, `/Users/voitz/Projects/diffgazer-workspace/apps/landing/vitest.config.ts`, `/Users/voitz/Projects/diffgazer-workspace/apps/docs/vite.config.ts`, `/Users/voitz/Projects/diffgazer-workspace/cli/add/vitest.config.ts`, `/Users/voitz/Projects/diffgazer-workspace/cli/diffgazer/vitest.config.ts`, `/Users/voitz/Projects/diffgazer-workspace/cli/server/vitest.config.ts`, `/Users/voitz/Projects/diffgazer-workspace/libs/core/vitest.config.ts`, `/Users/voitz/Projects/diffgazer-workspace/libs/registry/vitest.config.ts`, the `test:types` script in each of those 8 `package.json` files
      Change: Remove the dead `test:types` ceremony from the 8 packages that contain zero `expectTypeOf`/`assertType`/`test-d` type-level tests (apps/web, apps/landing, apps/docs, cli/add, cli/diffgazer, cli/server, libs/core, libs/registry). Delete the `"test:types"` script from each of their `package.json` files and delete the `typecheck: {...}` block (`enabled:false`) from each vitest config (for `apps/docs` this is the `typecheck` section inside the `test:` object that T-734 also edits — coordinate: leave jsdom env + setupFiles, remove only the typecheck sub-block). KEEP `test:types` + `typecheck.enabled:true` in `libs/keys` and `libs/ui` (the only two with real type tests). The turbo `test:types` task then naturally scopes to keys+ui via task discovery — do NOT remove the turbo task or the gate steps.
      Accept: `rg "test:types" --glob package.json` returns matches only in `libs/keys`, `libs/ui` (and the root orchestration `package.json`/`turbo.json`); the 8 vitest configs have no `typecheck` block; `pnpm exec turbo run test:types` runs only for keys+ui and passes; `rg "expectTypeOf|assertType" libs/keys libs/ui` still returns the real type tests.

      Note on the apps/docs ordering conflict: T-734 and T-735 both edit `apps/docs/vite.config.ts`. They are in the same batch (7.G) and MUST be applied to that file in sequence (T-734 adds jsdom env + setupFiles; T-735 strips the dead typecheck block). They are not independent edits to that one file — the executor applies both before moving on.

---

### Phase exit

All gates below must pass before this phase is considered complete (run in this order per the D7 refactor-verification protocol; broaden once the blast radius crosses packages):

1. `DIFFGAZER_SKIP_ARTIFACT_PREPARE=1 pnpm exec turbo run type-check` — project references make any boundary/coverage breakage a hard error; this phase added registry-example type-check coverage (T-717) and dist-leak excludes (T-714/T-715/T-728), so type-check must be clean across all workspaces.
2. FULL `DIFFGAZER_SKIP_ARTIFACT_PREPARE=1 pnpm exec turbo run test` (NOT `--affected` — refactor ripple under-counts) — every relocated/split/renamed/merged test must still run and pass with no lost assertions; the deleted redundant test (T-722) and the e2e relocations (T-729/T-730) must still be discovered by their vitest includes.
3. `pnpm run test:scripts` — confirms the recursive `scripts/monorepo/**/*.test.mjs` glob (T-731) discovers the colocated `artifacts/` tooling tests and the relocated root assertions (T-732).
4. `pnpm run prepare:artifacts` then `pnpm run validate:artifacts:check` — REQUIRED: this phase touches the public registry/handoff surface (libs/ui packaging assertion T-709, registry-quarantine test moves T-718/T-719, keys registry-example type-check T-717); validate that no `.test.`/`.stories.` path leaks into `public/r`, that the packed `@diffgazer/ui`/`@diffgazer/keys` tarballs contain no `dist/testing/*` or orphan dist entries, and that the registry copy/shadcn/package paths still build.
5. `pnpm run check` (now fanning out to all 10 workspaces via T-702) and `pnpm run depcruise` (T-704) — both green on the realized tree; the new Biome `useFilenamingConvention` + barrel-ban rules (T-703) and the dependency-cruiser boundary/circular/orphan rules pass. `pnpm run knip` (T-705) runs as a non-blocking report (staged adoption).
6. `DIFFGAZER_SMOKE_STRICT_SKIPS=1 pnpm run smoke` — REQUIRED: this phase changed turbo build wiring for CLI/web/landing (T-707 cli/add test dependsOn, T-708 landing/web build-env) and dist excludes for the binary-bundled `cli/server` (T-728); the smoke suite validates the CLI bin, package install, shadcn copy, and the bundled offline catalog snapshot.
7. `pnpm run verify:monorepo` (check-invariants) — confirms package-script/manifest invariants still hold after the `test`/`test:types`/`check` script edits.
8. `git diff --check` — no whitespace/conflict artifacts.


---

## Phase 8 — Hygiene & docs

Sequenced last so every doc, AGENTS.md taxonomy, gitignore, tsconfig, CI, and dev-script
config describes the FINAL tree: this phase deletes the D8 (+ F-088/F-097 parallel) root
clutter, removes the gitignore knock-ons those deletions leave behind, canonizes the per-surface
taxonomy (D3) into AGENTS.md, and corrects every doc-vs-tree / config-drift truth fault. Running
it last guarantees the prose and config match the structure the earlier phases produced (D5 mirror
removal, D6 barrel dissolution, the move/rename passes) rather than describing an intermediate state.

Cross-phase note: this phase does NOT perform the D5 docs-registry-mirror removal itself — that
belongs to the docs/registry phase. Phase 8 only corrects the documentation/gitignore lines that
DESCRIBE the mirror (README.md:14 in T-803, apps/docs/.gitignore registry/ + styles/ in T-802),
and those tasks are written to be applied whether or not the executor runs them in the same PR as
the D5 removal — they correct prose/ignore-rules to match the post-removal tree.

---

### Batch 8.A — files: agent-specs/ (21 files), libs/ui/specs/ (184 files), AUDIT_2026-05-24.md, OPUS_AUDIT_2026-05-24.md, FIX_SPEC_2026-05-24.md, specs/archive/ (61 files), audits/ (41 files, dated dirs 2026-05-28 / 2026-05-31 / 2026-06-01), .gitignore, apps/docs/.gitignore

Root + per-package clutter deletions (D8 plus the F-088/F-097 parallels) and every gitignore
knock-on. All `.gitignore` edits live here so no other batch touches an ignore file.

- [ ] T-801 (fixes F-088, F-097) — files: agent-specs/, libs/ui/specs/, AUDIT_2026-05-24.md, OPUS_AUDIT_2026-05-24.md, FIX_SPEC_2026-05-24.md, specs/archive/, audits/
      Change: Delete, as a single tracked-clutter removal (recoverable from git history), exactly these
        paths from the worktree via `git rm -r`:
        (1) D8 root dumps: `AUDIT_2026-05-24.md`, `OPUS_AUDIT_2026-05-24.md`, `FIX_SPEC_2026-05-24.md`;
        (2) D8 stale spec/audit trees: `specs/archive/` (61 files) and the entire `audits/` directory
            (41 files; dated dirs `2026-05-28`, `2026-05-31`, `2026-06-01`);
        (3) F-088 parallel: the entire `agent-specs/` directory (21 tracked `.md` files);
        (4) F-097 parallel: the entire `libs/ui/specs/` directory (184 files across the 020-/030- audit dirs).
        DO NOT delete `agent-skills/diffgazer-project-rules/SKILL.md` — it is the current project-rules
        skill and MUST be kept. Before deleting, the executor must have confirmed (already verified during
        audit) that the only inbound references to the three root dumps live inside `audits/` itself
        (audits/2026-05-28/REPO-MAP.md and INDEX.md), which is deleted in the same task, so no live code,
        script, turbo task, or doc outside the deleted set references any target.
      Accept: `git status --short` shows the listed paths as deletions and nothing else under them;
        `agent-skills/diffgazer-project-rules/SKILL.md` is still tracked; `rg -l 'agent-specs/|libs/ui/specs/|AUDIT_2026-05-24|OPUS_AUDIT_2026-05-24|FIX_SPEC_2026-05-24'`
        over the worktree (excluding `.nuke/`, `node_modules`, `pnpm-lock.yaml`) returns zero hits; type-check + full test suite pass.

- [ ] T-802 (fixes F-204, F-191, F-199) — files: .gitignore, apps/docs/.gitignore
      Change:
        (a) F-204 — In root `.gitignore`, delete the three now-dead audit-dump patterns at lines 30-32:
            `AUDIT_*.md`, `OPUS_AUDIT_*.md`, `FIX_SPEC_*.md` (they described artifacts T-801 just removed and
            the repo will no longer produce). KEEP the matching `.dockerignore` entries — they correctly
            exclude any stray dump from the Docker build context, so do NOT touch `.dockerignore`.
        (b) F-191 — Move the three workspace-local generated-tree ignores out of root `.gitignore` lines 23-25
            (`/cli/add/src/generated/`, `/libs/keys/docs/generated/`, `/libs/ui/docs/generated/`) into per-package
            `.gitignore` files at the owning workspace root, matching the existing apps/docs local convention:
            create `cli/add/.gitignore` containing `src/generated/`, `libs/keys/.gitignore` containing
            `docs/generated/`, and `libs/ui/.gitignore` containing `docs/generated/`. Root `.gitignore` keeps only
            truly cross-cutting ignores (node_modules, dist, .turbo, coverage, tmp, *.tsbuildinfo, *.tgz, etc.).
        (c) F-199 — In `apps/docs/.gitignore`, delete the dead line 9 `content/docs/components/` (the sync
            materializer writes component MDX to `content/docs/ui/components/`, never to a top-level
            `content/docs/components/`; the dir has never existed). Keep the live `content/docs/ui/` and
            `content/docs/keys/` materialization ignores.
      Accept: root `.gitignore` no longer contains any `AUDIT_*`/`OPUS_*`/`FIX_SPEC_*` pattern nor any
        `*/generated/` workspace path; `cli/add/.gitignore`, `libs/keys/.gitignore`, `libs/ui/.gitignore` exist
        with their single generated-dir line each; `apps/docs/.gitignore` no longer contains `content/docs/components/`;
        `.dockerignore` is unchanged; `git check-ignore cli/add/src/generated/x` and `libs/ui/docs/generated/x`
        still report ignored; `git status --short` shows no newly-untracked generated output.

---

### Batch 8.B — files: AGENTS.md, README.md, TESTING.md, .github/copilot-instructions.md, libs/registry/README.md, DEPLOYMENT_PLAN.md, scripts/README.md, cli/diffgazer/README.md, libs/ui/README.md, libs/keys/README.md, cli/add/README.md

Documentation truth-sync (every doc now describes the final tree) plus the D3 per-surface taxonomy
canonization. Disjoint from every other batch (no config or source files).

- [ ] T-803 (fixes F-223) — files: README.md
      Change: In `README.md`, amend the workspace bullet (currently line 14
        `- \`apps/docs\` - documentation app and generated registry artifacts`) to drop the
        `and generated registry artifacts` clause, leaving `- \`apps/docs\` - documentation app`.
        This matches the D5 decision that docs consumes `@diffgazer/ui` source directly and no longer
        ships a mirrored registry tree.
      Accept: `README.md` no longer contains the substring `generated registry artifacts`; the apps/docs
        bullet reads `- \`apps/docs\` - documentation app`.

- [ ] T-804 (fixes F-102) — files: TESTING.md
      Change: In `TESTING.md` line 3, change `Vitest 4 for all 9 packages` to `Vitest 4 for all 10 packages`
        and add `apps/landing` to the enumerated parenthetical package list (it has `"test": "vitest run"`,
        a real `App.test.tsx`, and a vitest-axe dependency). The corrected list is the 10 workspaces:
        libs/core, libs/keys, libs/registry, libs/ui, apps/web, apps/docs, apps/landing, cli/add, cli/diffgazer, cli/server.
      Accept: `TESTING.md:3` says `10 packages` and the enumerated list contains `apps/landing`; no other
        package is dropped.

- [ ] T-805 (fixes F-141) — files: .github/copilot-instructions.md
      Change: In `.github/copilot-instructions.md`, replace the wrong `libs/server` workspace bullet (line 18,
        `- \`libs/server\` - private Hono server used by the product.`) with the correct path
        `- \`cli/server\` - private \`@diffgazer/server\` embedded Hono backend.`, and add a missing bullet
        `- \`apps/landing\` - private \`@diffgazer/landing\` marketing/landing page.`, so the "Primary workspace
        roots" list matches README.md:9,16. No other content changes.
      Accept: `.github/copilot-instructions.md` contains no `libs/server` reference, contains a `cli/server`
        bullet and an `apps/landing` bullet; the workspace-root list enumerates all 10 workspaces consistently
        with README.md.

- [ ] T-806 (fixes F-103) — files: libs/registry/README.md
      Change: In `libs/registry/README.md`, delete the self-contradicting "## Compatibility note" section
        (lines 115-119) that names `@diffgazer/registry` as BOTH the legacy and the active package name. The
        package name IS `@diffgazer/registry` and there is no prior published name, so the note conveys nothing.
        Remove the heading and its body; leave the preceding `## License` / `MIT` block intact.
      Accept: `libs/registry/README.md` contains no `Compatibility note` heading and no "legacy standalone
        package name" sentence; the file still ends with valid content (License section intact).

- [ ] T-807 (fixes F-101) — files: DEPLOYMENT_PLAN.md
      Change: In `DEPLOYMENT_PLAN.md`, remove every reference to the removed `apps/hub` deployable and the
        nonexistent `deploy/hub.Dockerfile`: the `b4r7.dev -> hub` routing row (~line 14), the section 2.6
        "Create apps/hub" block (~lines 295-360) including `apps/hub/public/index.html` and `deploy/hub.Dockerfile`,
        the Coolify "hub" service entry (~lines 454-460), the `apps/hub/**` watch-path references, and the hub row
        in the resource table (~lines 584-594). The on-disk truth is `apps/` = {docs, landing, web} only,
        `deploy/hub.Dockerfile` does not exist, and `docker-compose.yml` has no hub service. Keep all
        docs/landing/web deployment content accurate. (If the executor finds DEPLOYMENT_PLAN.md is fully
        superseded by `deploy/REVERSE_PROXY.md` + `docker-compose.yml`, deleting the file is an acceptable
        alternative — but the default is surgical removal of the hub content only.)
      Accept: `rg -i 'hub' DEPLOYMENT_PLAN.md` returns no apps/hub, deploy/hub.Dockerfile, b4r7.dev-hub,
        Coolify-hub-service, or apps/hub watch-path references; OR the file is deleted; the three live
        deployables (docs, landing, web) remain documented.

- [ ] T-808 (fixes F-258) — files: scripts/README.md
      Change: In `scripts/README.md`, replace the stale hand-curated "## Active Files" list (lines 15-21, which
        names only 5 of the 18+ live top-level `scripts/monorepo/` modules) with EITHER (a) a brief statement
        that `package.json` scripts are the source of truth, e.g. "The live monorepo scripts are wired through
        the root `package.json` scripts (verify:monorepo, validate:artifacts:check, smoke:*, bench, smoke:modelsdev,
        release-check); see `package.json` for the authoritative invocation list and `scripts/monorepo/` for the
        modules.", OR (b) a complete grouped enumeration keyed to the root scripts that invoke them, covering at
        least check-invariants.mjs, validate-artifacts.mjs, the smoke-*.mjs family (smoke-cli, smoke-package-install,
        smoke-shadcn-install, smoke-modelsdev, smoke-keys-absent, smoke-shared, smoke-package-fixtures,
        smoke-package-runner), benchmark-server.mjs, registry-closure.mjs, the run-with-artifacts.sh wrapper, and
        the scripts/monorepo/artifacts/ infra subtree. Option (a) is preferred (no future drift).
      Accept: `scripts/README.md` no longer presents a 5-item list implying those are the only active scripts;
        it either points at package.json as source of truth or enumerates the full live surface; no nonexistent
        script is named.

- [ ] T-809 (fixes F-228) — files: cli/diffgazer/README.md, libs/ui/README.md, libs/keys/README.md, cli/add/README.md, README.md
      Change: Make the npm publish-status claim uniform across the published-package READMEs. The root and three
        sibling READMEs all assert the `@diffgazer/*` family is "external publish-gated as of May 2026" with public
        npm commands valid only after `npm view` returns versions (README.md:42, libs/ui/README.md:7,
        libs/keys/README.md:7 & :19, cli/add/README.md:12 & :16). Replace the contradicting block in
        `cli/diffgazer/README.md` (line 36 "The public `diffgazer` npm package is published. Run `npm view diffgazer
        version`..." and the unconditional `npm install -g diffgazer` instruction at lines 39-40) with the same
        publish-gated wording, e.g.: "`diffgazer` is external publish-gated as of May 2026; public
        `npm install -g diffgazer` / `npx diffgazer` commands are valid only after `npm view diffgazer version`
        succeeds. Use the workspace dev/start commands until then." Verify the other four READMEs already match this
        contract and leave them unchanged unless an inconsistency is found; the goal is ONE source of truth for
        publish status across the family.
      Accept: `cli/diffgazer/README.md` no longer states `diffgazer` "is published" nor instructs an unconditional
        `npm install -g diffgazer`; its publish-status language matches the publish-gated wording in
        README.md/libs/ui/libs/keys/cli/add READMEs; `rg -n 'publish-gated' cli/diffgazer/README.md` returns a hit.

- [ ] T-810 (fixes F-088, F-097) — files: AGENTS.md
      Change: This is the documentation half of the F-088/F-097 deletions (T-801 does the file removal). Add a new
        `## Per-Surface Taxonomy` section to `AGENTS.md` (insert it between `## Architecture Boundaries` and
        `## Extraction Rules`) that canonizes the D3 per-surface structure models so AGENTS.md describes the final
        tree as the single source of truth. The section must state, concisely:
          - Bulletproof-react PRINCIPLES apply everywhere (vertical slices, unidirectional imports shared→features→app,
            rule of two, colocate-first).
          - Bulletproof DIR TAXONOMY applies to UI surfaces ONLY: `apps/web`, `apps/docs`, `apps/landing`, and the
            `cli/diffgazer` Ink TUI use `app/` (providers + router + thin routes), on-demand
            `features/<x>/{components,hooks,...}`, and shared `components/{ui,shared,layout}`, `hooks/`, `lib/`,
            `config/`, `types/`, `testing/`.
          - `cli/server` stays a Hono feature-backend: `createApp()` factory separate from the serve entry,
            `features/<domain>/{router,service,schemas,types}` mounted via `app.route()`, colocated zod schemas,
            `shared/{lib,middlewares}/`, NO Rails-style controllers.
          - `cli/add` stays a command-CLI: `commands/` (one file or folder per subcommand, spec+handler split),
            domain logic in `utils/`/lib packages, NOT bulletproof-react taxonomy.
          - Publishable libraries (`libs/core|ui|keys|registry`) organize by domain module behind ONE `src/index.ts`
            public entry plus granular subpath `exports`; NO `features/` taxonomy; `libs/ui` keeps the per-component
            registry folders with colocated tests and per-component `index.ts` (sanctioned distribution surface).
        Keep it short (a table or tight bullet list); do not restate the full Architecture Boundaries section.
      Accept: `AGENTS.md` contains a `## Per-Surface Taxonomy` section placed before `## Extraction Rules` that
        names each of the 10 workspaces' surface model (UI-taxonomy surfaces, Hono server, command CLI, libraries)
        consistent with D3 and context.md §"Per-workspace structure prescriptions"; no contradiction with the
        existing `## Architecture Boundaries` ownership bullets.

---

### Batch 8.C — files: libs/core/tsconfig/base.json, libs/core/tsconfig/node.json, libs/core/tsconfig/react.json, cli/server/tsconfig.json, cli/add/tsconfig.json, cli/add/tsconfig.test.json, libs/registry/tsconfig.json, libs/keys/tsconfig.json, libs/ui/tsconfig.json, libs/ui/tsconfig.tools.json, libs/ui/scripts/tsconfig.json, libs/ui/package.json, apps/web/tsconfig.app.json, apps/landing/tsconfig.app.json, apps/docs/tsconfig.json

All tsconfig topology / compiler-option drift, plus the libs/ui 4th-config consolidation. Disjoint
from the doc batch and from the remaining-config batch (those touch biome/CI/dev-script/test-setup
files only, never a tsconfig).

- [ ] T-811 (fixes F-181, F-189) — files: libs/core/tsconfig/base.json, libs/core/tsconfig/node.json, libs/core/tsconfig/react.json, cli/server/tsconfig.json, cli/add/tsconfig.json, cli/add/tsconfig.test.json, libs/registry/tsconfig.json, libs/keys/tsconfig.json, libs/ui/tsconfig.json
      Change: Make the shared `libs/core/tsconfig/` presets the single source of truth and resolve the
        moduleResolution + `lib` drift:
        (a) Node-emitting packages standardize on NodeNext resolution to match their `tsc` dist emit. `cli/server`
            builds with `tsc` but currently inherits `module: ESNext` / `moduleResolution: Bundler` via
            node.json→base.json while its own `tsconfig.test.json` already overrides to NodeNext — introduce a
            `libs/core/tsconfig/node-nodenext.json` preset (extends node.json, sets `module: NodeNext` +
            `moduleResolution: NodeNext`) and make `cli/server/tsconfig.json`, `cli/add/tsconfig.json`, and
            `libs/registry/tsconfig.json` extend it (dropping their hand-inlined NodeNext options). Point
            `cli/add/tsconfig.test.json` at a node-nodenext test preset so source and tests agree (no Bundler in a
            NodeNext package).
        (b) The four main tsconfigs that currently extend nothing — `cli/add/tsconfig.json`, `libs/registry/tsconfig.json`,
            `libs/keys/tsconfig.json`, `libs/ui/tsconfig.json` — must extend a shared preset and keep only genuine
            package-local deltas: cli/add + libs/registry → the new `node-nodenext.json`; libs/keys + libs/ui →
            `../../libs/core/tsconfig/react.json`.
        (c) Normalize `lib` to one value repo-wide. Either bump the shared `base.json`/`react.json` `lib` to
            `ES2023` (DOM variants added in react.json) so everyone inherits it, OR set `lib: ["ES2022"]` in
            `libs/ui/tsconfig.json` to match base. Pick the bump-base option (least churn) and remove the
            now-redundant inlined `lib: ["ES2023", "DOM", "DOM.Iterable"]` from `libs/ui/tsconfig.json` so it inherits.
        Keep `Bundler` resolution only for the no-emit / vite / tsup-bundled surfaces (apps, libs/ui, libs/keys,
        cli/diffgazer).
      Accept: `cli/server/tsconfig.json`, `cli/add/tsconfig.json`, `libs/registry/tsconfig.json` all resolve to
        `moduleResolution: NodeNext` (via the shared node-nodenext preset) and their test configs agree; no main
        tsconfig in cli/add/libs/registry/libs/keys/libs/ui hand-inlines `target`/`module`/`moduleResolution`/`lib`
        that the preset already provides; `target` and `lib` agree repo-wide (one `lib` value across all 14 configs);
        `DIFFGAZER_SKIP_ARTIFACT_PREPARE=1 pnpm exec turbo run type-check` passes; `cli/server` and `libs/registry`
        `tsc` builds still emit runnable Node ESM.

- [ ] T-812 (fixes F-200, F-201) — files: apps/web/tsconfig.app.json, apps/landing/tsconfig.app.json, apps/docs/tsconfig.json, libs/core/tsconfig/react.json
      Change:
        (a) F-200 — Make both `apps/web/tsconfig.app.json` and `apps/landing/tsconfig.app.json` extend
            `../../libs/core/tsconfig/react.json` and keep only genuinely app-local deltas (vite/client types, path
            aliases, tsBuildInfoFile). The two currently diverge in OPPOSITE directions (web sets the linting flags
            but omits noUncheckedIndexedAccess; landing sets noUncheckedIndexedAccess but omits the linting flags).
            Lift the agreed strictness set — `noUnusedLocals`, `noUnusedParameters`, `noUncheckedIndexedAccess` —
            into `libs/core/tsconfig/react.json` so the two SPAs cannot drift apart again; remove those flags from the
            two app configs once they inherit them.
        (b) F-201 — Set `verbatimModuleSyntax: true` in `apps/docs/tsconfig.json` (currently the only config in the
            repo with it `false`, line 15) to match the shared base preset and both sibling apps, and fix any
            resulting type-only-import errors. If a fumadocs-mdx / TanStack-Start constraint genuinely requires it
            off, instead add an inline comment in apps/docs/tsconfig.json citing the specific constraint so the
            divergence is documented rather than silent — but the default action is to enable it.
      Accept: `apps/web/tsconfig.app.json` and `apps/landing/tsconfig.app.json` both `extends`
        `../../libs/core/tsconfig/react.json`; the strictness set (noUnusedLocals/Parameters/noUncheckedIndexedAccess)
        lives in react.json and is no longer separately inlined in the two apps; `apps/docs/tsconfig.json` has
        `verbatimModuleSyntax: true` (or a justifying comment if off); `turbo run type-check` passes for web, landing, docs.

- [ ] T-813 (fixes F-218) — files: cli/add/tsconfig.json
      Change: In `cli/add/tsconfig.json` line 2, change the broken `$schema` URL from
        `https://json-schema.org/tsconfig` (a nonexistent resource) to the canonical
        `https://json.schemastore.org/tsconfig` used by every other config in the repo (including the sibling
        `cli/add/tsconfig.test.json`).
      Accept: `cli/add/tsconfig.json` `$schema` is `https://json.schemastore.org/tsconfig`; `rg -n 'json-schema.org/tsconfig'`
        across the repo returns zero hits.

- [ ] T-814 (fixes F-100) — files: libs/ui/tsconfig.tools.json, libs/ui/scripts/tsconfig.json, libs/ui/package.json
      Change: Collapse libs/ui from four type-check passes to three (matching libs/keys/libs/core). Delete
        `libs/ui/tsconfig.tools.json` (the ui-only 4th config that double-covers `scripts/` and `shared/` and triple-covers
        `shared/`). Add `tsup.config.ts` (the only file uniquely needing the tools config) to the `include` of
        `libs/ui/scripts/tsconfig.json`, and let `libs/ui/scripts/tsconfig.json` cover `scripts/` plus any relocated
        build validators. Update the `type-check` script in `libs/ui/package.json` (line 319) to drop the
        `-p tsconfig.tools.json` pass so it runs the same 3-config shape as libs/keys/libs/core. NOTE: this task assumes
        the earlier libs/ui src/+shared/ consolidation phase has already relocated the build validators / removed the
        `shared/` folder; if `shared/` still exists when this runs, keep its coverage by adding `shared/**/*.ts` to the
        scripts tsconfig include instead of dropping it.
      Accept: `libs/ui/tsconfig.tools.json` no longer exists; `libs/ui/package.json` `type-check` runs three tsc passes
        (no reference to `tsconfig.tools.json`); `tsup.config.ts` and `scripts/` are still type-checked (no file silently
        drops out of coverage); `pnpm --filter @diffgazer/ui type-check` passes.

---

### Batch 8.D — files: .editorconfig (new), .gitattributes (new), biome.root.json, apps/docs/biome.json, libs/ui/test-setup.ts → libs/ui/src/test-setup.ts, libs/ui/vitest.config.ts, .github/workflows/deploy.yml, cli/add/package.json

Remaining editor/format/CI/dev-script hygiene. Touches no tsconfig (8.C), no doc (8.B), and no
gitignore/clutter (8.A) file, so it is parallel-safe with all three.

- [ ] T-815 (fixes F-193) — files: .editorconfig (new), .gitattributes (new), biome.root.json, apps/docs/biome.json
      Change: The repo has no `.editorconfig` and no `.gitattributes`; with `biome.root.json` formatter disabled
        (`formatter.enabled: false`) and apps/docs the only auto-discoverable Biome config (tab-indented), indentation
        and line-endings are unenforced for editors that do not read Biome.
        (a) Create a root `.editorconfig` encoding the house style: `root = true`; `[*]` block with
            `indent_style = space`, `indent_size = 2`, `end_of_line = lf`, `insert_final_newline = true`,
            `charset = utf-8`, `trim_trailing_whitespace = true`. If the apps/docs tab indentation is intentional, add
            an `[apps/docs/**]` override with `indent_style = tab`; otherwise omit the override and converge docs to spaces.
        (b) Create a root `.gitattributes` with `* text=auto eol=lf`, and mark the committed generated trees so they
            stop polluting diffs and language stats: `libs/core/src/catalog/catalog-snapshot.ts linguist-generated=true`,
            `libs/ui/public/r/** linguist-generated=true`, `libs/keys/public/r/** linguist-generated=true` (optionally add
            `-diff` to those globs). Do NOT alter the content of the generated files.
        (c) Do not change `biome.root.json` / `apps/docs/biome.json` content beyond what F-182 (a different phase) owns;
            this task only adds the editor-agnostic configs. The `biome.root.json` and `apps/docs/biome.json` paths are
            listed here only because the editorconfig must encode the SAME indentation policy those Biome configs already
            express — read them to confirm the indent values you encode, but the structural biome-rename/extends work is
            out of scope for this task.
      Accept: root `.editorconfig` exists with `root = true` and a `[*]` block setting space/2/lf/final-newline; root
        `.gitattributes` exists with `* text=auto eol=lf` and `linguist-generated` marks on the three committed generated
        trees; no generated file content changed; type-check + tests still pass.

- [ ] T-816 (fixes F-165) — files: libs/ui/test-setup.ts → libs/ui/src/test-setup.ts, libs/ui/vitest.config.ts
      Change: Standardize the vitest setup-file location on the repo's src-rooted convention (apps/web and apps/landing
        already use `src/test-setup.ts`). Move `libs/ui/test-setup.ts` to `libs/ui/src/test-setup.ts` and update the
        `setupFiles` reference in `libs/ui/vitest.config.ts` (currently `setupFiles: ["./test-setup.ts"]` at line 22) to
        `setupFiles: ["./src/test-setup.ts"]`. Do the move as a pure rename (no content edit to the setup file).
      Accept: `libs/ui/src/test-setup.ts` exists, `libs/ui/test-setup.ts` does not; `libs/ui/vitest.config.ts`
        `setupFiles` points at `./src/test-setup.ts`; `pnpm --filter @diffgazer/ui test` runs with the setup applied
        (jest-dom matchers + cleanup still active).

- [ ] T-817 (fixes F-222) — files: .github/workflows/deploy.yml
      Change: In `.github/workflows/deploy.yml`, pin the lone tag-pinned action `aquasecurity/trivy-action@0.28.0`
        (line 66) to its 40-char commit SHA with a trailing `# v0.28.0` comment, matching the SHA-pinning convention the
        other five `uses:` references in the file follow (e.g. `actions/checkout@de0fac2... # v6.0.2`). Resolve the exact
        commit SHA for the `aquasecurity/trivy-action` `v0.28.0` release tag at edit time and use it; the goal is the
        uniform `uses: <owner>/<action>@<40-hex-sha> # vX.Y.Z` shape so dependabot's github-actions ecosystem updates it
        like the rest.
      Accept: `.github/workflows/deploy.yml` has no `uses:` reference pinned to a non-SHA tag;
        `rg -nE 'uses: .+@[0-9a-f]{40} # v' .github/workflows/deploy.yml` matches the trivy line; the trailing comment
        names the version.

- [ ] T-818 (fixes F-252) — files: cli/add/package.json
      Change: In `cli/add/package.json`, change the `dev` script (line 54, currently `"tsc --watch"`) so the watch loop
        never emits into the tsup-owned `dist/` (today `tsc --watch` writes an un-bundled multi-file build into `dist/`,
        which collides with the single bundled `dist/index.js` that `bin.dgadd` and `files: ["dist"]` ship). Set it to
        type-check-only `"tsc --noEmit --watch"`, OR run via tsx like the sibling CLIs (`cli/diffgazer` and `cli/server`
        dev use tsx, no emit). Keep `dist/` exclusively a tsup build output; do not change the `build` script.
      Accept: `cli/add/package.json` `dev` script no longer emits into `dist/` (it is `tsc --noEmit --watch` or a tsx
        invocation); running `pnpm --filter @diffgazer/add build` still produces the single bundled `dist/index.js`;
        `bin.dgadd` still resolves.

---

### Phase exit

Gates that MUST pass before this phase is considered complete (run in this order; this phase touches
docs, AGENTS.md, gitignore, tsconfig topology, CI, and dev scripts, so the full SOTA-ready gate set
applies — the tsconfig/test-setup changes in 8.C/8.D can shift type-check and test behavior, and 8.B/8.A
touch handoff docs and ignore rules):

1. `DIFFGAZER_SKIP_ARTIFACT_PREPARE=1 pnpm exec turbo run type-check` — green (validates the 8.C tsconfig
   preset/resolution/lib normalization and the apps strictness lift; project references make any boundary
   or resolution regression a hard error).
2. `DIFFGAZER_SKIP_ARTIFACT_PREPARE=1 pnpm exec turbo run test` — full suite green (validates the F-165
   setup-file move and that the tsconfig changes did not break test compilation).
3. `pnpm run prepare:artifacts` then `pnpm run validate:artifacts:check` — green (this phase touches public
   handoff docs/README and the libs/ui type-check config; confirm registry + docs artifacts still validate).
4. `DIFFGAZER_SMOKE_STRICT_SKIPS=1 pnpm run smoke` — green (the cli/add dev-script and tsconfig/module-resolution
   changes can affect CLI/server/web build output; smoke validates the bundled offline snapshot and CLI/package paths).
5. `pnpm run verify:monorepo` — green (validates workspace shape and package metadata after the deletions and
   gitignore reorganization).
6. `git diff --check` — no whitespace errors introduced by the edited docs/config files.

Additional phase-specific checks:
- `rg -l 'agent-specs/|libs/ui/specs/|AUDIT_2026-05-24|OPUS_AUDIT_2026-05-24|FIX_SPEC_2026-05-24'` over the
  worktree (excluding `.nuke/`, `node_modules`, `pnpm-lock.yaml`) returns zero hits (T-801).
- `agent-skills/diffgazer-project-rules/SKILL.md` is still tracked (T-801 must NOT delete it).
- `git check-ignore cli/add/src/generated/x libs/ui/docs/generated/x libs/keys/docs/generated/x` still reports
  all three ignored after the per-package .gitignore move (T-802).
- `rg -n 'json-schema.org/tsconfig'` returns zero hits (T-813); `rg -n 'libs/server' .github/copilot-instructions.md`
  returns zero hits (T-805); `rg -n 'generated registry artifacts' README.md` returns zero hits (T-803).


---

## Coverage map

Every confirmed finding F-001..F-258 maps to at least one task. Built by scanning the `(fixes F-###)` annotations across all eight phases. All 258 distinct F-ids appear below; none required patching in (the phase spec already assigned every finding). Multi-task lines mean a finding is fixed across phases (e.g. moves then renames then verification); multi-finding tasks are noted where a single task fixes several findings.

- F-001 -> T-301
- F-002 -> T-722
- F-003 -> T-501,T-502,T-505,T-506
- F-004 -> T-101
- F-005 -> T-408
- F-006 -> T-402
- F-007 -> T-302
- F-008 -> T-425
- F-009 -> T-425
- F-010 -> T-158
- F-011 -> T-201
- F-012 -> T-211
- F-013 -> T-702,T-703
- F-014 -> T-306
- F-015 -> T-307
- F-016 -> T-309
- F-017 -> T-310
- F-018 -> T-311
- F-019 -> T-309
- F-020 -> T-303
- F-021 -> T-103
- F-022 -> T-106
- F-023 -> T-109
- F-024 -> T-111
- F-025 -> T-107
- F-026 -> T-105
- F-027 -> T-113
- F-028 -> T-107
- F-029 -> T-119
- F-030 -> T-120
- F-031 -> T-125
- F-032 -> T-125
- F-033 -> T-133
- F-034 -> T-128
- F-035 -> T-135
- F-036 -> T-140
- F-037 -> T-401
- F-038 -> T-726
- F-039 -> T-168
- F-040 -> T-416
- F-041 -> T-713
- F-042 -> T-146
- F-043 -> T-146
- F-044 -> T-147
- F-045 -> T-155
- F-046 -> T-157
- F-047 -> T-160
- F-048 -> T-162
- F-049 -> T-160,T-161
- F-050 -> T-163
- F-051 -> T-158
- F-052 -> T-167
- F-053 -> T-158
- F-054 -> T-231
- F-055 -> T-232
- F-056 -> T-115
- F-057 -> T-112
- F-058 -> T-116
- F-059 -> T-124
- F-060 -> T-102
- F-061 -> T-127
- F-062 -> T-127
- F-063 -> T-134
- F-064 -> T-140
- F-065 -> T-727
- F-066 -> T-145
- F-067 -> T-145
- F-068 -> T-147
- F-069 -> T-146
- F-070 -> T-146
- F-071 -> T-156
- F-072 -> T-724
- F-073 -> T-732
- F-074 -> T-731
- F-075 -> T-729
- F-076 -> T-712
- F-077 -> T-234
- F-078 -> T-222
- F-079 -> T-235
- F-080 -> T-212
- F-081 -> T-206
- F-082 -> T-204
- F-083 -> T-205
- F-084 -> T-243
- F-085 -> T-245
- F-086 -> T-433
- F-087 -> T-415
- F-088 -> T-801,T-810
- F-089 -> T-414
- F-090 -> T-409
- F-091 -> T-418
- F-092 -> T-304
- F-093 -> T-424
- F-094 -> T-424
- F-095 -> T-426
- F-096 -> T-429
- F-097 -> T-801,T-810
- F-098 -> T-428
- F-099 -> T-423
- F-100 -> T-814
- F-101 -> T-807
- F-102 -> T-804
- F-103 -> T-806
- F-104 -> T-246
- F-105 -> T-313
- F-106 -> T-412
- F-107 -> T-720
- F-108 -> T-710
- F-109 -> T-711,T-723
- F-110 -> T-715
- F-111 -> T-711
- F-112 -> T-710
- F-113 -> T-723
- F-114 -> T-107
- F-115 -> T-148
- F-116 -> T-136
- F-117 -> T-140
- F-118 -> T-164
- F-119 -> T-149
- F-120 -> T-118
- F-121 -> T-114
- F-122 -> T-104,T-110
- F-123 -> T-132
- F-124 -> T-126,T-176
- F-125 -> T-177
- F-126 -> T-116
- F-127 -> T-174
- F-128 -> T-417
- F-129 -> T-121
- F-130 -> T-144
- F-131 -> T-165
- F-132 -> T-419
- F-133 -> T-151
- F-134 -> T-142
- F-135 -> T-129
- F-136 -> T-175
- F-137 -> T-709
- F-138 -> T-405
- F-139 -> T-406
- F-140 -> T-423
- F-141 -> T-805
- F-142 -> T-714
- F-143 -> T-503,T-505,T-507
- F-144 -> T-735
- F-145 -> T-152
- F-146 -> T-150
- F-147 -> T-170
- F-148 -> T-305
- F-149 -> T-137
- F-150 -> T-133
- F-151 -> T-420
- F-152 -> T-730
- F-153 -> T-718
- F-154 -> T-716
- F-155 -> T-725
- F-156 -> T-410
- F-157 -> T-172
- F-158 -> T-122
- F-159 -> T-154
- F-160 -> T-143
- F-161 -> T-108
- F-162 -> T-117
- F-163 -> T-411
- F-164 -> T-249
- F-165 -> T-816
- F-166 -> T-601
- F-167 -> T-138
- F-168 -> T-139
- F-169 -> T-176
- F-170 -> T-403
- F-171 -> T-404
- F-172 -> T-413
- F-173 -> T-429
- F-174 -> T-605
- F-175 -> T-202
- F-176 -> T-508
- F-177 -> T-241
- F-178 -> T-243
- F-179 -> T-242
- F-180 -> T-430
- F-181 -> T-811
- F-182 -> T-701
- F-183 -> T-721
- F-184 -> T-733
- F-185 -> T-159
- F-186 -> T-123
- F-187 -> T-312
- F-188 -> T-244
- F-189 -> T-811
- F-190 -> T-706
- F-191 -> T-802
- F-192 -> T-610
- F-193 -> T-815
- F-194 -> T-728
- F-195 -> T-610
- F-196 -> T-606
- F-197 -> T-431
- F-198 -> T-432
- F-199 -> T-802
- F-200 -> T-812
- F-201 -> T-812
- F-202 -> T-613
- F-203 -> T-611
- F-204 -> T-802
- F-205 -> T-603
- F-206 -> T-509
- F-207 -> T-247
- F-208 -> T-248
- F-209 -> T-719
- F-210 -> T-119
- F-211 -> T-169
- F-212 -> T-504,T-505,T-507
- F-213 -> T-609
- F-214 -> T-173
- F-215 -> T-233
- F-216 -> T-203
- F-217 -> T-734
- F-218 -> T-813
- F-219 -> T-602
- F-220 -> T-614
- F-221 -> T-607
- F-222 -> T-817
- F-223 -> T-803
- F-224 -> T-171
- F-225 -> T-166
- F-226 -> T-612
- F-227 -> T-130
- F-228 -> T-809
- F-229 -> T-619
- F-230 -> T-407
- F-231 -> T-614
- F-232 -> T-616
- F-233 -> T-620
- F-234 -> T-608
- F-235 -> T-618
- F-236 -> T-618
- F-237 -> T-617
- F-238 -> T-604
- F-239 -> T-614
- F-240 -> T-615
- F-241 -> T-223
- F-242 -> T-224
- F-243 -> T-131
- F-244 -> T-153
- F-245 -> T-308
- F-246 -> T-213
- F-247 -> T-421
- F-248 -> T-421
- F-249 -> T-422
- F-250 -> T-427
- F-251 -> T-707
- F-252 -> T-818
- F-253 -> T-717
- F-254 -> T-718
- F-255 -> T-708
- F-256 -> T-221,T-704,T-705
- F-257 -> T-141
- F-258 -> T-808


### Coverage verification

- Distinct F-ids covered: **258** (F-001 through F-258, contiguous — no gaps).
- F-ids the assembler had to patch in (not already assigned by the phase spec): **0**.
- Note: F-049 is split across two tasks in phase-1 (`F-049-select` → T-160, `F-049-logo` → T-161); both halves of the finding are covered.
