# Verification of Large Structural Refactors in a TS Monorepo (2026)

Research agent: **T-verification** · Date: 2026-06-04
Topic: Safely verifying large structural refactors (moves/renames) in a TypeScript monorepo.

This note is grounded in the actual diffgazer repo state (read-only inspection) plus cross-checked
web sources. It answers 4 questions, records where sources disagree, and ends with a concrete
"what this means for diffgazer" plan keyed to specific workspaces.

---

## Repo facts that constrain the recommendations (verified locally)

- Package manager / orchestration: **pnpm@10.28.2 + Turborepo 2.9.x**. `pnpm-workspace.yaml` globs
  `apps/*`, `cli/*`, `libs/*`, `libs/keys/artifacts`.
- Linter is **Biome 2.3.14**, NOT ESLint. There is no `.eslintrc`/`eslint.config.*` anywhere.
  Consequence: `eslint-plugin-boundaries` would require adding the entire ESLint runtime purely for
  boundary enforcement; `dependency-cruiser` is standalone and does not.
- **No root `tsconfig.json`.** Each package owns its own `tsconfig.json` + `tsconfig.test.json`
  (apps `web`/`landing` use a solution config with `references` to `tsconfig.app.json` /
  `tsconfig.test.json` and run `tsc -b`; libs/docs chain `tsc --noEmit -p tsconfig.test.json`).
  Per AGENTS.md "Verification Gates". This matters because dependency-cruiser/knip want a TS config
  per analysis root.
- `ts-morph@26.0.0` is ALREADY in the lockfile (used by build/codegen scripts). `@microsoft/api-extractor@^7.36` is in the lockfile too, but **no `api-extractor.json` config exists anywhere** — it is effectively an unused/transitive dep; public-API snapshotting is NOT currently wired up.
- `@manypkg/get-packages` + `@manypkg/find-root` are present (used by smoke/validation scripts).
- NOT present anywhere in any package.json: `knip`, `sherif`, `eslint-plugin-boundaries`,
  `dependency-cruiser`, `publint`, `@arethetypeswrong/cli`.
- The repo's verification spine is bespoke: `scripts/monorepo/check-invariants.mjs` (asserts package
  name/homepage/repo dir/sideEffects/`files`/`exports`/policy files per published package),
  `scripts/monorepo/validate-artifacts.mjs` (registry tree-parity, bundle relative-`.js`-import
  detection, export-target existence, pack surface), plus smoke scripts (`smoke-cli`,
  `smoke-package-install`, `smoke-shadcn-install`, `smoke-modelsdev`) and a server benchmark.
- Verification gates already defined in AGENTS.md:
  `DIFFGAZER_SKIP_ARTIFACT_PREPARE=1 pnpm exec turbo run type-check`,
  `... turbo run test`, `DIFFGAZER_SMOKE_STRICT_SKIPS=1 pnpm run smoke`, `pnpm run verify:monorepo`,
  and `git diff --check` before final response.

So the realistic strategy for diffgazer is: **lean hard on what's already there (turbo typecheck +
tests + the bespoke artifact/invariant/smoke scripts), use the already-installed `ts-morph` for the
codemod, and add at most ONE new lightweight import-graph tool, not four.**

---

## Q1. Best practices for verifying mass moves/renames broke nothing

### Consensus layering (the "verification trophy" for a structural refactor)

Sources converge on a layered gate, cheapest/fastest first:

