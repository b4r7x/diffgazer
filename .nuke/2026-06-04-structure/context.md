# Diffgazer Structure Audit — Project Context

Date: 2026-06-04 · Source of truth: `/Users/voitz/Projects/diffgazer-workspace/AGENTS.md` (repo contract)
plus recon (`recon/inventory.md`, `recon/stats.md`, `recon/conventions.md`) and 12 research notes (`research/*.md`).

This file is the snapshot every downstream structure-audit agent receives. It states the stack, the
inventory, the conventions that MUST NOT be flagged, the verbatim gates, and the concrete SOTA quality
bar tailored to THIS repo. Read it before auditing anything.

---

## 1. Project & stack

Diffgazer is a pnpm@10.28.2 + Turborepo (2.9.x) TypeScript monorepo, ESM throughout (`"type":"module"`),
linted/formatted by Biome 2.3.14 (no ESLint anywhere). It ships an AI code-review product across 10 main
workspaces plus one nested helper: a React 19 review SPA (`apps/web`), a docs site (`apps/docs`, TanStack
Start + Fumadocs), a marketing page (`apps/landing`), a public CLI binary (`cli/diffgazer`, web mode
embedding the built SPA behind a `cli/server` Hono backend + an Ink TUI mode), a shadcn-like registry CLI
(`cli/add`, bin `dgadd`), the embedded Hono backend (`cli/server`, CLI-internal), shared business logic
(`libs/core`: Zod schemas, result types, hooks, state machines), keyboard/focus primitives (`libs/keys`),
shadcn-like UI primitives (`libs/ui`), and the registry engine (`libs/registry`). Published packages:
`diffgazer`, `@diffgazer/add`, `@diffgazer/keys`, `@diffgazer/ui`. `@diffgazer/ui` and `@diffgazer/keys`
ship dual-mode (npm package + shadcn copy-source registry under `public/r`). Shared TS presets live in
`libs/core/tsconfig/`. `ts-morph@26` and `@microsoft/api-extractor` are already in the lockfile (api-extractor
is unconfigured/unused). `knip`, `sherif`, `dependency-cruiser`, `eslint-plugin-boundaries`, `publint`,
`@arethetypeswrong/cli` are NOT installed.

---

## 2. Scope inventory (from recon)

**Workspaces (10 main + 1 nested):** `apps/{web,docs,landing}`, `cli/{diffgazer,add,server}`,
`libs/{core,keys,ui,registry}`, plus `libs/keys/artifacts` (nested artifact-publisher helper).
pnpm globs: `apps/*`, `cli/*`, `libs/*`, `libs/keys/artifacts`.

**Source size (excluding generated dirs + committed registry JSON):** 1904 source files, 180,919 LOC,
mean 95 LOC/file, **median 50.5 LOC/file** (small-file culture is real). LOC inflated by one generated
data file: `libs/core/src/catalog/catalog-snapshot.ts` = 9242 lines (`// GENERATED ... DO NOT EDIT`,
but lives in `src/`, not an excluded dir). Excluding it, mean ~90.

**File counts by extension (per workspace):** apps/docs 142 (48 ts / 59 tsx / 6 css / 29 mdx) ·
apps/landing 15 · apps/web 213 (79/131/3/0) · cli/add 32 (pure .ts) · cli/diffgazer 171 (78/93) ·
cli/server 131 (pure .ts) · libs/core 194 (pure .ts) · libs/keys 122 (54/39/1/28) · libs/registry 72
(pure .ts) · **libs/ui 812 (213/494/12/93) = 43% of repo** (every primitive ships component + parts +
test + index + examples + docs).

**File length:** only 10 files >800 lines; **9 of those 10 are test files**, the 10th is the generated
snapshot. Largest hand-written NON-test source file is `libs/ui/styles/theme-base.css` (514), then
`cli/server/src/shared/lib/config/store.ts` (417), `cli/server/.../review/sessions.ts` (390),
`cli/add/src/utils/transform.ts` (355), `apps/web/.../use-model-dialog-keyboard.ts` (352),
`libs/core/src/review/review-state.ts` (330). **No hand-written `.ts/.tsx` exceeds 417 lines.**
209 files >200 lines; 44 >400; 10 >800.

