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
