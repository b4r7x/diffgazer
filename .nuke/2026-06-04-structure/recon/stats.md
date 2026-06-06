# Structure Statistics — Recon R2

_Generated 2026-06-04. READ-ONLY recon. Repo: diffgazer monorepo._

## Methodology

- Source = `.ts` `.tsx` `.css` `.mdx` under `apps/*`, `cli/*`, `libs/*`.
- Excluded: `node_modules`, `dist`, `.turbo`, `coverage`, `build`, `pnpm-lock.yaml`, all `*.gen.ts` (TanStack `routeTree.gen.ts`), and the generated dirs `libs/ui/docs/generated` (62 files), `libs/keys/docs/generated` (12), `cli/add/src/generated` (2).
- `libs/ui/public/r` (84 files) and `libs/keys/public/r` (6 files) are **generated-but-committed registry JSON** — reported separately below, NOT mixed into source stats. They contain only `.json`, so none would land in the 4 source extensions anyway.
- `libs/ui/registry/**` (703 tracked files) is **committed source-of-truth** for the UI primitives (the shadcn-like component/hook/example tree), NOT generated. Counted as source.
- Hyphen counts use the conceptual *stem*: basename with extension and any `.test`/`.spec`/`.stories` qualifier stripped.
- Tools used: `rg --files`, `wc -l`, `awk`, `sort`, plus `python3` for parsing barrels and module grouping.

## TL;DR decision-relevant numbers

- **1904 source files**, **180,919 LOC**, mean **95 LOC/file**, median **50.5 LOC/file** (small-file culture is real).
- LOC is inflated by ONE generated data file: `libs/core/src/catalog/catalog-snapshot.ts` = **9242 lines** (marked `// GENERATED ... DO NOT EDIT BY HAND`, but lives in `src/`, not an excluded dir). Excluding it, mean drops to ~90 LOC/file.
- **Only 10 files >800 lines; 9 of those 10 are test files.** The single non-test >800 file is the generated `catalog-snapshot.ts`. Largest hand-written non-test source file is `theme-base.css` at 514 lines, then `store.ts` (417).
- **Naming rule collision:** 484 files (≈25%) have basenames with **2+ hyphens**; 150 of those are `use-*` React hooks (e.g. `use-action-row-navigation.ts`), 334 are non-hook. 74 files have **3+ hyphens** (worst: `use-scoped-navigation-focus-within.tsx`, 4 hyphens). The owner's 'at most one hyphen / ideally single-word' rule is violated by a quarter of the tree and is structurally incompatible with the `use-x-y` hook convention.
- **Test placement is overwhelmingly colocated**: 324 test files, **284 colocated** (264 sit directly beside a same-named source file = true 1:1), **40 in a `testing/` subfolder**. **Zero** `__tests__`, zero dedicated `test/`/`tests/`, zero `e2e/` dirs. Only `libs/registry` deviates (all 14 tests live in `src/testing/`); `libs/ui` is mixed (51 colocated + 26 in `testing/`).
- **100 `index.ts(x)` barrels**: 6 are package/CLI entry points, **64 are pure re-export-only**, ~30 are libs/ui compound-component assembly barrels (`Object.assign(Root, {Part})` glue).
- **Folder-per-module IS used today** — it is libs/ui's signature: 49 `registry/ui/<component>/` dirs, **47/49 with a colocated test**, **48/49 with an `index.ts` barrel**. libs/keys does NOT (flat `hooks/` with colocated tests, no per-hook folder).
- **Two coexisting paradigms**: bulletproof-react feature folders in `apps/web`, `cli/diffgazer`, `cli/server` vs folder-per-module in `libs/ui` vs flat-colocated in `libs/keys`.
- Avg directory depth **4.85**; deepest **7** (`cli/diffgazer/src/features/onboarding/components/steps/*`, `cli/server/src/shared/lib/ai/__fixtures__/*`).

## 1. Source file counts by extension

| Workspace | .ts | .tsx | .css | .mdx | total |
|---|--:|--:|--:|--:|--:|
| apps/docs | 48 | 59 | 6 | 29 | 142 |
| apps/landing | 5 | 9 | 1 | 0 | 15 |
| apps/web | 79 | 131 | 3 | 0 | 213 |
| cli/add | 32 | 0 | 0 | 0 | 32 |
| cli/diffgazer | 78 | 93 | 0 | 0 | 171 |
| cli/server | 131 | 0 | 0 | 0 | 131 |
| libs/core | 194 | 0 | 0 | 0 | 194 |
| libs/keys | 54 | 39 | 1 | 28 | 122 |
| libs/registry | 72 | 0 | 0 | 0 | 72 |
| libs/ui | 213 | 494 | 12 | 93 | 812 |
| **TOTAL** | **906** | **825** | **23** | **150** | **1904** |

Notes: `cli/server`, `cli/add`, `libs/core`, `libs/registry` are pure `.ts` (no JSX). `libs/ui` dominates the repo (812 files, 43%) because every primitive ships component + parts + test + index + examples + docs. `.mdx` lives only in docs-bearing packages (apps/docs, libs/ui/docs, libs/keys/docs).

## 2. Line-count distribution

| Workspace | >200 | >400 | >800 |
|---|--:|--:|--:|
| apps/docs | 10 | 2 | 0 |
| apps/landing | 0 | 0 | 0 |
| apps/web | 32 | 2 | 0 |
| cli/add | 5 | 1 | 1 |
| cli/diffgazer | 8 | 1 | 0 |
| cli/server | 32 | 8 | 0 |
| libs/core | 11 | 2 | 1 |
| libs/keys | 25 | 6 | 2 |
| libs/registry | 12 | 2 | 0 |
| libs/ui | 74 | 20 | 6 |
| **TOTAL** | **209** | **44** | **10** |

Total LOC: 180,919 | mean 95.0 | median 50.5. Excluding the generated 9242-line snapshot: mean ~90.

### Top 30 largest source files

| Lines | Path | Kind |
|--:|---|---|
| 9242 | `libs/core/src/catalog/catalog-snapshot.ts` | GENERATED data (committed in src/) |
| 1532 | `libs/ui/registry/ui/dialog/dialog.test.tsx` | test |
| 1175 | `libs/ui/registry/ui/navigation-list/navigation-list.test.tsx` | test |
| 1135 | `libs/ui/registry/ui/menu/menu.test.tsx` | test |
| 1017 | `libs/ui/registry/ui/select/select.test.tsx` | test |
| 933 | `libs/keys/src/hooks/use-navigation.test.tsx` | test |
| 920 | `libs/ui/registry/ui/command-palette/command-palette.test.tsx` | test |
| 845 | `libs/ui/registry/ui/radio/radio.test.tsx` | test |
| 822 | `libs/keys/src/hooks/use-focus-zone.test.ts` | test |
| 821 | `cli/add/src/commands/cli-behavior.test.ts` | test |
| 719 | `libs/ui/registry/ui/popover/popover.test.tsx` | test |
| 700 | `libs/keys/src/hooks/use-focus-trap.test.ts` | test |
| 679 | `libs/ui/registry/ui/toggle-group/toggle-group.test.tsx` | test |
| 677 | `libs/ui/registry/ui/checkbox/checkbox.test.tsx` | test |
| 669 | `cli/server/src/shared/lib/git/service.test.ts` | test |
| 669 | `apps/docs/src/lib/docs-library.test.ts` | test |
| 651 | `libs/ui/registry/hooks/testing/use-floating-position.test.ts` | test |
| 645 | `libs/ui/registry/ui/tabs/tabs.test.tsx` | test |
| 637 | `libs/ui/registry/ui/sidebar/sidebar.test.tsx` | test |
| 635 | `libs/registry/src/testing/docs-sync.test.ts` | test |
| 631 | `cli/server/src/app.test.ts` | test |
| 606 | `libs/ui/registry/ui/floating-panel/floating-panel.test.tsx` | test |
| 575 | `apps/docs/scripts/artifacts/sync.test.ts` | test |
| 553 | `libs/ui/registry/ui/toast/toast.test.tsx` | test |
| 550 | `libs/ui/registry/ui/diff-view/diff-view.test.tsx` | test |
| 541 | `libs/ui/registry/ui/code-block/code-block.test.tsx` | test |
| 523 | `cli/server/src/features/config/service.test.ts` | test |
| 522 | `libs/ui/registry/ui/accordion/accordion.test.tsx` | test |
| 514 | `libs/ui/styles/theme-base.css` | SOURCE (css) |
| 503 | `libs/registry/src/testing/shadcn.test.ts` | test |

**Key insight:** 28 of the top 30 are test files. Hand-written application/library logic stays small. The 2 non-test entries are a generated data snapshot and a CSS theme file.

### Top 15 largest NON-TEST source files (more decision-relevant)