**Where tests live today (324 test files):** overwhelmingly COLOCATED — 284 colocated (264 true 1:1
beside same-named source), 40 in a `testing/` subfolder. **Zero `__tests__/`, zero unit `tests/` dir,
zero `e2e/` dir.** Per-workspace dominant = colocated everywhere EXCEPT: `libs/registry` (100% in
`src/testing/`) and `libs/ui` (mixed: 51 colocated + 26 in `testing/` for cross-cutting lib/hook tests).
E2E lives only in `apps/docs/tests/e2e/*.e2e.ts` (Playwright + visual baselines). Smoke lives at root
`scripts/monorepo/smoke-*.mjs`. Each package has its own `tsconfig.test.json`.

**Barrels:** 100 `index.ts(x)` total. 6 are package/CLI entry points; **64 are pure re-export-only**
(the YAGNI-suspect internal barrels, concentrated in `libs/core` 14 and `apps/web` 15); ~30 are
`libs/ui` compound-component assembly barrels (`Object.assign(Root,{Part})` — legitimate, they ARE the
public surface). `libs/ui` 49 barrels (per-component), `libs/keys` 1 (flat).

**Naming / hyphen distribution (stem = basename minus ext and `.test`/`.spec`/`.stories`):**
738 files 0-hyphen, 682 1-hyphen, 410 2-hyphen, 74 3+-hyphen. **1420 files (74.6%) already comply with
≤1 hyphen; 484 (25.4%) violate it, of which 150 are `use-*` hooks.** Worst offenders are React hooks
(`use-scoped-navigation-focus-within`, `use-review-severity-filter-keyboard` = 4 hyphens) and
keys/ui example/playground demo files. cli/server is cleanest (97/131 single-word); apps/web has the
most 3+ hyphen files (26); libs/keys is most-hyphenated relative to size.

**Structural paradigms coexisting:** (a) bulletproof-react feature-first — `apps/web`, `cli/diffgazer`
(Ink TUI port: `app/{providers,screens,router}`, `features/<x>/{components,hooks,lib}`); (b) feature-first
backend — `cli/server` (`features/<domain>/{router,service,schemas,types}` + `shared/{lib,middlewares}`);
(c) command-screaming CLI — `cli/add` (`commands/` + `utils/`); (d) folder-per-module — `libs/ui`
(`registry/ui/<comp>/` with component + test + index; 49 dirs, 47 with colocated test, 48 with index);
(e) flat colocated — `libs/keys` (`src/hooks/` flat); (f) domain folders + barrels — `libs/core`.

**Root-level clutter (tracked):** `audits/` 41 files (dated runs to 2026-06-01), `specs/archive/` 61
(stale), `agent-specs/` 21, `agent-skills/` 1 (the project-rules skill, current), `deploy/` 5,
`scripts/` 30 (live monorepo tooling). **Three stale mega-audit dumps at repo root**: `AUDIT_2026-05-24.md`
(193 KB), `OPUS_AUDIT_2026-05-24.md` (707 KB), `FIX_SPEC_2026-05-24.md` (52 KB) — all match `.gitignore`
patterns yet are committed. `apps/hub` was removed (RESOLVED; stale references remain in deploy/audits).

**Generated vs committed:** gitignored = `tmp/`, `apps/docs/registry/` (642-file mirror of libs/ui
registry), `apps/docs/src/generated/`, `*/docs/generated/`, `cli/add/src/generated/`, `dist/`. Committed
contract = `libs/{ui,keys}/public/r` (84 + 6 JSON) and `libs/{ui,keys}/registry/` sources.

---

## 3. Intentional conventions (DO NOT flag as findings)

From AGENTS.md + recon/conventions.md. A structure audit that flags these is WRONG.

- **The 10-package split and ownership boundaries** are intentional and documented per-package. `libs/core`
  must not import `apps/*`/`cli/*`. `cli/server` is CLI-internal (bundled into the binary via tsup
  `noExternal`); its non-library shape is intentional. `cli/diffgazer` is a thin binary, not a library.
  `apps/landing` deliberately uses only `libs/ui` (theme CSS).
