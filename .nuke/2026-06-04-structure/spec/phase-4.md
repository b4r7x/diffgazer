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
