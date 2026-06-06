# Diffgazer Structure Research — Digest

Date: 2026-06-04. Synthesizes the 12 research notes under `research/` against AGENTS.md + recon.
Each topic = **Consensus** (cited) · **Repo-tailored recommendation** · **Controversies**. The final
section, **Tensions & open decisions**, lists the forks only the owner can settle.

---

## 1. Bulletproof-react (`research/bulletproof.md`)

**Consensus.** Bulletproof-react prescribes top-level `src/` dirs `app/ assets/ components/ config/
features/ hooks/ lib/ stores/ testing/ types/ utils/`; feature folders hold a SUBSET of the same
technical folders scoped to one feature; the load-bearing rule is unidirectional flow **shared →
features → app** with no cross-feature imports (enforced by `import/no-restricted-paths`). It now
DISCOURAGES barrels ("recommended to import the files directly"). Reading the actual react-vite example
via GitHub API: it does NOT colocate tests (uses `__tests__/`), uses multi-hyphen kebab names
(`create-discussion.tsx`, `md-preview/`), and uses per-component folders ONLY for shared `components/ui`
primitives. Strongest critique = Issue #238 (a shared component needing feature logic has no escape
hatch). It is web-only by design; principles travel, the dir taxonomy does not.

**Repo-tailored recommendation.** `apps/web` and `cli/diffgazer` are faithful, correct ports — keep,
do not churn. `cli/server` matches Hono's blessed "split by `app.route()`, no controllers" advice.
`cli/add`'s `commands/` is the right CLI idiom. `libs/core` domain modules + top `index.ts` is correct
library shape — do NOT add `features/` to libs. The repo is IMMUNE to Issue #238 by construction because
`libs/ui` is domain-free. Highest-value addition: ENFORCE the unidirectional rule as lint (currently only
prose in AGENTS.md). Bulletproof's own files contradict the owner's hyphen cap and test-colocation
preference — the repo's colocated `.test.ts(x)` is BETTER than bulletproof's `__tests__/`.