- **3 top-level groups `apps/ cli/ libs/`** — tool-blessed (each is a workspace glob; Turborepo's own repo
  uses custom groups). Not the 2-bucket default, but a valid lifecycle split. NOT a finding.
- **Registry source-vs-public-artifact split.** `libs/{ui,keys}/public/r/*` are committed ON PURPOSE
  (reviewable handoff contract). Generated trees (`*/docs/generated`, `cli/add/src/generated`,
  `apps/docs/src/generated`) must NOT be committed; their absence is correct. Public registry source
  rewriting package imports to local copied paths (copy mode), and `libs/keys/public/r` TS not emitting
  relative `.js` specifiers, are deliberate contracts.
- **Test colocation as `<name>.test.ts(x)`** is the documented house style (TESTING.md). Per-package
  `testing/` dirs hold shared helpers (NOT a separate `@diffgazer/testing` package — extraction deferred
  until a 3rd consumer). Registry `testing/` subfolders (`libs/ui/registry/.../testing/`,
  `libs/registry/src/testing/`) QUARANTINE tests out of the copy/shadcn handoff bundle — intentional
  handoff hygiene, KEEP. `getByTestId`/`querySelector`/`fireEvent`/`vi.mock`/hardcoded waits with the
  mandatory inline `// <kind>: <why>` annotation are allowed exceptions, not slop.
- **Component-as-folder grouping** in `libs/ui/registry/ui/<component>/` (component + parts + test + index)
  is the established, intentional shadcn-registry layout. Per-component `index.ts` there is the public/
  compound surface, not an internal convenience barrel.
- **Feature folders** in `apps/web`, `cli/diffgazer`, `cli/server` are intentional (bulletproof-react /
  feature-backend). `cli/add`'s flat `commands/` + `utils/` is the correct CLI idiom.
- **Variant styling**: CVA for named variant dimensions; CSS files only for what Tailwind cannot express;
  Records only for non-class values; plain Tailwind+`cn()` for single booleans. Shared `*-variants.ts`
  sibling files are the documented split target — do not flag them.
- **Public API naming**: value controls `value`/`defaultValue`/`onChange(value)`; native wrappers keep
  native `onChange(event)`; non-value state keeps semantic names (`open`/`onOpenChange`, etc.);
  Checkbox/Radio boolean-prop exception (`checked`/`onChange(checked)`/`value:string`) is documented;
  `Field` owns ARIA wiring; keys callbacks describe semantic events. No deprecated aliases before first release.
- **Per-domain `types.ts`** files (18 of them) are a deliberate convention, not a dumping ground. No
  `helpers.ts`/`misc.ts`/`common.ts` exist. `libs/ui/registry/lib/utils.ts` (6 lines) is the canonical
  shadcn `cn()`.
- **tsconfig topology**: `type-check` covers source + tests + `scripts/`; the separate `tsconfig.test.json`
  per package (and `scripts/tsconfig.json`) is intentional. Do NOT propose re-adding a `*.test.*` exclude.
- **Dual-publish Pattern B** for `libs/ui`/`libs/keys`: author `@/`-aliased source, tsup rewrites for npm,
  registry JSON keeps `@/` + `target`-flattens for copy. Intentional and SOTA.
- **Package naming**: branded scope `@diffgazer/*` for libs/internal; public binary `diffgazer` unscoped +
  branded (dir==name==bin); agnostic LEAF names (`core`, `ui`, `keys`, `add`). This is correct
  shipping-product practice — do NOT make the scope agnostic.
- **`apps/web/src/components/ui/`** holds app-LOCAL product-shaped primitives (`severity`, review
  `progress`, `card-layout`) that are deliberately NOT generic enough to extract. Correct per extraction rules.

---

## 4. Gates (verbatim from AGENTS.md "Verification Gates")

Run the narrowest relevant gate first, broaden when blast radius crosses packages.

- After keys changes: focused keys tests + `pnpm --filter @diffgazer/keys type-check`.
- After UI primitive changes: focused UI tests + `pnpm --filter @diffgazer/ui type-check`.
- After web adoption changes: focused web tests + `pnpm --filter @diffgazer/web type-check`.
- After registry/CLI/docs/public-handoff changes: `pnpm run prepare:artifacts` and
  `pnpm run validate:artifacts:check`.