1. **Typecheck as the primary gate.** This is the single most load-bearing check for a pure move.
   A move that breaks an import path is, by construction, a compile error. With TS project references
   + `composite: true`, `tsc -b` (a) builds dependencies first and (b) *enforces* that a project may
   only import projects it explicitly `references`, so a cross-package import that should have been
   rewritten surfaces immediately. TS docs: "Project references enforce project boundaries,
   disallowing imports to arbitrary projects unless they have been referenced explicitly... only
   out-of-date or affected projects are processed."
   (https://www.typescriptlang.org/docs/handbook/project-references,
   https://moonrepo.dev/docs/guides/javascript/typescript-project-refs)
   For diffgazer this is already `turbo run type-check`, which fans out per package and is the right
   first gate. Caveat: typecheck catches *broken* imports, not *silently-wrong-but-still-resolving*
   ones (e.g. a move that makes a barrel re-export resolve to a different but type-compatible symbol).
   That residual is what the test layer is for.

2. **Behavior test suite (unit + integration), run on the affected graph.** Kent C. Dodds' testing
   trophy logic applies: after a refactor you want confidence behavior is unchanged, and integration
   tests give the most confidence per test. Turborepo can scope this with `--affected`
   (`turbo run test typecheck --affected`, comparing `TURBO_SCM_BASE`..`TURBO_SCM_HEAD`), so a move
   that touches `libs/ui` also re-tests `apps/web`/`apps/docs` that depend on it.
   (https://turborepo.dev/docs/reference/run, https://rebeccamdeprey.com/blog/using-the-turborepo---affected-flag-in-ci)
   Important nuance/controversy: `turbo ls --affected` has a known false-positive where touching root
   `package.json` (or sometimes only-workspace-dep changes) marks *all* packages affected
   (vercel/turborepo#11144). For a refactor PR you SHOULD usually run the FULL suite anyway, not
   `--affected`, precisely because a structural move can ripple in ways the SCM diff under-counts;
   use `--affected` for fast local iteration, full `turbo run test` for the gate.

3. **E2E / smoke of the shipped artifact.** A move can pass typecheck+unit tests and still break the
   *packaged* product (wrong file ends up in `files`, an `exports` subpath points at a moved/renamed
   path, a generated registry bundle references an old location). diffgazer already has the right
   smokes: `smoke-package-install` (installs the built tarball into a temp project and imports it),
   `smoke-shadcn-install` (validates the public registry copy path), `smoke-cli` (runs the built CLI
   binary), `smoke-modelsdev`. These are exactly the "does the moved thing still work for a real
   consumer" layer that typecheck cannot give you. Keep them mandatory on any move PR.

4. **Public API snapshot diffing.** For published packages (`@diffgazer/ui`, `@diffgazer/keys`,
   `@diffgazer/add`, `diffgazer`), a structural move must NOT change the public type surface. Two
   complementary tools:
   - **api-extractor `.api.md` report.** It "traces all exports from a project's main entry point and
     generates a report to be used as the basis for an API review workflow"; CI "performs a production
     build which does not automatically update the report file" so a forgotten public-API change fails
     PR validation. (https://api-extractor.com/pages/setup/configure_api_report/,
     https://api-extractor.com/pages/overview/intro/) The committed `.api.md` is a human-reviewable
     diff: a move that accidentally widens/narrows the surface shows up as a red/green line.
     **Known limitation (controversy below):** api-extractor assumes a SINGLE entry point
     (`mainEntryPointFilePath`) and cannot model subpath `exports` like `./components/*` or
     `./hooks/*` (microsoft/rushstack#3557, #664, #3274). diffgazer's `libs/ui`/`libs/keys` are
     exactly multi-entry, so api-extractor would need one invocation per entry or an alternative.
   - **`attw` (arethetypeswrong) + `publint`.** These validate the *published* package, not source.
     `publint` audits `package.json` (exports map, `files`, `bin`, deprecated fields) via static
     analysis; `attw` uses the TS compiler to check that every `exports` subpath resolves correctly
     under node16/bundler/CJS/ESM. The standard CI pattern is `npm pack` then
     `npx @arethetypeswrong/cli --pack`. They are complementary: "attw is able to report issues that
     publint does not, so use both." (https://publint.dev/docs/comparisons,
     https://www.npmjs.com/package/@arethetypeswrong/cli, https://tsdown.dev/options/lint)
     For a MOVE refactor, `attw`/`publint` are the cheapest highest-signal guard that a relocated file
     didn't break an `exports` subpath — which is precisely the failure mode that typecheck of *source*
     misses but a consumer hits.

5. **Registry / artifact diffing.** diffgazer-specific and already built: `validate-artifacts.mjs`
   checks registry tree-parity, that public registry source has no relative `.js` import specifiers
   that break copy/shadcn consumers, and that every `exports` target file actually exists. After a
   move, regenerate artifacts (`pnpm run prepare:artifacts`) then `pnpm run validate:artifacts:check`.
   This is the move-specific equivalent of an API snapshot for the *registry* contract.

### Sources for Q1
- TS project references handbook + moonrepo guide (typecheck-as-gate, boundary enforcement).
- Turborepo `--affected` docs + Rebecca Deprey blog + turborepo#11144 (affected false positives).
- api-extractor docs (API report CI workflow) + rushstack#3557/#664/#3274 (single-entry limitation).
- publint.dev comparisons + @arethetypeswrong/cli npm + tsdown lint docs (attw/publint complementarity).
- egghead "Running Quality Checks in your Monorepo" (typecheck && build per package pattern).

---

## Q2. Codemod tooling for moves: what actually works in 2026

### The core problem (well-documented, not theoretical)

The IDE story is unreliable across package boundaries. TypeScript issue **#59136 "Moving files or
folders in a monorepo setup does not adapt imports"** is **closed as `not planned`**. The reporter:
"All imports that reference the moved file or folder should get adapted automatically" — instead
"imports in packages that are not involved in the move ... do not get adapted," and "I know several
colleagues that moved away from VSCode to Webstorm for this reason."
(https://github.com/microsoft/TypeScript/issues/59136) VS Code's `updateImportsOnFileMove` also has
open bugs (microsoft/vscode#215271, #247037) and a CPU/freeze cost that leads people to set it to
`never` (https://www.javaspring.net/blog/.../update-import-paths-on-file-rename-move/).

**Conclusion: do not trust "drag in the IDE and accept the prompt" for a mass cross-package move.**
You need a scripted codemod that owns the whole graph in one pass.

### The tooling, ranked for THIS job (cross-package path rewriting at scale)

1. **ts-morph (RECOMMENDED for diffgazer — already installed).** It wraps the real TS compiler/
   language service, so it understands `tsconfig`, path aliases, and the full project graph. The key
   primitives: `project.getSourceFile(...).move(newPath)` and `sourceFile.move()` *update referencing
   import/export specifiers across the project*, and `directory.move()` moves a whole folder. Crucially,
   "moves, copies, and deletes won't be propagated to the underlying file system until `save()` is
   called," so you can do the entire restructure in memory, inspect the planned diff, then commit it
   atomically. (https://ts-morph.com/manipulation/, https://ts-morph.com/details/source-files)
   Because it's the compiler's own resolver, it handles the cross-package case that the VS Code LS
   drops. This is the single best fit: diffgazer already depends on it, and it can load each workspace
   project (or a synthetic project spanning the workspace) and rewrite imports including workspace
   `@diffgazer/*` specifiers if you also patch `package.json` `exports`.
   - **Pitfall (verified): barrel/re-export files.** ts-morph (issue dsherret/ts-morph#327) and the
     broader 2025 "stop using barrel files" consensus warn that wide `index.ts` re-exports hide who
     depends on what and make automated rename/move less reliable, because the public path is the
     barrel, not the moved file. After a move you must regenerate/verify barrels. diffgazer's public
     surfaces are subpath-export driven (`./components/<name>`) rather than one mega-barrel, which is
     the safer shape — keep it that way.

2. **jscodeshift (good for syntactic mass edits, weaker for resolution).** jQuery-like API over an AST
   (`j(file).find(j.ImportDeclaration)...`) running over many files. It's excellent for *pattern*
   rewrites ("rewrite every `@old/x` to `@new/x`") and is what large orgs use for API codemods. But it
   operates on syntax, not the type/resolution graph: it does not *know* where a moved file went or
   how a relative path should re-resolve, so for relocation you must encode the path math yourself.
   Codemod.com now supports both jscodeshift and ts-morph engines, signalling both remain first-class
   in 2026. (https://www.dhiwise.com/post/the-ultimate-guide-to-using-jscodeshift-with-typescript,
   https://codemod.com/blog/ts-morph-support) **For diffgazer's moves, prefer ts-morph; reserve
   jscodeshift only for a flat find/replace of workspace-package specifiers if needed.**

3. **IDE move-with-import-update via CLI / WebStorm.** WebStorm/IntelliJ does handle monorepo moves
   better than VS Code (per #59136 testimony), but it's not scriptable/CI-reproducible and not a gate.
   Treat it as a manual convenience, never the source of truth.

### Recommended codemod flow
Write a one-off `ts-morph` script (run via the already-present `tsx`): load the project(s) → for each
planned move call `sourceFile.move(target)` / `directory.move(target)` → `project.save()` → let
ts-morph's reference updating rewrite specifiers → then run typecheck. Do it ENTIRELY as moves first
(no content edits), so git sees pure renames (see Q4).

### Sources for Q2
- TS#59136 (closed not-planned), vscode#215271/#247037, javaspring.net (IDE move unreliability).
- ts-morph manipulation + source-files docs (`move`/`save` semantics).
- dsherret/ts-morph#327 + jsdev.space "stop using barrel files" + Medium "Why I Will Not Use Index Files in 2025" (barrel pitfalls).
- dhiwise jscodeshift guide + codemod.com ts-morph-support blog (both engines current in 2026).

---

## Q3. Import-graph enforcement after restructure — SOTA combination for monorepos

These tools answer DIFFERENT questions; "SOTA" is a small *combination*, not a winner.

| Tool | Question it answers | Editor feedback | Standalone? | Fit for diffgazer |
|---|---|---|---|---|
| **dependency-cruiser** | "Did anyone violate an architecture boundary / create a cycle / orphan?" | CI only | yes (no ESLint) | **Strong** — Biome repo, so standalone wins |
| **eslint-plugin-boundaries** | same as above, but in-editor | red squiggle live | needs ESLint | weak — would add ESLint just for this |
| **sherif** | "Are dependency *versions* consistent across packages?" | CI only | yes (Rust, zero-config) | good, cheap, but overlaps `check-invariants.mjs` + pnpm catalog |
| **knip** | "Did the move leave dead files / unused exports / unused deps?" | CI only | yes | **Strong** — purpose-built post-refactor cleanup |

### dependency-cruiser vs eslint-plugin-boundaries (the real comparison)
Both can forbid cross-package imports and detect cycles. The recognized split (Stefanos Lignos,
mistermicheels static-analysis notes, Xebia, frontendatscale "Beyoncé Rule"):
- **eslint-plugin-boundaries** = "instant feedback through ESLint errors," "red lines beneath invalid
  imports" in the editor. Best when you already run ESLint.
  (https://www.npmjs.com/package/eslint-plugin-boundaries, https://learning-notes.mistermicheels.com/processes-techniques/static-analysis/)
- **dependency-cruiser** = does MORE than boundaries — circular deps, orphans, "is this module shared
  enough," and generates a dependency graph; but "usually provides feedback after a failed CI build."
  (https://www.npmjs.com/dependency-cruiser, https://xebia.com/blog/taking-frontend-architecture-serious-with-dependency-cruiser/)
- A combination "can provide a developer experience that aligns with your team's needs"
  (Stefanos Lignos, https://www.stefanos-lignos.dev/posts/nx-module-boundaries).

**For diffgazer specifically: dependency-cruiser, not eslint-plugin-boundaries**, because the repo
uses Biome and has zero ESLint footprint. Adding eslint-plugin-boundaries means adopting ESLint solely
for boundary rules — a heavy, contradictory second linter. dependency-cruiser is a single standalone
dep that directly encodes the AGENTS.md "Architecture Boundaries" section as `forbidden` rules. Rule
schema (from the rules-reference): `{ name, severity: error|warn|info|ignore, from: {path}, to: {path, pathNot} }`
with regex paths and group capture (`$1`) for "no sibling-to-sibling imports" patterns, e.g.:
```
{ name: "core-no-app-cli", severity: "error",
  from: { path: "^libs/core/" },
  to:   { path: "^(apps|cli)/" } }              // AGENTS.md: libs/core must not import apps/* or cli/*
{ name: "landing-only-ui", severity: "error",
  from: { path: "^apps/landing/" },
  to:   { path: "^(apps/(web|docs)|cli)/" } }    // AGENTS.md: landing uses only libs/ui
{ name: "no-circular", severity: "error", from: {}, to: { circular: true } }
{ name: "no-orphans",  severity: "warn",  from: { orphan: true, pathNot: "\\.d\\.ts$" }, to: {} }
```
(https://github.com/sverweij/dependency-cruiser/blob/main/doc/rules-reference.md)
Monorepo caveat (issue #859): a *per-package* `depcruise src` produces false positives because shared
deps live in root `package.json`; run it from the **repo root over the whole workspace** with one
config so it sees the full graph. This is a real wrinkle, not a blocker.

### knip — the dedicated post-refactor cleanup gate
After a restructure the most likely residue is *orphans*: a file that was moved/duplicated and the old
copy left behind, or an export nothing imports anymore. ESLint/Biome only see within-file unused vars;
**knip builds the whole module graph** and finds unused *files*, *exports*, and *dependencies* across
the monorepo. (https://knip.dev/, https://knip.dev/explanations/why-use-knip) Knip understands pnpm
workspaces and TS project references and has ~150 plugins (Vitest, Biome-ish tooling, etc.).
Recommended workflow (https://knip.dev/guides/handling-issues): fix in order **(1) unused files →
(2) unused dependencies → (3) unused exports** because "getting the list of unused files right trickles
down." Prefer fixing config (`entry`/`project` patterns) over `ignore` lists.
**Controversy / honest caveat:** knip's false positives come from dynamic imports
(`import(variable)`), framework conventions, generated files, and — relevant here — TS path aliases
that reference *other workspaces* are "not special-cased" and "may cause false positives"
(https://knip.dev/reference/faq, https://knip.dev/guides/troubleshooting, webpro-nl/knip#1466). So the
SOTA adoption pattern is staged: run warning-only first, tune config, then gate. Treat the "unused"
list as a hint: "delete candidates, build, test, and restore items when they were secretly used."

### sherif — useful but lowest marginal value for diffgazer
sherif is an "opinionated, zero-config linter for TS/JS monorepos," Rust, runs without
`node_modules`, enforces single-version dependency alignment, `--fix` available
(https://github.com/QuiiBz/sherif, https://www.npmjs.com/package/sherif). It's great, but its main job
(version consistency) overlaps what diffgazer already does via the pnpm `overrides`/catalog and
`check-invariants.mjs`, and a *move* refactor rarely introduces version drift. Add it only if you want
a fast standalone version-alignment guard; it is NOT the priority for a structural move.

### SOTA combination verdict for diffgazer
**dependency-cruiser (boundaries + cycles + orphans, error-gated) + knip (dead files/exports/deps,
staged to warning-then-error).** Skip eslint-plugin-boundaries (no ESLint here). sherif optional.
These two cover the post-move risks the existing typecheck/test/artifact gates do NOT: silent
architecture-boundary violations and leftover dead code.

### Sources for Q3
- Stefanos Lignos (Nx module boundaries, "three ways"), mistermicheels static-analysis notes, Xebia
  dependency-cruiser, frontendatscale "Beyoncé Rule", jmulholland architecture tools.
- dependency-cruiser npm + rules-reference + issue #859 (monorepo config wrinkle).
- eslint-plugin-boundaries npm.
- knip.dev (home, why-use, handling-issues, faq, troubleshooting) + webpro-nl/knip#1466 + Frontend Masters monorepo course.
- QuiiBz/sherif repo + sherif npm + tengis.dev + productsway blog.

---

## Q4. Process — one atomic PR vs staged phases (moves-only then logic)

### Consensus: STAGED, with a pure-move commit separate from any logic change.

Two independent, strong lines of evidence:

**(a) Git rename detection requires it.** Git does not store renames; it infers them at diff time by
similarity. Ole Begemann (2025): "To track a file's identity across renames, perform the rename in a
standalone commit, separate from any edits to the file," and "`git mv` will stage the rename and keep
the edits unstaged ... it allows me to commit the rename and the edits separately."
(https://oleb.net/2025/git-file-renaming/) The TheLinuxCode 2026 guides reinforce: "A common trap is
moving a file and rewriting half of it in the same commit ... when the edit is large, Git may treat it
as a delete and add, and your review turns into a wall of red and green." Mixing a move with a >~50%
content change drops Git below its similarity threshold (default ~50%, `-M`) so the rename is lost and
history/`git log --follow` breaks.
(https://thelinuxcode.com/git-move-files-in-2026-reliable-renames-clean-history-and-real-world-workflows/)

**(b) Code-review research/practice says the same independently.** Google eng-practices "Small CLs":
"It's usually best to do refactorings in a separate CL from feature changes or bug fixes."
(https://google.github.io/eng-practices/review/developer/small-cls.html) Kyle Shevlin's refactoring
git workflow: put the refactor on its own branch/PR and base the feature PR on it, because "it's
harder to differentiate between what was refactored vs. what was added"; and "in order to verify that
no functionality has changed, we need tests in place." (https://kyleshevlin.com/my-git-workflow-for-refactoring/)
This is Fowler's "Two Hats": either change structure OR change behavior, never both in one step.
Microsoft Research (700k+ reviews): reviewers comment on ~2-3% of methods in large changesets vs ~7%
in small ones, and >1000-line PRs are abandoned far more
(https://www.propelcode.ai/blog/pr-size-impact-code-review-quality-data-study). Google productivity
team: total reviewer time across a *stack* of small CLs is 15-20% LESS than one equivalent large CL
(https://www.aviator.co/blog/rethinking-code-reviews-with-stacked-prs/,
https://newsletter.pragmaticengineer.com/p/stacked-diffs).

### The recommended shape (combining both)
1. **Phase 0 — safety net first.** Ensure tests cover the behavior you're about to relocate; for a
   refactor the test suite IS the proof of equivalence (Shevlin, Fowler). Run the FULL gate green on
   `main` before starting so any later red is attributable to the move.
2. **Phase 1 — pure moves commit(s), ZERO logic changes.** Run the ts-morph codemod that ONLY moves
   files and rewrites import specifiers. Commit via `git mv`-equivalent (ts-morph + git will detect
   renames as long as content is byte-identical except the rewritten import lines). Keep import-path
   rewrites in this same commit — they're mechanical and unavoidable, and a small number of changed
   import lines still keeps each file well above the rename-similarity threshold. Verify: `tsc -b` /
   `turbo run type-check`, then `turbo run test`, then artifacts + smoke. A reviewer of THIS PR's only
   job is "tests still pass and the diff is renames."
3. **Phase 2 — logic / structural follow-ups** (splitting a file into SRP units, renaming symbols,
   barrel changes) in SEPARATE commits/PRs, stacked on Phase 1. These have real diffs to review.
4. **Atomicity nuance / controversy:** "atomic" should mean *each phase is internally complete and
   green*, NOT "everything in one giant PR." Because diffgazer uses TS project references + workspace
   `@diffgazer/*` deps, a move that changes a published package's `exports` must land together with the
   consumer updates and regenerated registry artifacts IN THE SAME PR — otherwise the repo is
   red between PRs (AGENTS.md: "Update source registry files, public registry JSON, docs, examples,
   generated bundles, and app consumers together when public APIs change"). So: stage by *logical
   concern*, but never split a single rename across PRs such that the tree doesn't compile in between.
   The tension to manage: smaller PRs review better, but cross-package atomicity forbids splitting a
   coherent move. Resolve it by keeping the *move* atomic-per-coherent-unit and pushing *non-essential
   cleanup* to follow-up PRs.

### Practical git tips for reviewability
- Review the move PR with `git diff -M` / set `diff.renames = copies` so renames render as renames not
  delete+add; reviewers see "R100 old → new" lines.
- `git log --follow <file>` only survives if Phase 1 stayed content-clean — another reason to keep the
  import-rewrite churn minimal per file.
- For the orchestrator: a moves-only PR should pass `git diff --check` (already an AGENTS.md gate) and
  ideally show near-100% rename similarity.

### Sources for Q4
- Ole Begemann 2025 (git rename detection, separate-commit rule) + TheLinuxCode 2026 guides + git-scm git-mv docs.
- Google eng-practices "Small CLs" + Kyle Shevlin refactoring workflow + understandlegacycode key-points-of-refactoring (Fowler "Two Hats").
- Microsoft Research PR-size study (Propel Code writeup) + Google productivity / stacked-diffs (Aviator, Pragmatic Engineer).

---

## What this means for diffgazer (actionable, workspace-keyed)

**Gate ordering for any move/rename PR (reuse existing infra, add minimal new):**
1. `DIFFGAZER_SKIP_ARTIFACT_PREPARE=1 pnpm exec turbo run type-check` — primary gate. Because there's
   no root tsconfig, this fans out per-package; it catches every broken import. Project references
   make cross-package boundary breakage a hard error.
2. `pnpm exec turbo run test` (FULL, not `--affected`, for the gate; `--affected` for local speed).
3. `pnpm run prepare:artifacts` then `pnpm run validate:artifacts:check` + `pnpm run verify:monorepo`
   — registry tree-parity, export-target existence, relative-`.js` import detection, pack surface.
   This is diffgazer's API/artifact-snapshot equivalent and MUST run after moves that touch
   `libs/ui`, `libs/keys`, `libs/registry`, or `cli/add` generated bundles.
4. `DIFFGAZER_SMOKE_STRICT_SKIPS=1 pnpm run smoke` — proves the moved code still installs/imports/runs
   for real consumers (`smoke-package-install`, `smoke-shadcn-install`, `smoke-cli`).
5. `git diff --check` (already required).

**New tooling — add at most these, in priority order:**
- **(High) dependency-cruiser** at repo root, one config encoding AGENTS.md "Architecture Boundaries":
  `libs/core` must not import `apps/*`/`cli/*`; `apps/landing` only `libs/ui`; `cli/server`
  CLI-internal; no inter-app imports; `no-circular` error; `no-orphans` warn. Run it from root over
  the whole workspace (issue #859 — never per-package). Standalone, no ESLint needed (repo is Biome).
  This catches the one class of move-regression typecheck CANNOT: a boundary violation that still
  compiles.
- **(High) knip** as a post-restructure dead-code sweep, adopted staged: warning-only first, tune
  `entry`/`project` for pnpm workspaces + the registry/codegen entry points, expect false positives on
  workspace path aliases (FAQ), then gate. Best run after the move to find orphaned old copies.
- **(Medium) attw + publint** wired into `release-check`/`smoke-package-install` for the published
  packages (`@diffgazer/ui`, `@diffgazer/keys`, `@diffgazer/add`, `diffgazer`). Cheapest guard that a
  relocated file didn't break an `exports` subpath. Pattern: `pnpm pack` → `attw --pack` + `publint`.
- **(Low/optional) sherif** for version alignment — mostly redundant with pnpm overrides +
  `check-invariants.mjs`; add only if you want a fast standalone check.
- **api-extractor `.api.md`**: it's already in the lockfile but unconfigured. CAUTION: its single-
  entry-point limitation (rushstack#3557) does not fit `libs/ui`/`libs/keys` multi-subpath exports
  without one invocation per entry. Lower priority than attw/publint, which validate the *shipped*
  multi-entry surface directly. If adopted, configure one api-extractor entry per `exports` subpath.

**Codemod:** use the already-installed **ts-morph** (run via `tsx`) for the moves — `sourceFile.move`
/ `directory.move` then `project.save()`, do the whole plan in memory, inspect, save once. It owns the
cross-package resolution that VS Code drops (TS#59136 closed not-planned). Avoid IDE drag-and-drop for
mass moves. Watch barrels — diffgazer's subpath-export shape is the safer pattern; don't introduce a
mega-barrel.

**Process:** Phase 1 = pure-move commit (import-rewrites only, no logic), green on all 5 gates, render
as renames (`git diff -M`); Phase 2 = SRP splits / symbol renames / barrel changes stacked on top.
Keep cross-package + registry-artifact changes atomic within a single PR (the tree must compile
between PRs), but push non-essential cleanup to follow-ups. This satisfies both git rename detection
(Begemann 2025) and review quality (Google Small CLs, MSR PR-size study).

---

## Cross-source agreement / disagreement summary
- **Agreement:** typecheck is the primary gate; pure-move-before-logic; IDE moves are unreliable across
  monorepo boundaries; knip is the right dead-code tool; dependency-cruiser/eslint-boundaries answer
  the boundary question.
- **Disagreement / nuance:**
  - dependency-cruiser vs eslint-plugin-boundaries: editor feedback (ESLint) vs more checks + standalone
    (depcruise). diffgazer's Biome-only setup breaks the tie toward dependency-cruiser.
  - `--affected` vs full suite: `--affected` is faster but has false positives (turbo#11144) and can
    under-count refactor ripple — use full suite as the gate.
  - api-extractor: great for single-entry packages, structurally wrong for multi-subpath exports
    (rushstack#3557) — prefer attw/publint for diffgazer's shape.
  - knip noise: critics call it noisy; maintainers/practitioners say it's a config-tuning issue and a
    "hint," not gospel — hence staged adoption.
  - "atomic PR": means each phase complete+green, not one mega-PR; tempered by cross-package atomicity.