| Lines | Path |
|--:|---|
| 9242 | `libs/core/src/catalog/catalog-snapshot.ts (GENERATED)` |
| 514 | `libs/ui/styles/theme-base.css` |
| 417 | `cli/server/src/shared/lib/config/store.ts` |
| 390 | `cli/server/src/features/review/sessions.ts` |
| 383 | `libs/keys/examples/playground/src/styles.css` |
| 379 | `libs/ui/registry/ui/shared/diff-view.css` |
| 372 | `libs/ui/registry/ui/shared/command-palette.css` |
| 359 | `apps/web/src/styles/theme-overrides.css` |
| 355 | `cli/add/src/utils/transform.ts` |
| 354 | `libs/registry/src/docs/sync-operations.ts` |
| 352 | `apps/web/src/features/providers/hooks/use-model-dialog-keyboard.ts` |
| 330 | `libs/keys/scripts/validate-registry-closure.ts` |
| 330 | `libs/core/src/review/review-state.ts` |
| 326 | `libs/registry/src/cli/command-factories.ts` |
| 324 | `libs/registry/src/cli/workflows/remove.ts` |

Aside from the generated snapshot, the largest hand-written non-test files are CSS theme files and a handful of ~320-417-line `.ts` logic files. No hand-written source `.ts/.tsx` exceeds 417 lines.

## 3. File-naming hyphen stats

Hyphen count is on the stem (extension + test/spec/stories qualifier stripped).