- Before declaring SOTA/ready, run all of:
  - `DIFFGAZER_SKIP_ARTIFACT_PREPARE=1 pnpm exec turbo run type-check`
  - `DIFFGAZER_SKIP_ARTIFACT_PREPARE=1 pnpm exec turbo run test`
  - `DIFFGAZER_SMOKE_STRICT_SKIPS=1 pnpm run smoke` (validates bundled offline snapshot every run; add
    `DIFFGAZER_SMOKE_ALLOW_NETWORK=1` to also validate the live models.dev fetch, as CI does)
  - `pnpm run verify:monorepo`
- Run `pnpm run prepare:artifacts` before artifact validation / docs sync / root type-check / root tests /
  release checks when generated files are missing or stale.
- Always run `git diff --check` before final response.

---

## 5. Quality bar — the concrete SOTA rules for THIS repo

Distilled from the 12 research notes, reconciled with AGENTS.md + recon. Every rule is short, factual,
actionable. Where research disagreed, the rule states the repo-tailored resolution; see `research.md`
"Tensions & open decisions" for the items only the owner can settle.

### Test placement
- KEEP colocated `<name>.test.ts(x)` next to source. This is the 2025/2026 consensus (Kent C. Dodds,
  Vitest, React FAQ) and the repo's house style. Do NOT introduce `__tests__/` or a unit `tests/` root.
- KEEP registry `testing/` subfolders (`libs/ui/registry/.../testing/`, `libs/registry/src/testing/`) —
  they quarantine tests out of the copy/shadcn handoff bundle. Add/keep an assertion that no `public/r`
  item references a `.test.`/`.stories.` path (regression guard).
- KEEP e2e per-app under `apps/docs/tests/e2e/*.e2e.ts` with the distinct `.e2e.ts` suffix. Do NOT build
  a root e2e package for one consumer (YAGNI). If `apps/web` adds e2e, mirror `apps/web/tests/e2e/`.
- KEEP smoke at `scripts/monorepo/`. Cross-package/published-artifact validation belongs at the root.
- KEEP per-package `tsconfig.test.json` + the solution-config/project-references pattern.