**Controversies.** Does `features/` still make sense when `libs/ui`+`libs/core` exist? Camp A (Nx,
"80/20 almost-empty apps") says push features into libs; Camp B (FSD, repo's AGENTS.md) says features
stay app-local, packages are the shared tier. Resolved for diffgazer by AGENTS.md + the TUI second
consumer: product composition stays in `apps/web/features/*`; anything the TUI also needs is already in
`libs/core`/`libs/keys`.

---

## 2. Feature vs layer, vertical slices, screaming architecture (`research/features.md`)

**Consensus.** Organize by feature/domain (vertical), not technical type (horizontal), for anything past
trivial size — strong multi-source agreement (bulletproof-react, Robin Wieruch, TkDodo "The Vertical
Codebase", Kent C. Dodds colocation, the Node "you're slicing your architecture wrong" piece). The real
production pattern is HYBRID: vertical at the top, small horizontal `components/hooks/utils` inside each
slice, plus a shared horizontal layer. The shared/feature boundary rule: one feature uses it → keep local;
2+ features → promote to shared. "Screaming architecture" (top-level names = domain) is mainstream and
cheap; full Clean Architecture layering is contested/overkill in TS. oclif blesses commands==folders for
CLIs. No credible numeric size threshold (Wieruch/TkDodo refuse one); behavioral triggers only.

**Repo-tailored recommendation.** Keep the existing feature/vertical structure across `apps/web`,
`cli/server`, `cli/diffgazer`, `cli/add`. The ONE real smell is `cli/server/src/features/review` (~30–40
files) which has quietly become horizontal inside one folder — split into sub-slices by use case
(`review/{pipeline,context,sessions,stream,drilldown,summary}`) when it grows further. Do NOT pre-create
empty `api/stores/utils/types` in small features (`home`, `onboarding`). Take the cheap "screaming"
half, skip the Clean Architecture apparatus.

**Controversies.** Per-feature `index.ts` barrel: bulletproof DISCOURAGES, Wieruch/Sandro Roth allow a
THIN curated one as public API. Reconciling: a thin feature-root `index.ts` exporting only the public
surface aids boundary enforcement; deep "re-export everything" + per-subfolder index files are the
harmful kind. Folder-per-component, numeric thresholds, and Clean-vs-pragmatic are all live forks.

---

## 3. Node CLI & Ink TUI structure (`research/cli.md`)

**Consensus.** No single canonical CLI layout (read directly: shadcn = one file per command + colocated
tests + kebab; vercel = one folder per command with `command.ts` spec vs `index.ts` handler + `util/<domain>/`;
changesets = `__tests__/` + camelCase; astro = ports/adapters). Invariants: thin command layer, separate
logic/service layer, kebab-case dominates 3 of 4, NONE enforce single-word/one-hyphen. Ink IS React, so
feature/component organization applies; oclif owns command parsing, Ink renders inside a command. Embedded
server pattern: command/launcher is a thin adapter, server impl is a separate testable module.

**Repo-tailored recommendation.** Keep `cli/diffgazer`'s Ink structure (arguably best-in-class). Keep the
embedded-server separation (`cli/server` workspace + `cli/diffgazer/src/lib/servers/*` adapters) — stronger
than vercel/astro. `cli/add` already matches shadcn's own CLI. `cli/server` uses the right BACKEND
convention — do NOT bulletproof-react-ify it. Drop the strict hyphen cap; keep `.test.ts`/`use-*.ts`. A
top-level `cli/` group is fine. Agnostic naming already satisfied (`diffgazer` unscoped, `@diffgazer/*`
internal).

**Controversies.** Command unit = file (shadcn) vs folder (vercel/changesets/astro). Tests colocated vs
`__tests__/`. File case kebab vs camelCase (changesets). `cli/` group vs strict `apps/`+`packages/`. Two
binaries (`diffgazer` + `dgadd`) vs one binary with `add` subcommand (DX decision).

---

## 4. Hono / small backend structure (`research/server.md`)

**Consensus.** Hono official best practices: AVOID Rails-like controllers (they break path-param type
inference); one `Hono` per route group mounted with `app.route()`; keep app definition separate from
runtime entry; RPC and OpenAPI are optional. For small embedded servers, sources DISAGREE on layer-folders
(Medium blog) vs feature-folders (Node-2025 guide + colocation literature) and on whether a service layer
is needed at all (freeCodeCamp inlines; Medium mandates). SSE consensus is a clean 4-layer seam: HTTP
transport → stream adapter → protocol-agnostic domain pipeline → session pub/sub; cleanup in `finally`;
`Last-Event-ID` replay; clamp client intervals; catch inside `streamSSE` (throws bypass `onError`).

**Repo-tailored recommendation.** `cli/server` is at/near SOTA and implements every consensus item
(factory `createApp()`, feature folders mounted via `app.route()`, no controllers, colocated `schemas.ts`
+ `zValidator`, shared `middlewares/`, `Result`-based domain, the textbook 4-layer SSE seam with an
HTTP-agnostic pipeline the TUI reuses). Keep single-word role files (`router.ts`/`service.ts`/`schemas.ts`)
— better than the industry `feature.role.ts` dot-suffix. Keep handlers thin/typed at the route site;
`service.ts` only where logic is non-trivial/reused/tested (health/shutdown stay inline). Do NOT add RPC
or OpenAPI (YAGNI; the contract lives in `libs/core` Zod). `models-dev-catalog.ts` (2 hyphens) keeps its
name (proper noun). Watch the large `review/` slice (nest sub-features rather than flatten).

**Controversies.** Layer folders vs feature folders (official Hono takes neither side). Service layer
always vs YAGNI. OpenAPI/RPC adoption (research says NO for this CLI-internal server).

---

## 5. Barrel files & public API surfaces (`research/barrels.md`)

**Consensus.** Near-unanimous (Vite, Vitest, Next.js/Vercel, Turborepo, TkDodo, Atlassian,
bulletproof-react which REVERSED its stance): internal folder barrels are harmful — Vite "avoid barrel
files, import individual APIs directly"; Vitest "importing without barrel reduces transformed files ~85%";
TkDodo "11k→3.5k modules, 68% reduction"; Atlassian "75% faster builds, 50% faster local tests, 88% fewer
tests run." A barrel as a PACKAGE public entry is the one acceptable place — but the 2026 refinement
(thepassle, Turborepo) is to prefer GRANULAR subpath `exports` over a single fat `.` barrel, especially for
large packages. Enforcement is mature: `eslint-plugin-no-barrel-files`, `eslint-plugin-boundaries`,
`dependency-cruiser`, Biome/Oxlint built-ins. (`sherif` is version-consistency only, NOT barrels.)

**Repo-tailored recommendation.** `@diffgazer/ui` (per-component subpaths) and `@diffgazer/core`
(per-domain subpaths) are already SOTA — keep, do NOT collapse to a `.` barrel. Verify `@diffgazer/core`'s
`dist/index.js`/`src/index.ts` is a deliberate small surface, not `export *`. KEEP `libs/ui`
compound-assembly barrels (they're the public surface). TRIM the 64 internal pure re-export barrels,
especially `apps/web/src/features/*/index.ts` + `*/hooks/index.ts` and `libs/core/src/*/index.ts` — exactly
bulletproof-react's own move. Never route intra-package imports through the package barrel. Since the repo
is Biome-only, enforce via standalone `dependency-cruiser` (+ optional `eslint-plugin-no-barrel-files` if
ESLint is ever adopted).

**Controversies.** How far to go on subpath exports vs single `.` barrel for small packages. Whether to
add ESLint solely for `eslint-plugin-no-barrel-files`/`eslint-plugin-boundaries` (research leans
dependency-cruiser, standalone, no ESLint).

---

## 6. File naming (`research/naming.md`)

**Consensus.** kebab-case for FILE names is the 2026 default (unicorn `filename-case` default kebab,
bulletproof check-file KEBAB_CASE, Biome `useFilenamingConvention`, Next.js, even Angular v20 moved to
dash-lowercase). PascalCase survives only for the exported SYMBOL. Google TS (snake_case) is the lone
dissent. NO authoritative source imposes a hyphen-count or word-count cap — linters cap CASE, not LENGTH;
the actual quality rule is DESCRIPTIVE + content-matched, abbreviation discouraged ("Don't Write Utils").
`use-*.ts` and `*.test.ts` are universal/recommended middle-extension conventions; `x.types.ts` /
`x.schema.ts` dot-suffixes are optional and TRENDING DOWN (Angular v20 dropped them). For multi-word names
use hyphens; reserve the dot for tooling-known kinds (`.test`, `.d`, `.config`).

**Repo-tailored recommendation.** Keep kebab everywhere; enforce via Biome. DROP the hard ≤1-hyphen cap —
it conflicts with the repo's own good names (`use-action-row-navigation.ts`, `registry-import-validator.ts`)
and would force abbreviations every source warns against. Adopt: name = concept/primary export; ban
grab-bag basenames; keep `use-*`/`.test.*`; do NOT roll out `x.types.ts` dot-suffixes (keep plain
per-folder `types.ts`). Reconsider the grab-bag FOLDER names (`cli/add/src/utils/`, `apps/web/src/{lib,utils}/`)
— files inside are concept-named (good), folders are the weak spot. Short-name preference = soft tie-breaker.

**Controversies.** The owner's ≤1-hyphen/single-word rule vs the entire ecosystem (`.test.ts`, `use-x.ts`,
`<name>-<part>.tsx`) — the central fork. Whether to adopt dot-suffix `x.types.ts` (research says no).

---

## 7. Test placement & colocation (`research/tests.md`)

**Consensus.** Colocate unit tests as `foo.test.ts` next to source — 2025/2026 consensus (Kent C. Dodds,
React FAQ, bulletproof-react de-facto, Vitest neutral, TkDodo). `__tests__/` = legacy Jest artifact;
separate `tests/` root = integration/e2e only. Per-package `tsconfig.test.json` is the SOTA monorepo
pattern. E2e: per-app vs root package both legitimate (slight tilt to centralized at scale). Smoke =
root orchestration layer. The folder-per-module debate splits cleanly: (2a) component + its test in a
folder is UNCONTESTED; (2b) adding an `index.ts` barrel that re-exports the folder is the increasingly
DISCOURAGED part (Comeau/Wieruch defend an index-redirect; TkDodo/bulletproof argue against).

**Repo-tailored recommendation.** Keep colocated `*.test.ts(x)`; no `__tests__/`/unit `tests/`. Do NOT
add per-component folders + index barrels for grouping; flat colocated kebab files (current style) satisfy
KISS/YAGNI/readability and avoid the 100-index tab-soup + cycle risk. Keep `index.ts` barrels ONLY at the
4 libs' public entries. Registry `testing/` subfolders are justified handoff hygiene — keep. Keep
per-package `tsconfig.test.json`, per-app `apps/docs/tests/e2e/*.e2e.ts`, root smoke. Write naming
carve-outs (`.test`/`.spec`/`.e2e` suffix + `use-` prefix are exempt).

**Controversies.** Folder-per-module (2a uncontested, 2b barrel contested). E2e per-app vs root package.
Whether `use-`/`.test.` count against the owner's hyphen budget (research: exempt them).

---

## 8. File size & SRP-driven splitting (`research/filesize.md`)

**Consensus.** No objective max; ESLint `max-lines` default 300 is the shared anchor, 100–500 tolerated;
explicitly "no objective maximum." SRP at file level = "reasons to change," not line count. One main
export + small private helpers colocated is PREFERRED over splitting helpers out; extract on reuse, not
preemptively (Airbnb, Wieruch, Kent C. Dodds). Aggressive splitting HURTS via frame-switching, middleman
modules, orphaned helpers, premature abstraction (HTMX Locality-of-Behaviour, Carmack inlining). AI-era
verdict: cohesive, single-responsibility, feature-colocated files that are SMALL-TO-MEDIUM (~150–400
lines) — NOT micro-files (force jumps), NOT god-files (lost-in-the-middle); Anthropic "smallest set of
high-signal tokens," "context rot."

**Repo-tailored recommendation.** Adopt `max-lines: 300` as a WARNING, exempt generated/data files
(`catalog-snapshot.ts`, `**/generated/**`, `public/r/**`, `registry/component-docs/**`). Treat ~300+
hand-written crossings as cohesion review prompts, not mandatory splits. Codify "one main export +
colocated private helpers." Do NOT over-split the review pipeline / state machines (Carmack/LoB territory).
Keep colocated tests + single-use helpers. AGENTS.md orchestrator-split protocol holds. Do NOT impose a
hard `max-lines-per-function` (would fight keys/review sequential code).

**Controversies.** Function-length limits vs Carmack/LoB inlining (both valid in domain). Monolith-for-AI
(Pole B) vs modular-for-AI (Pole A) — resolved by phase (prototype vs production). Barrel-file question
recurs here too.

---

## 9. Publishable library & registry structure (`research/library.md`)

**Consensus.** SOTA npm-lib shape = per-subpath `exports` (one module per export), `sideEffects` set
correctly (`["**/*.css"]` for CSS, not blanket `false`), public surface via `exports`/`#internal` imports
map (everything not exported is private — shadcn v4 ships an `internal/` folder). shadcn organizes its
registry as `{ui,hooks,lib,blocks,charts,examples,internal}` with SINGLE-FILE components and NO tests in
the registry tree; build output separate. Colocation is consensus for AUTHORED source; the load-bearing
invariant is tests/stories NEVER enter `dist`/`public/r`. Dual-publish Pattern B (author `@/` aliases,
rewrite for npm, keep + `target`-flatten for copy) is more SOTA than Pattern A (package-name alias).

**Repo-tailored recommendation.** `libs/ui` package shape is already SOTA (per-subpath exports,
`sideEffects:["**/*.css"]`, tsup alias rewriting, tests excluded from `public/r` — verified grep 0). Keep
grouped component folders + colocated tests + per-folder index (more readable than shadcn's single-file
style, but NOT identical to shadcn — don't claim so). Keep Pattern B. Enforce "no escaping relative
imports in `public/r` content" (the existing `registry-import-validator.ts` is the right home). For
`libs/core`, define an explicit public surface via `exports`; `#internal/*` only if deep relatives get
noisy. Relax the hyphen rule for `.test`/`use-`/`<component>-<part>`. Bulletproof's feature model is for
APPS, not libs — for libs the analogue is "public-API surface → internal modules," enforced by `exports`.

**Controversies.** Single-file component (shadcn) vs grouped folder (diffgazer). Pattern A vs B authoring
style. Strict hyphen cap vs descriptive kebab. Per-component `index.ts` (fine for copy path, bundled for
npm path).

---

## 10. Monorepo workspace organization (`research/monorepo.md`)

**Consensus.** `apps/` + `packages/` is the canonical DEFAULT but a SOFT convention — Turborepo's own repo
uses custom groups (`cli`, `docs/*`, `crates/*/js`); trpc and vitest have NO `apps/`; create-t3-turbo uses
`apps/packages/tooling`. Tooling discovers packages from workspace globs, not magic folder names — a
`cli/`/`libs/` group is fully first-class, NOT fighting the tooling. Public binaries are UNSCOPED + BRANDED
(`turbo`, `vitest`, `shadcn`); internal/secondary CLIs are SCOPED (`@turbo/gen`, `@trpc/upgrade`). dir==name
is dominant but not enforced. Agnostic `@acme/*` scope is for TEMPLATES; shipping products brand the SCOPE
and keep generic LEAF names. Compiled+publishable vs JIT: JIT only for never-published bundler-only helpers.

**Repo-tailored recommendation.** KEEP `apps/ cli/ libs/` (earned: real deployables + lifecycle split).
KEEP `diffgazer` unscoped/branded (dir==name==bin) and `@diffgazer/*` branded scope with agnostic leaf
names (`core`, `ui`, `keys`, `add`) — already correct shipping-product practice. Do NOT make the scope
agnostic. KEEP compiled+publishable (JIT would break the copy/declaration/handoff contract). Build commands
in `package.json` + turbo tasks; root `scripts/monorepo` + per-package `scripts/` both defensible. If
config packages are ever extracted, use a `tooling/*` group.

**Controversies.** Is `apps/` mandatory (trpc/vitest say no; diffgazer has deployables so yes). Custom
groups vs 2-bucket default (taste/granularity). CLI placement package vs app. Two binaries vs subcommands
(`dgadd` vs `diffgazer add`). Agnostic vs branded scope (research: agnostic for leaves only, scope stays
branded). dir==name strictness.

---

## 11. React SPA structure beyond bulletproof-react (`research/reactapp.md`)

**Consensus.** Feature-first + thin shared layer + colocate-first-extract-later is the durable default.
The `app/` layer (routes/providers/router) is now standard. TanStack file-based routing pulls toward
route-colocated `-components/`, but code-based routing is still first-class and feature-first wins when
logic is also consumed elsewhere. 3-tier component hierarchy (`ui` primitives / shared compositions /
feature components) is universal — but in a MONOREPO the raw-primitive tier lives in the PACKAGE
(`@diffgazer/ui`), not `apps/web/src/components/ui`. Per-feature query hooks/`queryOptions` colocated
(TkDodo), configured client in `lib/`. Server state (Query) vs client state (Zustand/Context) are different
layers. Extract on proven reuse + AGENTS.md boundaries.

**Repo-tailored recommendation.** `apps/web` is already SOTA-shaped — do NOT restructure. The biggest
missing piece is ENFORCEMENT: add a boundary lint (`dependency-cruiser` standalone, since Biome) for
unidirectional `shared→features→app` + no cross-feature imports. Resolve the `components/ui` vs
`@diffgazer/ui` naming ambiguity (rename to `components/elements` OR a one-line README) — cosmetic. Keep
flat-sibling colocation; no folder-per-component, no per-component barrels; trim re-export-everything
`hooks/index.ts`/`components/index.ts`. Per-feature `api/` only when a feature fetches. Do NOT extend the
bulletproof taxonomy to `cli/server` or `cli/add`; the Ink TUI MAY use a light feature/components split.

**Controversies.** Route-colocation vs feature-first. Folder-per-component vs flat. Barrels everywhere vs
none. FSD vs bulletproof (FSD over-engineering at this size). Apps-almost-empty vs colocate-first.

---

## 12. Verifying large structural refactors (`research/verification.md`)

**Consensus.** Layered "verification trophy", cheapest first: (1) typecheck as primary gate (project
references make boundary breakage a hard error, but catch only BROKEN imports, not silently-wrong ones);
(2) full behavior test suite on the affected graph (use full suite for the gate — `--affected` under-counts
refactor ripple and has false positives, turbo#11144); (3) e2e/smoke of the shipped artifact; (4) public-API
snapshot (`attw`+`publint` validate the shipped multi-entry surface; api-extractor mis-fits multi-subpath
exports — rushstack#3557); (5) registry/artifact diffing. IDE move-with-import-update is unreliable across
package boundaries (TS#59136 closed not-planned) — use a scripted ts-morph codemod. Process: STAGED, pure
moves before logic (git rename detection needs it — Begemann 2025; Google "Small CLs"; Fowler "Two Hats").

**Repo-tailored recommendation.** Reuse the existing bespoke spine: `turbo run type-check` → full
`turbo run test` → `prepare:artifacts` + `validate:artifacts:check` + `verify:monorepo` →
`DIFFGAZER_SMOKE_STRICT_SKIPS=1 pnpm run smoke` → `git diff --check`. Codemod with the already-installed
ts-morph (move in memory, inspect, save once). Add at most: dependency-cruiser (AGENTS.md boundaries +
no-circular + no-orphans, run from repo root over whole workspace — never per-package, issue #859), knip
(staged dead-code sweep, expect workspace-alias false positives), attw+publint for published packages.
Phase 1 pure-move commit, Phase 2 splits/renames stacked on top; cross-package + registry changes atomic
within one PR.

**Controversies.** dependency-cruiser (standalone, more checks) vs eslint-plugin-boundaries (editor
feedback, needs ESLint) — Biome-only repo breaks the tie to dependency-cruiser. `--affected` vs full
suite. api-extractor single-entry vs multi-subpath exports. knip noise (config-tuning, staged adoption).
"Atomic" = each phase complete+green, NOT one mega-PR.

---

## Tensions & open decisions

The forks below are NOT settled by research — they need the owner's call before a structure skill is
written. The first four are his explicit questions. Cited evidence is in the per-topic sections above;
full option/recommendation/rationale shape is returned in this run's structured output.

1. **Hyphen cap vs content-matched naming (his Q-c, the #1 tension).** Owner wants ≤1 hyphen / ideally
   single-word. EVERY source (naming, cli, library, reactapp, tests) plus the repo's OWN STRUCTURE.md split
   plan and bulletproof-react's own files produce multi-hyphen descriptive names. 484 files (25%) violate
   the cap today; 150 are `use-*` hooks. Cannot coexist with (a) ≤200-line single-concern splits,
   (b) filename↔export alignment, and (c) ≤1 hyphen simultaneously for a hook like `useModelDialogFocusTrap`.
   Research recommendation: drop the cap as an error; adopt "name = one concept; `.test`/`use-`/`<part>`
   exempt; 4+ hyphens = split/rename smell." Owner must approve dropping his own rule.

2. **Folder-per-module grouping (his Q-a).** The component+test folder is uncontested; the per-folder
   `index.ts` barrel is the contested part (TkDodo/bulletproof against; Comeau/Wieruch for an index-redirect).
   The repo already answers YES for `libs/ui` (49 component folders) and NO for `libs/keys` (flat) and
   `apps/web` (flat siblings). Owner must pick the policy: folder-per-component only at 2–3+ sibling files,
   and whether to keep/trim the per-component index in `libs/ui` (keep — it's the public surface) vs
   internal app barrels (trim).

3. **Bulletproof-react for CLI/TUI/server (his Q-b).** Research: YES in spirit (vertical slices/screaming),
   but the dir TAXONOMY (`features/`, `components/ui`, `app/routes`) applies cleanly to UI surfaces (web,
   docs, landing, Ink TUI) and NOT to the Hono server (backend module layout) or command CLI (`commands/`).
   The repo already does exactly this. Decision is whether to DOCUMENT one model per workspace type and
   whether `cli/server`'s `shared/lib/<domain>` divergence is canonized or aligned.

4. **CLI naming/grouping (his agnostic-naming wish).** Keep `cli/` top-level group + branded `cli/diffgazer`,
   OR move toward strict `apps/`+`packages/` with the binary in one and `@diffgazer/add`/`cli/server` in the
   other. Research: `cli/` is tool-blessed and the AGENTS.md boundaries already carry the semantics; the
   agnostic wish is best applied to LEAF names (already done), NOT the scope (stays branded). Decision is
   cosmetic vs status-quo, plus the separate `dgadd` vs `diffgazer add` DX call.

5. **apps/docs registry mirror (K-1, the biggest known structure issue).** The 642-file
   `apps/docs/registry/` mirrors `libs/ui/registry`. Past audits split between "remove it" (F97/F107) and
   "accept as designed generated mirror" (F343). Owner must decide remove vs formally document.

6. **Barrel cleanup scope.** Research strongly supports trimming the 64 internal re-export barrels (esp.
   `apps/web/features/*/index.ts`, `libs/core/src/*/index.ts`). But AGENTS.md says "no broad refactors unless
   the task requires it," and `libs/core`'s domain barrels feed its public `exports`. Owner must scope: trim
   only app/CLI internal barrels, or also `libs/core` internal folder barrels.

7. **Renaming blast radius vs first-publish timing.** Any structure overhaul satisfying (1) is a broad
   rename touching public registry source, public registry JSON, generated bundles, docs, examples, and app
   consumers IN LOCKSTEP (AGENTS.md handoff rule). Mass-renaming BEFORE first publish is cheaper than after.
   Owner must decide whether to do the structure pass now (pre-publish) and how aggressively.

8. **Root-level doc/audit clutter.** Three stale mega-audit dumps (`AUDIT_/OPUS_AUDIT_/FIX_SPEC_2026-05-24.md`,
   ~950 KB total) and `specs/archive/`, `agent-specs/`, dated `audits/` sit at repo root, all matching
   `.gitignore` patterns yet committed. Owner must decide: delete, move to a `.archive/`, or keep. Low risk,
   high signal-to-noise win for repo readability.