| Bucket | files |
|---|--:|
| 0 hyphens (single-word, the owner's ideal) | 738 |
| 1 hyphen (owner's max-allowed) | 682 |
| 2 hyphens | 410 |
| 3+ hyphens | 74 |

**1420 files (74.6%) already comply** with the ≤1-hyphen rule. **484 files (25.4%) violate it**, of which 150 are `use-*` hooks.

### Per workspace (0 / 1 / 2 / 3+ hyphens)

| Workspace | 0h | 1h | 2h | 3+h |
|---|--:|--:|--:|--:|
| apps/docs | 71 | 50 | 19 | 2 |
| apps/landing | 11 | 4 | 0 | 0 |
| apps/web | 71 | 60 | 56 | 26 |
| cli/add | 23 | 7 | 1 | 1 |
| cli/diffgazer | 28 | 82 | 57 | 4 |
| cli/server | 97 | 31 | 3 | 0 |
| libs/core | 116 | 49 | 23 | 6 |
| libs/keys | 30 | 40 | 35 | 17 |
| libs/registry | 46 | 21 | 4 | 1 |
| libs/ui | 245 | 338 | 212 | 17 |
| **TOTAL** | **738** | **682** | **410** | **74** |

`cli/server` is the cleanest (97/131 single-word). `libs/keys` is the most hyphenated relative to size (17 files at 3+ hyphens, all `use-focus-zone-tab-cycle`-style hook+playground demos). `apps/web` has the most 3+ hyphen files (26).

### All 3+ hyphen unique stems (worst offenders)

| Hyphens | Stem |
|--:|---|
| 4 | `use-scoped-navigation-focus-within` |
| 4 | `use-review-severity-filter-keyboard` |
| 4 | `use-review-details-tab-keyboard` |
| 4 | `use-model-dialog-focus-trap` |
| 4 | `use-focus-zone-tab-cycle` |
| 4 | `use-focus-trap-initial-focus` |
| 4 | `use-api-key-dialog-keyboard` |
| 4 | `use-action-row-navigation-basic` |
| 4 | `transform-public-registry-keys-imports` |
| 4 | `diff-view-palette-okabe-ito` |
| 3 | `vite-plugin-docs-rebuild` |
| 3 | `verify-dist-esm-imports` |
| 3 | `use-trust-form-keyboard` |
| 3 | `use-scroll-lock-target` |
| 3 | `use-scroll-lock-basic` |
| 3 | `use-scoped-route-state` |
| 3 | `use-scoped-navigation-basic` |
| 3 | `use-review-results-keyboard` |
| 3 | `use-review-progress-keyboard` |
| 3 | `use-review-lifecycle-base` |
| 3 | `use-review-error-handler` |
| 3 | `use-providers-page-state` |
| 3 | `use-providers-list-navigation` |
| 3 | `use-providers-dialog-keyboard` |
| 3 | `use-providers-action-buttons` |
| 3 | `use-provider-models-mapped` |
| 3 | `use-pending-docs-route` |
| 3 | `use-openrouter-models-mapped` |
| 3 | `use-model-search-focus` |
| 3 | `use-model-dialog-keyboard` |
| 3 | `use-issue-details-tabs` |
| 3 | `use-focus-zone-basic` |
| 3 | `use-focus-trap-basic` |
| 3 | `use-focus-restore-fallback` |
| 3 | `use-focus-restore-basic` |
| 3 | `use-command-palette-state` |
| 3 | `use-api-key-form` |
| 3 | `use-action-row-navigation` |
| 3 | `ui-three-path-readiness` |
| 3 | `transform-public-registry-imports` |
| 3 | `navigation-list-item-context` |
| 3 | `navigation-list-group-context` |
| 3 | `horizontal-stepper-variant-numbered` |
| 3 | `horizontal-stepper-variant-breadcrumb` |
| 3 | `horizontal-stepper-variant-ascii` |
| 3 | `get-visible-enabled-options` |
| 3 | `generate-keys-copy-bundle` |
| 3 | `floating-panel-custom-menu` |
| 3 | `diff-view-with-header` |
| 3 | `diff-view-max-height` |
| 3 | `diff-view-line-numbers` |
| 3 | `create-home-menu-action` |
| 3 | `copy-artifacts-to-package` |
| 3 | `command-palette-auto-tones` |
| 3 | `code-block-copy-button` |
| 3 | `block-bar-multi-segment` |
| 3 | `api-key-missing-view` |
| 3 | `api-key-method-selector` |

Most 3+ hyphen names are React hooks (`use-` prefix consumes a hyphen) or playground demo files. The non-hook 3+ offenders include `transform-public-registry-keys-imports`, `diff-view-palette-okabe-ito`, `horizontal-stepper-variant-numbered`, `ui-three-path-readiness`.

### Every source file with a 2+ hyphen basename (complete, 484 files)

Grouped by workspace. `(n)` = hyphen count of the stem. `use-*` entries are React-hook-convention names; the rule conflict is mostly here.

<details><summary><b>apps/docs</b> — 21 files</summary>

- `(3)` apps/docs/src/lib/hooks/use-pending-docs-route.ts
- `(3)` apps/docs/vite-plugin-docs-rebuild.ts
- `(2)` apps/docs/content/docs/app/concepts/how-it-works.mdx
- `(2)` apps/docs/content/docs/app/concepts/providers-and-models.mdx
- `(2)` apps/docs/src/components/docs-mdx/blocks/parameter-table-block.tsx
- `(2)` apps/docs/src/components/docs-mdx/blocks/props-table-block.tsx
- `(2)` apps/docs/src/components/docs-mdx/blocks/source-viewer-block.tsx
- `(2)` apps/docs/src/components/docs-mdx/blocks/use-current-library.ts
- `(2)` apps/docs/src/components/docs-mdx/doc-data-context.tsx
- `(2)` apps/docs/src/components/docs-mdx/feature-mdx-components.tsx
- `(2)` apps/docs/src/components/docs-not-found.tsx
- `(2)` apps/docs/src/components/not-found-state.tsx
- `(2)` apps/docs/src/components/preview-inset-pane.tsx
- `(2)` apps/docs/src/features/home/components/quick-start-card.tsx
- `(2)` apps/docs/src/features/theme/components/color-picker-row.tsx
- `(2)` apps/docs/src/layouts/docs-content-layout.tsx
- `(2)` apps/docs/src/lib/cross-deps-data.ts
- `(2)` apps/docs/src/lib/docs-libraries-config.ts
- `(2)` apps/docs/src/lib/load-doc-data.test.ts
- `(2)` apps/docs/src/lib/load-doc-data.ts
- `(2)` apps/docs/src/lib/use-copy-feedback.ts

</details>

<details><summary><b>apps/web</b> — 82 files</summary>

- `(4)` apps/web/src/features/providers/hooks/use-api-key-dialog-keyboard.test.tsx
- `(4)` apps/web/src/features/providers/hooks/use-api-key-dialog-keyboard.ts
- `(4)` apps/web/src/features/providers/hooks/use-model-dialog-focus-trap.ts
- `(4)` apps/web/src/features/review/hooks/use-review-details-tab-keyboard.ts
- `(4)` apps/web/src/features/review/hooks/use-review-severity-filter-keyboard.ts
- `(3)` apps/web/src/components/shared/api-key-method-selector.test.tsx
- `(3)` apps/web/src/components/shared/api-key-method-selector.tsx
- `(3)` apps/web/src/components/shared/use-trust-form-keyboard.ts
- `(3)` apps/web/src/features/providers/hooks/use-api-key-form.test.ts
- `(3)` apps/web/src/features/providers/hooks/use-api-key-form.ts
- `(3)` apps/web/src/features/providers/hooks/use-model-dialog-keyboard.test.ts
- `(3)` apps/web/src/features/providers/hooks/use-model-dialog-keyboard.ts
- `(3)` apps/web/src/features/providers/hooks/use-model-search-focus.ts
- `(3)` apps/web/src/features/providers/hooks/use-providers-action-buttons.ts
- `(3)` apps/web/src/features/providers/hooks/use-providers-dialog-keyboard.ts
- `(3)` apps/web/src/features/providers/hooks/use-providers-list-navigation.ts
- `(3)` apps/web/src/features/providers/hooks/use-providers-page-state.ts
- `(3)` apps/web/src/features/review/components/api-key-missing-view.test.tsx
- `(3)` apps/web/src/features/review/components/api-key-missing-view.tsx
- `(3)` apps/web/src/features/review/hooks/use-issue-details-tabs.ts
- `(3)` apps/web/src/features/review/hooks/use-review-error-handler.ts
- `(3)` apps/web/src/features/review/hooks/use-review-progress-keyboard.ts
- `(3)` apps/web/src/features/review/hooks/use-review-results-keyboard.ts
- `(3)` apps/web/src/hooks/use-action-row-navigation.test.tsx
- `(3)` apps/web/src/hooks/use-scoped-route-state.test.ts
- `(3)` apps/web/src/hooks/use-scoped-route-state.ts
- `(2)` apps/web/src/components/shared/storage-selector-content.test.tsx
- `(2)` apps/web/src/components/shared/storage-selector-content.tsx
- `(2)` apps/web/src/components/shared/trust-permissions-content.test.tsx
- `(2)` apps/web/src/components/shared/trust-permissions-content.tsx
- `(2)` apps/web/src/features/history/components/history-insights-pane.test.tsx
- `(2)` apps/web/src/features/history/components/history-insights-pane.tsx
- `(2)` apps/web/src/features/history/hooks/use-history-keyboard.ts
- `(2)` apps/web/src/features/history/hooks/use-history-page.test.ts
- `(2)` apps/web/src/features/history/hooks/use-history-page.ts
- `(2)` apps/web/src/features/history/hooks/use-review-history.test.ts
- `(2)` apps/web/src/features/history/hooks/use-review-history.ts
- `(2)` apps/web/src/features/onboarding/components/steps/api-key-step.tsx
- `(2)` apps/web/src/features/onboarding/hooks/onboarding-settings-sync.test.ts
- `(2)` apps/web/src/features/onboarding/hooks/use-onboarding-keyboard.ts
- `(2)` apps/web/src/features/providers/components/api-key-dialog/api-key-dialog.tsx
- `(2)` apps/web/src/features/providers/components/api-key-dialog/api-key-footer.tsx
- `(2)` apps/web/src/features/providers/components/model-select-dialog/model-filter-tabs.tsx
- `(2)` apps/web/src/features/providers/components/model-select-dialog/model-list-item.tsx
- `(2)` apps/web/src/features/providers/components/model-select-dialog/model-search-input.tsx
- `(2)` apps/web/src/features/providers/components/model-select-dialog/model-select-dialog.integration.test.tsx
- `(2)` apps/web/src/features/providers/components/model-select-dialog/model-select-dialog.tsx
- `(2)` apps/web/src/features/providers/hooks/use-model-filter.test.ts
- `(2)` apps/web/src/features/providers/hooks/use-model-filter.ts
- `(2)` apps/web/src/features/providers/hooks/use-model-filters.ts
- `(2)` apps/web/src/features/providers/hooks/use-provider-management.ts
- `(2)` apps/web/src/features/providers/hooks/use-providers-keyboard.test.tsx
- `(2)` apps/web/src/features/providers/hooks/use-providers-keyboard.ts
- `(2)` apps/web/src/features/review/components/context-snapshot-preview.tsx
- `(2)` apps/web/src/features/review/components/fix-plan-checklist.tsx
- `(2)` apps/web/src/features/review/components/issue-details-pane.test.tsx
- `(2)` apps/web/src/features/review/components/issue-details-pane.tsx
- `(2)` apps/web/src/features/review/components/issue-list-pane.test.tsx
- `(2)` apps/web/src/features/review/components/issue-list-pane.tsx
- `(2)` apps/web/src/features/review/components/issue-preview-item.test.tsx
- `(2)` apps/web/src/features/review/components/issue-preview-item.tsx
- `(2)` apps/web/src/features/review/components/lens-stats-table.tsx
- `(2)` apps/web/src/features/review/components/no-changes-view.test.tsx
- `(2)` apps/web/src/features/review/components/no-changes-view.tsx
- `(2)` apps/web/src/features/review/components/review-metrics-footer.tsx
- `(2)` apps/web/src/features/review/components/review-progress-view.test.tsx
- `(2)` apps/web/src/features/review/components/review-progress-view.tsx
- `(2)` apps/web/src/features/review/components/review-results-view.keyboard.test.tsx
- `(2)` apps/web/src/features/review/components/review-results-view.tsx
- `(2)` apps/web/src/features/review/components/review-summary-view.tsx
- `(2)` apps/web/src/features/review/components/severity-filter-group.tsx
- `(2)` apps/web/src/features/review/hooks/use-issue-selection.test.tsx
- `(2)` apps/web/src/features/review/hooks/use-issue-selection.ts
- `(2)` apps/web/src/features/review/hooks/use-review-lifecycle.ts
- `(2)` apps/web/src/features/review/hooks/use-severity-filter.test.tsx
- `(2)` apps/web/src/features/review/hooks/use-severity-filter.ts
- `(2)` apps/web/src/features/settings/components/analysis/analysis-selector-content.tsx
- `(2)` apps/web/src/features/settings/components/theme-preview-card.css
- `(2)` apps/web/src/features/settings/components/theme-preview-card.tsx
- `(2)` apps/web/src/features/settings/components/theme-selector-content.tsx
- `(2)` apps/web/src/features/settings/hooks/use-diagnostics-keyboard.ts
- `(2)` apps/web/src/lib/config-guard-cache.ts

</details>

<details><summary><b>cli/add</b> — 2 files</summary>

- `(3)` cli/add/scripts/generate-keys-copy-bundle.ts
- `(2)` cli/add/scripts/copy-docs-artifacts.ts

</details>

<details><summary><b>cli/diffgazer</b> — 61 files</summary>

- `(3)` cli/diffgazer/src/features/home/lib/create-home-menu-action.test.ts
- `(3)` cli/diffgazer/src/features/home/lib/create-home-menu-action.ts
- `(3)` cli/diffgazer/src/features/providers/components/api-key-method-selector.tsx
- `(3)` cli/diffgazer/src/features/review/components/api-key-missing-view.tsx
- `(2)` cli/diffgazer/src/app/screens/review-screen-phase.test.ts
- `(2)` cli/diffgazer/src/app/screens/review-screen-phase.ts
- `(2)` cli/diffgazer/src/app/screens/settings/agent-execution-screen.tsx
- `(2)` cli/diffgazer/src/app/screens/settings/hub-screen-values.test.ts
- `(2)` cli/diffgazer/src/app/screens/settings/hub-screen-values.ts
- `(2)` cli/diffgazer/src/app/screens/settings/theme-screen-preview.test.ts
- `(2)` cli/diffgazer/src/app/screens/settings/theme-screen-preview.ts
- `(2)` cli/diffgazer/src/app/screens/settings/trust-permissions-screen.tsx
- `(2)` cli/diffgazer/src/features/history/components/history-insights-pane.tsx
- `(2)` cli/diffgazer/src/features/history/hooks/get-history-footer.test.ts
- `(2)` cli/diffgazer/src/features/history/hooks/get-history-footer.ts
- `(2)` cli/diffgazer/src/features/history/hooks/history-screen-utils.test.ts
- `(2)` cli/diffgazer/src/features/history/hooks/history-screen-utils.ts
- `(2)` cli/diffgazer/src/features/history/hooks/use-history-screen.ts
- `(2)` cli/diffgazer/src/features/onboarding/components/steps/api-key-step.tsx
- `(2)` cli/diffgazer/src/features/onboarding/hooks/use-onboarding-wizard.ts
- `(2)` cli/diffgazer/src/features/providers/components/api-key-overlay.tsx
- `(2)` cli/diffgazer/src/features/providers/components/model-list-item.tsx
- `(2)` cli/diffgazer/src/features/providers/components/model-search-input.tsx
- `(2)` cli/diffgazer/src/features/providers/components/model-select-overlay.test.tsx
- `(2)` cli/diffgazer/src/features/providers/components/model-select-overlay.tsx
- `(2)` cli/diffgazer/src/features/providers/components/tier-filter-tabs.tsx
- `(2)` cli/diffgazer/src/features/review/components/agent-filter-bar.tsx
- `(2)` cli/diffgazer/src/features/review/components/context-snapshot-preview.tsx
- `(2)` cli/diffgazer/src/features/review/components/fix-plan-checklist.tsx
- `(2)` cli/diffgazer/src/features/review/components/issue-details-helpers.test.ts
- `(2)` cli/diffgazer/src/features/review/components/issue-details-helpers.ts
- `(2)` cli/diffgazer/src/features/review/components/issue-details-pane.tsx
- `(2)` cli/diffgazer/src/features/review/components/issue-list-pane.tsx
- `(2)` cli/diffgazer/src/features/review/components/issue-preview-item.tsx
- `(2)` cli/diffgazer/src/features/review/components/lens-stats-table.tsx
- `(2)` cli/diffgazer/src/features/review/components/no-changes-view.tsx
- `(2)` cli/diffgazer/src/features/review/components/review-metrics-footer.tsx
- `(2)` cli/diffgazer/src/features/review/components/review-progress-view.tsx
- `(2)` cli/diffgazer/src/features/review/components/review-results-view.tsx
- `(2)` cli/diffgazer/src/features/review/components/review-summary-view.tsx
- `(2)` cli/diffgazer/src/features/review/components/severity-filter-group.test.tsx
- `(2)` cli/diffgazer/src/features/review/components/severity-filter-group.tsx
- `(2)` cli/diffgazer/src/features/review/components/summary-view-helpers.test.ts
- `(2)` cli/diffgazer/src/features/review/components/summary-view-helpers.ts
- `(2)` cli/diffgazer/src/features/review/hooks/use-review-keyboard.ts
- `(2)` cli/diffgazer/src/features/review/hooks/use-review-lifecycle.test.ts
- `(2)` cli/diffgazer/src/features/review/hooks/use-review-lifecycle.ts
- `(2)` cli/diffgazer/src/features/settings/components/trust-permissions-content.tsx
- `(2)` cli/diffgazer/src/features/settings/storage/derive-save-state.test.ts
- `(2)` cli/diffgazer/src/features/settings/storage/derive-save-state.ts
- `(2)` cli/diffgazer/src/features/settings/trust-permissions/trust-editor-state.test.ts
- `(2)` cli/diffgazer/src/features/settings/trust-permissions/trust-editor-state.ts
- `(2)` cli/diffgazer/src/hooks/use-back-handler.ts
- `(2)` cli/diffgazer/src/hooks/use-config-guard.ts
- `(2)` cli/diffgazer/src/hooks/use-exit-handler.ts
- `(2)` cli/diffgazer/src/hooks/use-settings-zone.ts
- `(2)` cli/diffgazer/src/hooks/use-terminal-dimensions.ts
- `(2)` cli/diffgazer/src/lib/servers/create-process-server.test.ts
- `(2)` cli/diffgazer/src/lib/servers/create-process-server.ts
- `(2)` cli/diffgazer/src/lib/visible-slice-offset.test.ts
- `(2)` cli/diffgazer/src/lib/visible-slice-offset.ts

</details>

<details><summary><b>cli/server</b> — 3 files</summary>

- `(2)` cli/server/src/shared/lib/ai/__fixtures__/models-dev-sample.ts
- `(2)` cli/server/src/shared/lib/ai/models-dev-catalog.test.ts
- `(2)` cli/server/src/shared/lib/ai/models-dev-catalog.ts

</details>

<details><summary><b>libs/core</b> — 29 files</summary>

- `(3)` libs/core/scripts/verify-dist-esm-imports.ts
- `(3)` libs/core/src/api/hooks/use-review-lifecycle-base.ts
- `(3)` libs/core/src/providers/use-openrouter-models-mapped.test.ts
- `(3)` libs/core/src/providers/use-openrouter-models-mapped.ts
- `(3)` libs/core/src/providers/use-provider-models-mapped.test.ts
- `(3)` libs/core/src/providers/use-provider-models-mapped.ts
- `(2)` libs/core/scripts/generate-catalog-snapshot.ts
- `(2)` libs/core/src/api/hooks/match-query-state.test.ts
- `(2)` libs/core/src/api/hooks/match-query-state.ts
- `(2)` libs/core/src/api/hooks/use-provider-models.test.ts
- `(2)` libs/core/src/api/hooks/use-review-completion.test.ts
- `(2)` libs/core/src/api/hooks/use-review-completion.ts
- `(2)` libs/core/src/api/hooks/use-review-start.test.ts
- `(2)` libs/core/src/api/hooks/use-review-start.ts
- `(2)` libs/core/src/api/hooks/use-review-stream.test.ts
- `(2)` libs/core/src/api/hooks/use-review-stream.ts
- `(2)` libs/core/src/footer/use-page-footer.ts
- `(2)` libs/core/src/forms/use-submit-guard.test.ts
- `(2)` libs/core/src/forms/use-submit-guard.ts
- `(2)` libs/core/src/navigation/group-menu-items.test.ts
- `(2)` libs/core/src/navigation/group-menu-items.ts
- `(2)` libs/core/src/onboarding/use-wizard-state.test.ts
- `(2)` libs/core/src/onboarding/use-wizard-state.ts
- `(2)` libs/core/src/review/event-to-log.test.ts
- `(2)` libs/core/src/review/event-to-log.ts
- `(2)` libs/core/src/schemas/config/trust-capabilities-model.test.ts
- `(2)` libs/core/src/schemas/config/trust-capabilities-model.ts
- `(2)` libs/core/src/select/resolve-available-value.test.ts
- `(2)` libs/core/src/select/resolve-available-value.ts

</details>

<details><summary><b>libs/keys</b> — 52 files</summary>

- `(4)` libs/keys/registry/examples/use-action-row-navigation/use-action-row-navigation-basic.tsx
- `(4)` libs/keys/registry/examples/use-focus-trap/use-focus-trap-initial-focus.tsx
- `(4)` libs/keys/registry/examples/use-focus-zone/use-focus-zone-tab-cycle.tsx
- `(4)` libs/keys/registry/examples/use-scoped-navigation/use-scoped-navigation-focus-within.tsx
- `(3)` libs/keys/docs/content/hooks/use-action-row-navigation.mdx
- `(3)` libs/keys/docs/hook-docs/use-action-row-navigation.ts
- `(3)` libs/keys/registry/examples/use-focus-restore/use-focus-restore-basic.tsx
- `(3)` libs/keys/registry/examples/use-focus-restore/use-focus-restore-fallback.tsx
- `(3)` libs/keys/registry/examples/use-focus-trap/use-focus-trap-basic.tsx
- `(3)` libs/keys/registry/examples/use-focus-zone/use-focus-zone-basic.tsx
- `(3)` libs/keys/registry/examples/use-scoped-navigation/use-scoped-navigation-basic.tsx
- `(3)` libs/keys/registry/examples/use-scroll-lock/use-scroll-lock-basic.tsx
- `(3)` libs/keys/registry/examples/use-scroll-lock/use-scroll-lock-target.tsx
- `(3)` libs/keys/scripts/transform-public-registry-imports.ts
- `(3)` libs/keys/scripts/verify-dist-esm-imports.ts
- `(3)` libs/keys/src/hooks/use-action-row-navigation.test.tsx
- `(3)` libs/keys/src/hooks/use-action-row-navigation.ts
- `(2)` libs/keys/docs/content/guides/focus-and-scroll.mdx
- `(2)` libs/keys/docs/content/hooks/use-focus-restore.mdx
- `(2)` libs/keys/docs/content/hooks/use-focus-trap.mdx
- `(2)` libs/keys/docs/content/hooks/use-focus-zone.mdx
- `(2)` libs/keys/docs/content/hooks/use-scoped-navigation.mdx
- `(2)` libs/keys/docs/content/hooks/use-scroll-lock.mdx
- `(2)` libs/keys/docs/hook-docs/use-focus-restore.ts
- `(2)` libs/keys/docs/hook-docs/use-focus-trap.ts
- `(2)` libs/keys/docs/hook-docs/use-focus-zone.ts
- `(2)` libs/keys/docs/hook-docs/use-scoped-navigation.ts
- `(2)` libs/keys/docs/hook-docs/use-scroll-lock.ts
- `(2)` libs/keys/examples/playground/src/demos/use-transient-value.ts
- `(2)` libs/keys/registry/examples/use-key/use-key-basic.tsx
- `(2)` libs/keys/registry/examples/use-key/use-key-map.tsx
- `(2)` libs/keys/registry/examples/use-key/use-key-scoped.tsx
- `(2)` libs/keys/registry/examples/use-navigation/use-navigation-basic.tsx
- `(2)` libs/keys/registry/examples/use-navigation/use-navigation-tabs.tsx
- `(2)` libs/keys/registry/examples/use-scope/use-scope-basic.tsx
- `(2)` libs/keys/registry/examples/use-scope/use-scope-nested.tsx
- `(2)` libs/keys/scripts/build-docs-data.ts
- `(2)` libs/keys/scripts/build-publish-artifacts.ts
- `(2)` libs/keys/scripts/build-shadcn-registry.ts
- `(2)` libs/keys/scripts/validate-registry-closure.ts
- `(2)` libs/keys/scripts/verify-rsc-directives.ts
- `(2)` libs/keys/src/core/normalize-key-input.ts
- `(2)` libs/keys/src/hooks/use-focus-restore.test.ts
- `(2)` libs/keys/src/hooks/use-focus-restore.ts
- `(2)` libs/keys/src/hooks/use-focus-trap.test.ts
- `(2)` libs/keys/src/hooks/use-focus-trap.ts
- `(2)` libs/keys/src/hooks/use-focus-zone.test.ts
- `(2)` libs/keys/src/hooks/use-focus-zone.ts
- `(2)` libs/keys/src/hooks/use-scoped-navigation.test.tsx
- `(2)` libs/keys/src/hooks/use-scoped-navigation.ts
- `(2)` libs/keys/src/hooks/use-scroll-lock.test.ts
- `(2)` libs/keys/src/hooks/use-scroll-lock.ts

</details>

<details><summary><b>libs/registry</b> — 5 files</summary>

- `(3)` libs/registry/src/testing/copy-artifacts-to-package.test.ts
- `(2)` libs/registry/src/cli/workflows/apply-install-plan.ts
- `(2)` libs/registry/src/docs-data/build-docs-data.ts
- `(2)` libs/registry/src/docs/library-id-validation.ts
- `(2)` libs/registry/src/testing/package-manager-validation.test.ts

</details>

<details><summary><b>libs/ui</b> — 229 files</summary>

- `(4)` libs/ui/registry/examples/diff-view/diff-view-palette-okabe-ito.tsx
- `(4)` libs/ui/scripts/transform-public-registry-keys-imports.ts
- `(3)` libs/ui/registry/examples/block-bar/block-bar-multi-segment.tsx
- `(3)` libs/ui/registry/examples/command-palette/command-palette-auto-tones.tsx
- `(3)` libs/ui/registry/examples/diff-view/diff-view-line-numbers.tsx
- `(3)` libs/ui/registry/examples/diff-view/diff-view-max-height.tsx
- `(3)` libs/ui/registry/examples/diff-view/diff-view-with-header.tsx
- `(3)` libs/ui/registry/examples/floating-panel/floating-panel-custom-menu.tsx
- `(3)` libs/ui/registry/examples/horizontal-stepper/horizontal-stepper-variant-ascii.tsx
- `(3)` libs/ui/registry/examples/horizontal-stepper/horizontal-stepper-variant-breadcrumb.tsx
- `(3)` libs/ui/registry/examples/horizontal-stepper/horizontal-stepper-variant-numbered.tsx
- `(3)` libs/ui/registry/lib/testing/ui-three-path-readiness.test.ts
- `(3)` libs/ui/registry/ui/code-block/code-block-copy-button.tsx
- `(3)` libs/ui/registry/ui/command-palette/use-command-palette-state.ts
- `(3)` libs/ui/registry/ui/navigation-list/navigation-list-group-context.tsx
- `(3)` libs/ui/registry/ui/navigation-list/navigation-list-item-context.tsx
- `(3)` libs/ui/registry/ui/select/get-visible-enabled-options.ts
- `(2)` libs/ui/registry/examples/accordion/accordion-custom-handle.tsx
- `(2)` libs/ui/registry/examples/active-heading/active-heading-basic.tsx
- `(2)` libs/ui/registry/examples/active-heading/active-heading-modes.tsx
- `(2)` libs/ui/registry/examples/block-bar/block-bar-default.tsx
- `(2)` libs/ui/registry/examples/block-bar/block-bar-stats.tsx
- `(2)` libs/ui/registry/examples/breadcrumbs/breadcrumbs-custom-link.tsx
- `(2)` libs/ui/registry/examples/breadcrumbs/breadcrumbs-custom-separator.tsx
- `(2)` libs/ui/registry/examples/breadcrumbs/breadcrumbs-explicit-current.tsx
- `(2)` libs/ui/registry/examples/button/button-render-prop.tsx
- `(2)` libs/ui/registry/examples/callout/callout-custom-icon.tsx
- `(2)` libs/ui/registry/examples/code-block/code-block-bare.tsx
- `(2)` libs/ui/registry/examples/code-block/code-block-default.tsx
- `(2)` libs/ui/registry/examples/code-block/code-block-hairline.tsx
- `(2)` libs/ui/registry/examples/code-block/code-block-highlighted.tsx
- `(2)` libs/ui/registry/examples/code-block/code-block-highlights.tsx
- `(2)` libs/ui/registry/examples/code-block/code-block-terminal.tsx
- `(2)` libs/ui/registry/examples/command-palette/command-palette-comfortable.tsx
- `(2)` libs/ui/registry/examples/command-palette/command-palette-demo.tsx
- `(2)` libs/ui/registry/examples/command-palette/command-palette-dense.tsx
- `(2)` libs/ui/registry/examples/command-palette/command-palette-terminal.tsx
- `(2)` libs/ui/registry/examples/command-palette/command-palette-tones.tsx
- `(2)` libs/ui/registry/examples/command-palette/command-palette-viewfinder.tsx
- `(2)` libs/ui/registry/examples/controllable-state/controllable-state-basic.tsx
- `(2)` libs/ui/registry/examples/controllable-state/controllable-state-toggle.tsx
- `(2)` libs/ui/registry/examples/dialog/dialog-close-icon.tsx
- `(2)` libs/ui/registry/examples/dialog/dialog-custom-trigger.tsx
- `(2)` libs/ui/registry/examples/dialog/dialog-header-flat.tsx
- `(2)` libs/ui/registry/examples/dialog/dialog-viewfinder-bold.tsx
- `(2)` libs/ui/registry/examples/dialog/dialog-viewfinder-outset.tsx
- `(2)` libs/ui/registry/examples/dialog/dialog-viewfinder-subtle.tsx
- `(2)` libs/ui/registry/examples/diff-view/diff-view-bare.tsx
- `(2)` libs/ui/registry/examples/diff-view/diff-view-compare.tsx
- `(2)` libs/ui/registry/examples/diff-view/diff-view-default.tsx
- `(2)` libs/ui/registry/examples/diff-view/diff-view-dense.tsx
- `(2)` libs/ui/registry/examples/diff-view/diff-view-hairline.tsx
- `(2)` libs/ui/registry/examples/diff-view/diff-view-minimal.tsx
- `(2)` libs/ui/registry/examples/diff-view/diff-view-split.tsx
- `(2)` libs/ui/registry/examples/diff-view/diff-view-statusbar.tsx
- `(2)` libs/ui/registry/examples/diff-view/diff-view-viewfinder.tsx
- `(2)` libs/ui/registry/examples/divider/divider-custom-label.tsx
- `(2)` libs/ui/registry/examples/empty-state/empty-state-default.tsx
- `(2)` libs/ui/registry/examples/empty-state/empty-state-live.tsx
- `(2)` libs/ui/registry/examples/empty-state/empty-state-variants.tsx
- `(2)` libs/ui/registry/examples/floating-panel/floating-panel-default.tsx
- `(2)` libs/ui/registry/examples/floating-position/floating-position-basic.tsx
- `(2)` libs/ui/registry/examples/form-reset/form-reset-input.tsx
- `(2)` libs/ui/registry/examples/horizontal-stepper/horizontal-stepper-default.tsx
- `(2)` libs/ui/registry/examples/horizontal-stepper/horizontal-stepper-progress.tsx
- `(2)` libs/ui/registry/examples/horizontal-stepper/horizontal-stepper-variants.tsx
- `(2)` libs/ui/registry/examples/key-value/key-value-bordered.tsx
- `(2)` libs/ui/registry/examples/key-value/key-value-default.tsx
- `(2)` libs/ui/registry/examples/key-value/key-value-list.tsx
- `(2)` libs/ui/registry/examples/key-value/key-value-variants.tsx
- `(2)` libs/ui/registry/examples/keyscope-copy-mode/keyscope-copy-mode.tsx
- `(2)` libs/ui/registry/examples/keyscope-package-mode/keyscope-package-mode.tsx
- `(2)` libs/ui/registry/examples/menu/menu-checkbox-radio.tsx
- `(2)` libs/ui/registry/examples/navigation-list/navigation-list-default.tsx
- `(2)` libs/ui/registry/examples/navigation-list/navigation-list-density.tsx
- `(2)` libs/ui/registry/examples/navigation-list/navigation-list-indicators.tsx
- `(2)` libs/ui/registry/examples/navigation-list/navigation-list-interactive.tsx
- `(2)` libs/ui/registry/examples/navigation-list/navigation-list-progress.tsx
- `(2)` libs/ui/registry/examples/navigation-list/navigation-list-sections.tsx
- `(2)` libs/ui/registry/examples/navigation-list/navigation-list-tree.tsx
- `(2)` libs/ui/registry/examples/outside-click/outside-click-basic.tsx
- `(2)` libs/ui/registry/examples/overflow-detection/overflow-detection-basic.tsx
- `(2)` libs/ui/registry/examples/overflow-items/overflow-items-basic.tsx
- `(2)` libs/ui/registry/examples/presence/use-presence-basic.tsx
- `(2)` libs/ui/registry/examples/presence/use-presence-tooltip.tsx
- `(2)` libs/ui/registry/examples/radio/radio-group-default.tsx
- `(2)` libs/ui/registry/examples/radio/radio-group-variants.tsx
- `(2)` libs/ui/registry/examples/scroll-area/scroll-area-both.tsx
- `(2)` libs/ui/registry/examples/scroll-area/scroll-area-default.tsx
- `(2)` libs/ui/registry/examples/scroll-area/scroll-area-horizontal.tsx
- `(2)` libs/ui/registry/examples/search-input/search-input-custom.tsx
- `(2)` libs/ui/registry/examples/search-input/search-input-default.tsx
- `(2)` libs/ui/registry/examples/search-input/search-input-keyboard.tsx
- `(2)` libs/ui/registry/examples/section-header/section-header-default.tsx
- `(2)` libs/ui/registry/examples/section-header/section-header-variants.tsx
- `(2)` libs/ui/registry/examples/select/select-display-modes.tsx
- `(2)` libs/ui/registry/examples/select/select-multiselect-simple.tsx
- `(2)` libs/ui/registry/examples/select/select-search-top.tsx
- `(2)` libs/ui/registry/examples/sidebar/sidebar-auto-tone.tsx
- `(2)` libs/ui/registry/examples/sidebar/sidebar-mobile-sheet.tsx
- `(2)` libs/ui/registry/examples/sidebar/sidebar-render-prop.tsx
- `(2)` libs/ui/registry/examples/sidebar/sidebar-variant-bar.tsx
- `(2)` libs/ui/registry/examples/sidebar/sidebar-variant-block.tsx
- `(2)` libs/ui/registry/examples/sidebar/sidebar-variant-bracket.tsx
- `(2)` libs/ui/registry/examples/sidebar/sidebar-variant-caret.tsx
- `(2)` libs/ui/registry/examples/sidebar/sidebar-variant-inverted.tsx
- `(2)` libs/ui/registry/examples/spinner/spinner-label-positions.tsx
- `(2)` libs/ui/registry/examples/stepper/stepper-auto-tone.tsx
- `(2)` libs/ui/registry/examples/stepper/stepper-state-matrix.tsx
- `(2)` libs/ui/registry/examples/stepper/stepper-variant-ascii.tsx
- `(2)` libs/ui/registry/examples/stepper/stepper-variant-bullet.tsx
- `(2)` libs/ui/registry/examples/stepper/stepper-variant-numbered.tsx
- `(2)` libs/ui/registry/examples/stepper/stepper-variant-progress.tsx
- `(2)` libs/ui/registry/examples/stepper/stepper-variant-tag.tsx
- `(2)` libs/ui/registry/examples/toggle-group/toggle-group-counts.tsx
- `(2)` libs/ui/registry/examples/toggle-group/toggle-group-default.tsx
- `(2)` libs/ui/registry/examples/toggle-group/toggle-group-disabled.tsx
- `(2)` libs/ui/registry/examples/toggle-group/toggle-group-multiple.tsx
- `(2)` libs/ui/registry/examples/toggle-group/toggle-group-sizes.tsx
- `(2)` libs/ui/registry/examples/toggle-group/toggle-group-variants.tsx
- `(2)` libs/ui/registry/examples/toggle-group/toggle-group-vertical.tsx
- `(2)` libs/ui/registry/examples/use-presence/use-presence-basic.tsx
- `(2)` libs/ui/registry/examples/use-presence/use-presence-tooltip.tsx
- `(2)` libs/ui/registry/hooks/compute-floating-position.ts
- `(2)` libs/ui/registry/hooks/floating-position-constants.ts
- `(2)` libs/ui/registry/hooks/testing/compute-floating-position.test.ts
- `(2)` libs/ui/registry/hooks/testing/use-active-heading.ssr.test.tsx
- `(2)` libs/ui/registry/hooks/testing/use-active-heading.test.ts
- `(2)` libs/ui/registry/hooks/testing/use-controllable-state.test.ts
- `(2)` libs/ui/registry/hooks/testing/use-floating-position.test.ts
- `(2)` libs/ui/registry/hooks/testing/use-form-reset.test.tsx
- `(2)` libs/ui/registry/hooks/testing/use-outside-click.test.ts
- `(2)` libs/ui/registry/hooks/testing/use-overflow-items.test.ts
- `(2)` libs/ui/registry/hooks/testing/use-typeahead-buffer.test.ts
- `(2)` libs/ui/registry/hooks/use-active-heading.ts
- `(2)` libs/ui/registry/hooks/use-controllable-state.ts
- `(2)` libs/ui/registry/hooks/use-floating-indicator.ts
- `(2)` libs/ui/registry/hooks/use-floating-position.ts
- `(2)` libs/ui/registry/hooks/use-focus-restore.ts
- `(2)` libs/ui/registry/hooks/use-focus-trap.ts
- `(2)` libs/ui/registry/hooks/use-form-reset.ts
- `(2)` libs/ui/registry/hooks/use-is-mobile.ts
- `(2)` libs/ui/registry/hooks/use-listbox-dom.ts
- `(2)` libs/ui/registry/hooks/use-listbox-metadata.ts
- `(2)` libs/ui/registry/hooks/use-outside-click.ts
- `(2)` libs/ui/registry/hooks/use-overflow-items.ts
- `(2)` libs/ui/registry/hooks/use-scroll-lock.ts
- `(2)` libs/ui/registry/hooks/use-typeahead-buffer.ts
- `(2)` libs/ui/registry/lib/resolve-tab-target.ts
- `(2)` libs/ui/registry/lib/testing/registry-dialog-css.test.ts
- `(2)` libs/ui/registry/lib/testing/resolve-diff-input.test.ts
- `(2)` libs/ui/registry/lib/testing/resolve-tab-target.test.ts
- `(2)` libs/ui/registry/lib/testing/validate-registry-metadata.test.ts
- `(2)` libs/ui/registry/ui/accordion/use-accordion-state.ts
- `(2)` libs/ui/registry/ui/avatar/use-image-status.ts
- `(2)` libs/ui/registry/ui/block-bar/block-bar-context.tsx
- `(2)` libs/ui/registry/ui/block-bar/block-bar-segment.tsx
- `(2)` libs/ui/registry/ui/checkbox/checkbox-group-context.tsx
- `(2)` libs/ui/registry/ui/code-block/code-block-content.tsx
- `(2)` libs/ui/registry/ui/code-block/code-block-context.tsx
- `(2)` libs/ui/registry/ui/code-block/code-block-header.tsx
- `(2)` libs/ui/registry/ui/code-block/code-block-highlight.tsx
- `(2)` libs/ui/registry/ui/code-block/code-block-label.tsx
- `(2)` libs/ui/registry/ui/code-block/code-block-line.tsx
- `(2)` libs/ui/registry/ui/command-palette/command-palette-content.tsx
- `(2)` libs/ui/registry/ui/command-palette/command-palette-context.tsx
- `(2)` libs/ui/registry/ui/command-palette/command-palette-empty.tsx
- `(2)` libs/ui/registry/ui/command-palette/command-palette-footer.tsx
- `(2)` libs/ui/registry/ui/command-palette/command-palette-group.tsx
- `(2)` libs/ui/registry/ui/command-palette/command-palette-highlight.tsx
- `(2)` libs/ui/registry/ui/command-palette/command-palette-input.tsx
- `(2)` libs/ui/registry/ui/command-palette/command-palette-item.tsx
- `(2)` libs/ui/registry/ui/command-palette/command-palette-list.tsx
- `(2)` libs/ui/registry/ui/dialog/dialog-close-icon.tsx
- `(2)` libs/ui/registry/ui/dialog/dialog-keyboard-hints.tsx
- `(2)` libs/ui/registry/ui/diff-view/diff-view-line.tsx
- `(2)` libs/ui/registry/ui/diff-view/diff-view-split.tsx
- `(2)` libs/ui/registry/ui/diff-view/diff-view-unified.tsx
- `(2)` libs/ui/registry/ui/empty-state/empty-state-actions.tsx
- `(2)` libs/ui/registry/ui/empty-state/empty-state-description.tsx
- `(2)` libs/ui/registry/ui/empty-state/empty-state-icon.tsx
- `(2)` libs/ui/registry/ui/empty-state/empty-state-message.tsx
- `(2)` libs/ui/registry/ui/horizontal-stepper/horizontal-stepper-context.tsx
- `(2)` libs/ui/registry/ui/horizontal-stepper/horizontal-stepper-step.tsx
- `(2)` libs/ui/registry/ui/key-value/key-value-context.tsx
- `(2)` libs/ui/registry/ui/key-value/key-value-item.tsx
- `(2)` libs/ui/registry/ui/logo/get-figlet-text.test.ts
- `(2)` libs/ui/registry/ui/logo/get-figlet-text.ts
- `(2)` libs/ui/registry/ui/menu/menu-item-checkbox.tsx
- `(2)` libs/ui/registry/ui/menu/menu-item-layouts.tsx
- `(2)` libs/ui/registry/ui/menu/menu-item-radio.tsx
- `(2)` libs/ui/registry/ui/menu/menu-item-variants.ts
- `(2)` libs/ui/registry/ui/navigation-list/navigation-list-badge.tsx
- `(2)` libs/ui/registry/ui/navigation-list/navigation-list-context.tsx
- `(2)` libs/ui/registry/ui/navigation-list/navigation-list-group.tsx
- `(2)` libs/ui/registry/ui/navigation-list/navigation-list-item.tsx
- `(2)` libs/ui/registry/ui/navigation-list/navigation-list-meta.tsx
- `(2)` libs/ui/registry/ui/navigation-list/navigation-list-progress.tsx
- `(2)` libs/ui/registry/ui/navigation-list/navigation-list-status.tsx
- `(2)` libs/ui/registry/ui/navigation-list/navigation-list-subtitle.tsx
- `(2)` libs/ui/registry/ui/navigation-list/navigation-list-title.tsx
- `(2)` libs/ui/registry/ui/popover/use-auto-focus.ts
- `(2)` libs/ui/registry/ui/popover/use-popover-behavior.ts
- `(2)` libs/ui/registry/ui/radio/radio-group-context.tsx
- `(2)` libs/ui/registry/ui/radio/radio-group-item.tsx
- `(2)` libs/ui/registry/ui/select/use-select-state.ts
- `(2)` libs/ui/registry/ui/select/use-select-typeahead.ts
- `(2)` libs/ui/registry/ui/shared/nested-overlay-escape.test.tsx
- `(2)` libs/ui/registry/ui/sidebar/sidebar-item-badge.tsx
- `(2)` libs/ui/registry/ui/sidebar/sidebar-item-label.tsx
- `(2)` libs/ui/registry/ui/sidebar/sidebar-section-content.tsx
- `(2)` libs/ui/registry/ui/sidebar/sidebar-section-context.tsx
- `(2)` libs/ui/registry/ui/sidebar/sidebar-section-title.tsx
- `(2)` libs/ui/registry/ui/spinner/spinner-snake-grid.tsx
- `(2)` libs/ui/registry/ui/spinner/use-spinner-animation.ts
- `(2)` libs/ui/registry/ui/stepper/use-stepper-state.ts
- `(2)` libs/ui/registry/ui/toast/use-toast-container.ts
- `(2)` libs/ui/registry/ui/toast/use-toast-dismiss.ts
- `(2)` libs/ui/registry/ui/toggle-group/toggle-group-context.tsx
- `(2)` libs/ui/registry/ui/toggle-group/toggle-group-item.tsx
- `(2)` libs/ui/scripts/build-docs-data.ts
- `(2)` libs/ui/scripts/build-publish-artifacts.ts
- `(2)` libs/ui/scripts/build-shadcn-registry.ts
- `(2)` libs/ui/scripts/validate-registry-metadata.ts
- `(2)` libs/ui/src/validation/registry-exports-validator.ts
- `(2)` libs/ui/src/validation/registry-import-validator.ts
- `(2)` libs/ui/src/validation/registry-orphan-validator.ts
- `(2)` libs/ui/src/validation/registry-validation-fs.ts
- `(2)` libs/ui/testing/prefers-reduced-motion.ts

</details>

## 4. Test placement patterns

324 test files (`*.test.ts(x)` / `*.spec.ts(x)`).

| Pattern | count | example |
|---|--:|---|
| **Colocated** (same dir as source) | 284 | `apps/docs/src/components/breadcrumbs.test.ts` next to `breadcrumbs.tsx` |
| `testing/` subfolder | 40 | `libs/registry/src/testing/bundler.test.ts`, `libs/ui/testing/...` |
| `__tests__/` dir | 0 | (none) |
| dedicated `test/` or `tests/` dir | 0 | (none) |
| `e2e/` dir | 0 | (none — Playwright e2e lives elsewhere/under scripts) |

Of the 284 colocated tests, **264 sit directly beside a same-named source file** (true 1:1 colocation, e.g. `button.tsx` + `button.test.tsx`). The other 20 are integration/behavior tests in a shared dir without a 1:1 partner (e.g. `cli-behavior.test.ts`, `dialog-footer.integration.test.tsx`).

### Dominant pattern per workspace

| Workspace | colocated | testing/ | dominant |
|---|--:|--:|---|
| apps/docs | 14 | 0 | colocated |
| apps/landing | 1 | 0 | colocated |
| apps/web | 53 | 0 | colocated |
| cli/add | 7 | 0 | colocated |
| cli/diffgazer | 29 | 0 | colocated |
| cli/server | 47 | 0 | colocated |
| libs/core | 62 | 0 | colocated |
| libs/keys | 20 | 0 | colocated |
| libs/registry | 0 | 14 | **testing/ dir (deviates)** |
| libs/ui | 51 | 26 | colocated, but 26 in testing/ dirs |

**Colocation is the house style.** Two exceptions: `libs/registry` puts 100% of its tests in `src/testing/`, and `libs/ui` is mixed (component tests colocated in `registry/ui/<comp>/`, but cross-cutting/lib tests in `registry/lib/testing/` and `registry/hooks/testing/`).

## 5. Barrel files (`index.ts` / `index.tsx`)

**100 index barrels total.**

| Workspace | index files |
|---|--:|
| apps/docs | 4 |
| apps/landing | 0 |
| apps/web | 16 |
| cli/add | 1 |
| cli/diffgazer | 2 |
| cli/server | 1 |
| libs/core | 20 |
| libs/keys | 1 |
| libs/registry | 6 |
| libs/ui | 49 |
| **TOTAL** | **100** |

### Classification

- **Package / CLI entry points (6):** `cli/add/src/index.ts` (dgadd bin), `cli/diffgazer/src/index.tsx` (diffgazer bin), `cli/server/src/index.ts`, `libs/core/src/index.ts`, `libs/keys/src/index.ts`, `libs/registry/src/index.ts`. (apps/web & apps/docs entry via `main.tsx` / route files, not a src/index barrel; libs/ui exports per-component via package.json `exports`, no single root barrel.)
- **Pure re-export-only barrels (64):** internal folder barrels whose every statement is `export ... from` / `export * from` (+ optional `"use client"`). These are the candidates an audit might flag as YAGNI indirection.
- **libs/ui compound-assembly barrels (~30):** e.g. `dialog/index.ts`, `select/index.ts` — they `import` named parts and `Object.assign(Root, {Part})` to build the compound public API (`Dialog.Trigger`), then re-export. Not pure re-export, not business logic; they ARE the component's public surface. Legitimate.
- **Genuine logic/route barrels (few):** `apps/docs/src/routes/index.tsx` (route component), `cli/diffgazer/src/app/index.tsx` (app composition), `libs/registry/src/cli/bundler/index.ts` (81 statements — real module).

### Re-export-only internal barrels (full list, 64)

These add an import-indirection layer with no logic. `libs/core` (14) and `apps/web` (15) lean on them most for feature/schema folders.

- `apps/docs/src/components/docs-mdx/blocks/index.ts`
- `apps/docs/src/components/docs-mdx/index.ts`
- `apps/web/src/components/layout/index.ts`
- `apps/web/src/components/shared/index.ts`
- `apps/web/src/components/ui/progress/index.ts`
- `apps/web/src/components/ui/severity/index.ts`
- `apps/web/src/features/history/hooks/index.ts`
- `apps/web/src/features/history/index.ts`
- `apps/web/src/features/home/index.ts`
- `apps/web/src/features/onboarding/components/index.ts`
- `apps/web/src/features/onboarding/hooks/index.ts`
- `apps/web/src/features/onboarding/index.ts`
- `apps/web/src/features/providers/hooks/index.ts`
- `apps/web/src/features/providers/index.ts`
- `apps/web/src/features/review/hooks/index.ts`
- `apps/web/src/features/review/index.ts`
- `apps/web/src/testing/index.ts`
- `libs/core/src/api/hooks/index.ts`
- `libs/core/src/api/index.ts`
- `libs/core/src/catalog/index.ts`
- `libs/core/src/footer/index.ts`
- `libs/core/src/forms/index.ts`
- `libs/core/src/hooks/index.ts`
- `libs/core/src/index.ts`
- `libs/core/src/navigation/index.ts`
- `libs/core/src/onboarding/index.ts`
- `libs/core/src/providers/index.ts`
- `libs/core/src/review/index.ts`
- `libs/core/src/schemas/config/index.ts`
- `libs/core/src/schemas/context/index.ts`
- `libs/core/src/schemas/events/index.ts`
- `libs/core/src/schemas/git/index.ts`
- `libs/core/src/schemas/index.ts`
- `libs/core/src/schemas/presentation/index.ts`
- `libs/core/src/schemas/review/index.ts`
- `libs/core/src/select/index.ts`
- `libs/core/src/theme/index.ts`
- `libs/keys/src/index.ts`
- `libs/registry/src/cli/index.ts`
- `libs/registry/src/docs-data/index.ts`
- `libs/registry/src/index.ts`
- `libs/registry/src/shadcn/index.ts`
- `libs/ui/registry/lib/diff/index.ts`
- `libs/ui/registry/ui/badge/index.ts`
- `libs/ui/registry/ui/button/index.ts`
- `libs/ui/registry/ui/diff-view/index.ts`
- `libs/ui/registry/ui/divider/index.ts`
- `libs/ui/registry/ui/field/index.ts`
- `libs/ui/registry/ui/floating-panel/index.ts`
- `libs/ui/registry/ui/icons/index.ts`
- `libs/ui/registry/ui/input/index.ts`
- `libs/ui/registry/ui/label/index.ts`
- `libs/ui/registry/ui/logo/index.ts`
- `libs/ui/registry/ui/overflow/index.ts`
- `libs/ui/registry/ui/progress/index.ts`
- `libs/ui/registry/ui/scroll-area/index.ts`
- `libs/ui/registry/ui/search-input/index.ts`
- `libs/ui/registry/ui/section-header/index.ts`
- `libs/ui/registry/ui/skeleton/index.ts`
- `libs/ui/registry/ui/spinner/index.ts`
- `libs/ui/registry/ui/switch/index.ts`
- `libs/ui/registry/ui/textarea/index.ts`
- `libs/ui/registry/ui/toast/index.ts`
- `libs/ui/registry/ui/typography/index.ts`

## 6. Directory depth

Depth = number of path segments below repo root (slashes in path). Repo-wide average **4.85**.

| Workspace | max depth | avg depth | deepest example |
|---|--:|--:|---|
| apps/docs | 6 | 4.8 | `apps/docs/src/features/theme/components/variable-diagram.tsx` |
| apps/landing | 4 | 3.27 | `apps/landing/src/styles/index.css` |
| apps/web | 7 | 5.7 | `apps/web/src/features/settings/components/trust-permissions/page.tsx` |
| cli/add | 5 | 3.75 | `cli/add/src/commands/add/manifest.ts` |
| cli/diffgazer | 7 | 5.26 | `cli/diffgazer/src/features/onboarding/components/steps/storage-step.tsx` |
| cli/server | 7 | 5.32 | `cli/server/src/shared/lib/ai/__fixtures__/models-dev-sample.ts` |
| libs/core | 6 | 4.28 | `libs/core/src/api/hooks/queries/trust.ts` |
| libs/keys | 6 | 4.48 | `libs/keys/examples/playground/src/demos/use-transient-value.ts` |
| libs/registry | 5 | 3.94 | `libs/registry/src/cli/workflows/remove.ts` |
| libs/ui | 5 | 4.83 | `libs/ui/registry/ui/typography/typography.tsx` |

`apps/web` is the deepest on average (5.70) — driven by `features/<x>/components/<sub>/page.tsx`. `cli/server` and `cli/diffgazer` hit depth 7 via `shared/lib/<domain>/__fixtures__/` and `features/onboarding/components/steps/` respectively. The flatter packages (`apps/landing` 3.27, `libs/registry` 3.94, `cli/add` 3.75) are the small ones.

## 7. Naming smells (generic file names)

Files named `types.ts`, `utils.ts`, `constants.ts`, `shared.ts`. **No `helpers.ts`, `misc.ts`, or `common.ts` files exist.** No `common/`/`helpers/`/`misc/` directories. Generic *dirs* that do exist: `lib/` (152 files), `shared/` (100 files, mostly `cli/server/src/shared/lib/...`), `utils/` (21 files).

| Lines | File | Basename |
|--:|---|---|
| 148 | `libs/registry/src/docs-data/types.ts` | types |
| 112 | `libs/core/src/api/types.ts` | types |
| 96 | `libs/registry/src/docs-data/utils.ts` | utils |
| 81 | `libs/registry/src/docs/types.ts` | types |
| 52 | `cli/server/src/shared/lib/storage/types.ts` | types |
| 47 | `cli/server/src/shared/lib/ai/types.ts` | types |
| 45 | `cli/server/src/features/review/types.ts` | types |
| 44 | `libs/registry/src/cli/bundler/types.ts` | types |
| 43 | `cli/server/src/shared/lib/config/types.ts` | types |
| 37 | `cli/server/src/shared/lib/review/types.ts` | types |
| 36 | `apps/web/src/features/history/utils.tsx` | utils |
| 35 | `cli/server/src/shared/lib/diff/types.ts` | types |
| 34 | `libs/core/src/schemas/review/shared.ts` | shared |
| 29 | `cli/server/src/shared/lib/git/types.ts` | types |
| 25 | `libs/core/src/onboarding/types.ts` | types |
| 23 | `cli/server/src/shared/lib/review/utils.ts` | utils |
| 22 | `apps/web/src/components/ui/severity/constants.ts` | constants |
| 20 | `libs/ui/registry/component-docs/types.ts` | types |
| 16 | `libs/core/src/footer/types.ts` | types |
| 14 | `apps/web/src/features/history/types.ts` | types |
| 12 | `libs/core/src/theme/types.ts` | types |
| 11 | `libs/ui/testing/utils.ts` | utils |
| 7 | `libs/registry/src/constants.ts` | constants |
| 6 | `libs/ui/registry/lib/utils.ts` | utils |
| 3 | `cli/server/src/shared/lib/http/types.ts` | types |
| 3 | `apps/web/src/testing/utils.ts` | utils |
| 1 | `cli/diffgazer/src/features/history/types.ts` | types |
| 1 | `apps/docs/src/lib/utils.ts` | utils |

Tally: **18 `types.ts`, 7 `utils.ts`, 2 `constants.ts`, 1 `shared.ts`** = 28 generic-named files. Most are small per-domain `types.ts` modules (a deliberate per-domain convention, not a dumping ground). The two larger ones — `docs-data/types.ts` (148) and `core/src/api/types.ts` (112) — are the only ones worth splitting. `libs/ui/registry/lib/utils.ts` (6 lines) is the canonical shadcn `cn()` file. `apps/docs/src/lib/utils.ts` (1 line) and `apps/web/src/testing/utils.ts` (3 lines) are near-empty.

## 8. Folder-per-module pattern usage

**Yes — the repo uses folder-per-module today, and it is `libs/ui`'s defining structure.**

### libs/ui — folder-per-component (the canonical example)

**49** component module dirs under `libs/ui/registry/ui/<component>/`. Per-dir file count: min 2, median 5, max 16.

- **47 / 49 ship a colocated test** (`<comp>.test.tsx` in the same dir).
- **48 / 49 ship an `index.ts` barrel** (the public/compound surface).
- Simple primitives: `button/` → `button.tsx` + `button.test.tsx` + `index.ts`. `divider/`, `field/`, `label/` follow the same 3-file shape.
- Compound components fan the same folder out into part files: `select/` and `sidebar/` (16 files each), `dialog/` (15: `dialog.tsx`, `dialog-trigger.tsx`, `dialog-content.tsx`, ... + test + index), `command-palette/` and `navigation-list/` (14 each).
- A sibling `registry/ui/shared/` dir holds cross-component CSS/helpers (14 files).

So the **strict 'one component + its test + index in its own folder'** pattern the owner is asking about is already the de-facto standard for ~21 of the smaller libs/ui components, and the same folder simply grows to hold the compound parts for the larger ones.

### Where folder-per-module is NOT used

- **`libs/keys/src/hooks/`** is flat: 18 files = 9 hooks each as `<hook>.ts` + `<hook>.test.ts` side by side in one dir, no per-hook folder. (`use-navigation.ts` + `use-navigation.test.tsx`, etc.)
- **`libs/core`** uses domain folders (`schemas/`, `catalog/`, `review/`, `api/hooks/queries/`) with re-export `index.ts` barrels, not component-per-folder.
- **`apps/web`, `cli/diffgazer`, `cli/server`** use bulletproof-react feature folders (next section), where a feature folder contains many components, not one.

### Cross-cutting observation: two-to-three coexisting paradigms

| Package(s) | Structural paradigm |
|---|---|
| `apps/web`, `cli/diffgazer` | **bulletproof-react**: `app/`, `components/`, `features/<x>/{components,hooks,index,types}`, `lib/`, `config/`, `hooks/`, `types/`, `utils/`, `testing/` |
| `cli/server` | bulletproof-react variant: `features/<domain>/{service,routes,types}` + `shared/lib/<domain>/` + `shared/middlewares/` |
| `libs/ui` | **folder-per-module** (`registry/ui/<comp>/`, `registry/hooks/`, `registry/lib/`, `registry/examples/`, `registry/component-docs/`) |
| `libs/keys` | **flat colocated** (`src/hooks/` flat, `src/utils/`, `src/providers/`, `examples/playground/`) |
| `libs/core` | **domain folders** (`schemas/`, `review/`, `catalog/`, `forms/`, `providers/`, `api/`) with re-export barrels |
| `libs/registry` | **layered** (`cli/`, `docs/`, `docs-data/`, `schemas/`, `testing/`) |

apps/web markers confirming bulletproof-react: top-level `src/` has `app components config features hooks lib styles testing types utils` — a near-textbook bulletproof-react layout. `features/<x>/` each expose `components/` + `hooks/` + re-export `index.ts`.

## Appendix A. Generated-but-committed & excluded artifacts (reported separately)

| Path | files | ext | treatment |
|---|--:|---|---|
| `libs/ui/public/r` | 84 | .json | committed registry contract — separate, NOT in source stats |
| `libs/keys/public/r` | 6 | .json | committed registry contract — separate, NOT in source stats |
| `libs/ui/docs/generated` | 62 | mixed | EXCLUDED (generated) |
| `libs/keys/docs/generated` | 12 | mixed | EXCLUDED (generated) |
| `cli/add/src/generated` | 2 | .ts | EXCLUDED (generated) |
| `apps/docs/src/routeTree.gen.ts` | 1 | .ts | EXCLUDED (TanStack generated) |

**Anomaly worth flagging to the audit:** `libs/core/src/catalog/catalog-snapshot.ts` (9242 lines) is explicitly machine-generated (`// GENERATED ... DO NOT EDIT BY HAND`) yet lives inside `src/` rather than a `generated/` dir, so it is NOT excluded by the generated-dir rule and inflates libs/core LOC. Consider relocating it under a `generated/` path to keep source stats honest.

## Appendix B. Counts cross-check

- Source files: 1904 (= 906 ts + 825 tsx + 23 css + 150 mdx).
- Test files: 324 (subset of the .ts/.tsx counts).
- index barrels: 100. 2+ hyphen files: 484. >200-line files: 209.