### Naming policy
- KEEP kebab-case files and folders everywhere (web, docs, landing, cli/*, libs/*). PascalCase only for
  the exported symbol, never the filename. Enforce via Biome `useFilenamingConvention`
  (`kebab-case` + `export`), relying on consecutive-extension handling for `.test.ts`.
- DROP a hard "≤1 hyphen / single-word" cap as an error. No authoritative source (unicorn, bulletproof
  check-file, Biome, Google TS, Angular v20, Next.js) imposes a hyphen/word count; linters cap CASE, not
  length. The repo's own STRUCTURE.md split plan MANDATES multi-hyphen names. Bulletproof-react's own
  files (`create-discussion.tsx`, `md-preview/`) are multi-hyphen.
- Apply instead: **the file name names exactly one concept / its primary export** (kebab-cased); ban
  grab-bag basenames (`utils.ts`, `helpers.ts`, `common.ts`, `misc.ts`, `lib.ts`); descriptive
  multi-hyphen names are CORRECT, not violations.
- CARVE OUT (exempt from any hyphen reasoning): the `.test`/`.spec`/`.e2e`/`.integration.test`/
  `.keyboard.test` middle-extension segments, the React-mandated `use-` hook prefix, and the
  `<component>-<part>` compound-component idiom (`tabs-trigger.tsx`).
- A base name needing 4+ hyphens (`use-review-severity-filter-keyboard`, `use-scoped-navigation-focus-within`)
  is a SMELL prompting a rename or a file split (the file likely does too much) — NOT a mechanical truncation.
- Proper-noun exception: `models-dev-catalog.ts` keeps two hyphens because `models.dev` is a product name.
- The owner's short-name preference is a soft TIE-BREAKER only ("if two names are equally clear, pick shorter").

### Barrel policy
- KEEP exactly ONE public barrel per published lib as its package entry (`libs/core|keys|ui|registry`
  `src/index.ts`), and prefer GRANULAR subpath `exports` over a single fat `.` barrel for large surfaces
  (already done in `@diffgazer/ui` per-component and `@diffgazer/core` per-domain — SOTA shape, keep it).
- KEEP `libs/ui` compound-assembly barrels (`dialog/index.ts` doing `Object.assign(Root,{Part})`) — they
  ARE the component public surface, not internal convenience.
- TRIM internal pure re-export barrels inside app/CLI code (the 64 re-export-only ones; concentrated in
  `apps/web/src/features/*/index.ts`, `*/hooks/index.ts`, and `libs/core/src/*/index.ts`). Bulletproof-react
  itself reversed its stance and now says "import the files directly." Vitest: removing internal barrels
  cuts transformed files ~85%; Atlassian: 75% faster builds, 50% faster local tests.
- NEVER route intra-package imports through the package's own barrel (cycle + dev-speed risk).
- For `@diffgazer/core`, verify `dist/index.js`/`src/index.ts` is a deliberate small surface, not
  `export *` of everything; steer consumers to subpaths. Keep `sideEffects:["**/*.css"]` for ui.

### File-size guidance
- No hard max. Use ~300 lines as a WARNING (the inherited ESLint `max-lines` default; tolerated band
  100–500). Count per RESPONSIBILITY, not per file. Treat the ~300+ hand-written crossings (`store.ts`
  417, `sessions.ts` 390, `transform.ts` 355, `use-model-dialog-keyboard.ts` 352) as cohesion review
  prompts, not mandatory splits.
- EXEMPT from any line rule: generated/data files (`libs/core/src/catalog/catalog-snapshot.ts`,
  `**/generated/**`, `libs/{ui,keys}/public/r/**`, `registry/component-docs/**` data tables).
- File rule = **one main export + its small private helpers colocated** (Airbnb "one component, pure
  helpers allowed"; Kent C. Dodds colocation). Extract a helper/hook/component ONLY on demonstrated reuse
  or a real readability cliff — never preemptively.
- Do NOT over-split sequential pipeline / state-machine code (`cli/server/src/features/review/*`,
  `libs/core/src/review/review-state.ts`) — Carmack/Locality-of-Behaviour territory; keep cohesive even
  at 300–400 lines, prefer in-file named sections over scattering.
- AGENTS.md split protocol still holds: when a file genuinely must split, keep the original filename as
  the ORCHESTRATOR that composes the pieces and re-exports the public surface UNCHANGED.
- Function args: ≥3 positional OR ≥2 same-typed → options object. Component props ≳12 / hook returns ≳12
  → grouped sub-objects.

### Per-workspace structure prescriptions
- **React SPA (`apps/web`)**: already SOTA-shaped (bulletproof-react: `app/` providers+router+routes,
  `components/{ui,shared,layout}`, `config/`, `features/<x>/{components,hooks}`, `hooks/`, `lib/`, `types/`,
  `utils/`, `testing/`). Do NOT restructure. Keep flat-sibling colocation; do NOT migrate to
  folder-per-component or add per-component barrels. Per-feature `api/` only when a feature actually
  fetches (colocate `queryOptions` + key factory; configured client stays in `lib/query-client.ts`).
  The highest-value missing piece is ENFORCEMENT (boundary lint), not layout. Note the `components/ui`
  vs `@diffgazer/ui` naming ambiguity (cosmetic).
- **Docs (`apps/docs`)**: TanStack Start + Fumadocs; consumes `@diffgazer/ui` — must not mirror it. The
  642-file `apps/docs/registry/` mirror is the single biggest known structure issue (K-1): decide remove
  vs formally document as accepted generated mirror.
- **Landing (`apps/landing`)**: minimal `sections/` + `styles/`; uses only `libs/ui`. Keep tiny; no
  features/lib/hooks ceremony.
- **CLI command tool (`cli/add`)**: command-screaming `commands/` (one file/folder per subcommand) +
  `utils/` logic + `context.ts`. Correct CLI idiom (matches oclif/shadcn). Do NOT bulletproof-react-ify;
  do NOT flatten into generic `services/`.
- **TUI (`cli/diffgazer`)**: Ink IS React — `app/{providers,screens,router}` + `components/{ui,layout}` +
  `features/<x>/{components,hooks,lib}` + cross-cutting `hooks/`, `lib/servers/`, `theme/`, `types/` is a
  best-in-class bulletproof-react-for-TUI port (validated by 2025 Ink practice). Keep the embedded-server
  separation (`cli/server` workspace + `cli/diffgazer/src/lib/servers/*` launcher adapters) — stronger
  than vercel/astro. Keep it thin; logic stays in `libs/core`/`libs/keys`.
- **Hono server (`cli/server`)**: at/near SOTA. Feature folders (`features/<domain>/{router,service,
  schemas,types}`) mounted via `app.route()`; factory `createApp()` separate from runtime entry
  (`http-server.ts`) and lib entry (`index.ts`); shared `middlewares/` + `shared/lib/<domain>/`; colocated
  `schemas.ts` + `zValidator`; `Result`-based domain layer that never throws into `onError`; 4-layer SSE
  seam (transport→adapter→pipeline→session pub/sub) keeping the pipeline HTTP-agnostic and TUI-reusable.
  Do NOT add Rails controllers (breaks Hono type inference), RPC (`hc<AppType>`), or OpenAPI (YAGNI for a
  CLI-internal server). Watch the ~30-file `features/review` slice: if a sub-area grows, promote to nested
  sub-feature folders (`review/context/`, `review/stream/`) rather than flattening more single files.
- **Libraries (`libs/core|ui|keys|registry`)**: organize by public-API surface + domain module, ONE
  `src/index.ts` public entry, granular subpath `exports`. Do NOT retrofit `features/`. `libs/ui` keeps
  grouped component folders + colocated tests + per-folder index (more readable than shadcn's single-file
  style — but it is NOT literally the shadcn layout). Consider a `#internal/*` imports map only if deep
  relatives get noisy. shadcn v4 itself ships an `internal/` folder — the private-module idea is blessed.

### Monorepo grouping
- KEEP `apps/ cli/ libs/`. Tool-blessed lifecycle split. KEEP `apps/` (genuine deployables). KEEP the
  branded `@diffgazer/*` scope + unscoped branded `diffgazer` binary (dir==name==bin). KEEP
  compiled+publishable strategy (JIT would break the copy/declaration/handoff contract). Build commands
  in `package.json` scripts + turbo tasks; root `scripts/monorepo` for orchestration; per-package
  `scripts/` for codegen — all defensible.

### Refactor-verification protocol (for any move/rename pass)
- Gate order: (1) `turbo run type-check` (primary gate — project references make boundary breakage a hard
  error); (2) FULL `turbo run test` (not `--affected` for the gate — refactor ripple under-counts);
  (3) `prepare:artifacts` + `validate:artifacts:check` + `verify:monorepo`; (4)
  `DIFFGAZER_SMOKE_STRICT_SKIPS=1 pnpm run smoke`; (5) `git diff --check`.
- Codemod with the already-installed **ts-morph** (`sourceFile.move`/`directory.move` then `project.save()`,
  whole plan in memory, inspect, save once). It owns cross-package resolution that VS Code drops
  (TS#59136 closed not-planned). Avoid IDE drag-and-drop for mass moves.
- Process: Phase 1 = pure-move commit (import-rewrites only, no logic), green on all gates, renders as
  renames (`git diff -M`); Phase 2 = SRP splits / symbol renames / barrel changes stacked on top. Keep
  cross-package + registry-artifact changes atomic within a single PR (the tree must compile between PRs).
- Optional new tooling (priority order, standalone since repo is Biome-only): **dependency-cruiser**
  (encode AGENTS.md boundaries + `no-circular` + `no-orphans`; run from repo root over the whole workspace,
  never per-package) and **knip** (post-move dead-file/export/dep sweep, staged warning→error, expect
  false positives on workspace path aliases). For published packages, **attw + publint** (`pnpm pack` →
  `attw --pack` + `publint`) guard that a relocated file did not break an `exports` subpath. `sherif`
  optional (overlaps `check-invariants.mjs`). `api-extractor` mis-fits multi-subpath exports — deprioritize.
