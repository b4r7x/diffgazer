# Structure / SRP

Audit date: 2026-05-28. Scope: file size, one-concern-per-file (SRP), filename↔export alignment, object-args refactors, and layer ownership. Object-args findings are aggregated across every domain file, not only the structure-srp domain.

---

## SOTA Structure Conventions

These rules are written to be lifted verbatim into the public docs as the canonical structure guide for the Diffgazer monorepo.

### File size

- **Target ≤ 200 lines per source file.** A file at the target reads top-to-bottom without scrolling fatigue and usually names a single concern.
- **Flag at > 300 lines.** A file over 300 lines is a split candidate and must justify its size (a cohesive single concern such as one CVA family, one Zod schema group, or one state machine) or be broken up.
- **Hard review trigger at > 350 lines.** Files this size almost always bundle multiple concerns; treat them as defects unless an explicit, documented reason exists.
- Count lines per *responsibility*, not per file alone: a 250-line file that does one thing is fine; a 250-line file that does three things is not.

### One concern per file (SRP)

- **A file owns one concern.** A React hook file owns one hook plus the private helpers that only that hook uses. When helpers become independently useful or independently testable (DOM querying, pure layout math, typeahead buffering, metadata resolution), extract them into their own files.
- **A component file owns one component family.** Variant definitions (CVA), internal layout sub-components, and state-machine helpers move to sibling files (`*-variants.ts`, `*-layouts.tsx`) when the main file grows past target. The public component file imports from them and re-exports the public surface.
- **A reducer owns action dispatch, not event sub-routing.** When a reducer's `EVENT` case fans out to 10+ sub-types, route the sub-types through a dedicated dispatch function and keep the reducer focused on top-level actions.
- **Orchestrator pattern for splits.** When splitting an oversized hook or component, the original file name is preserved as the *orchestrator*: it composes the extracted pieces and re-exports the public API unchanged. Public exports never move or break during a split.
- **Composition over reimplementation in apps.** App components compose `libs/ui` and `libs/keys` primitives. They do not reimplement list navigation, roving focus, dialog focus traps, form-field wiring, or ARIA relationships. A keyboard concern that grows past target in an app belongs in an extracted `use*Keyboard` hook, not inline in the component.

### Function arguments

- **Three or more parameters → options object.** Any function with 3+ positional parameters, or 2+ same-typed (especially boolean) parameters, takes a single `{ options }` object instead. Same-typed positionals (three booleans, two strings) are transposable at call sites with no compiler signal and are the highest-risk case.
- **Recursive/threaded state → named options.** When a function threads inherited state through recursion via trailing defaulted positionals (`baseRoot`, `visited`, `counter`), move that state into a named options object so the recursive call site reads explicitly.
- **Component props ≥ ~12 → grouped options.** A component prop interface past roughly a dozen fields should group related props into named sub-objects (`listState`, `callbacks`, `filter`, `refs`, `ui`) so call sites wire cohesive groups, not 20 loose props.
- **Wide return types → grouped sub-objects.** A hook that returns 12+ properties spanning multiple concerns groups them into named sub-objects by concern (`stream`, `checks`, `completion`, `start`) instead of a flat bag.
- Native wrappers are the documented exception: `Input`/`Textarea` keep native React event handlers; standalone `Checkbox`/`Radio` keep `checked`/`onChange(checked)`.

### Filename matches primary export

- **A file's name matches its primary export.** `button.tsx` exports `Button`; `use-listbox.ts` exports `useListbox`. A file named for one concept must not actually contain a different one.
- **Filenames must not mislead about layer or lifecycle.** A file named `dev-*` must not hold production logic; a file named for a test/dev utility must not be the real runtime module. Rename the file or relocate the misplaced symbols.
- **Compound-component export consistency.** Adopt one uniform pattern across all compound components: define the implementation as `XRoot` (e.g., `DialogRoot`, `TabsRoot`, `AccordionRoot`) and `export { XRoot as X }` at the end. Today `Tabs` uses `export { TabsRoot as Tabs }` while `Dialog` exports `Dialog` directly — converge on the `Root`-then-alias form everywhere.

### Single source of truth (no mirrors)

- **A shared concept lives in exactly one package.** Do not maintain a verbatim copy of a library inside an app. `apps/docs` must consume `@diffgazer/ui` (import/re-export, generated sync, or a shared package), not carry a 614-file byte-identical mirror of `libs/ui/registry`. Mirrored trees have no single source of truth and silently diverge.
- **Constants, schemas, and utilities are defined once.** Duplicated `sha256`, `escapeForRegex`, `parsePortEnv`, integrity hashing, library-id validators, timeout constants, and env-var-name string literals are extracted to a shared module and imported. If a `rootDir` constraint forces a copy, document the rationale in architecture docs, not only in an inline comment.

### Workspace uniformity

- **Every ESM package declares `"type": "module"`** in `package.json`, even stub apps, to keep module format explicit and match every sibling. `apps/hub` is missing it.
- **Every app/lib package has the standard script set** (`build`, `dev`, `type-check`, `test`) and a corresponding turbo task. A package with no scripts and no turbo task (e.g., `apps/hub`) is excluded from the build/test pipeline and is indistinguishable from dead code; either scaffold it to match siblings or remove it.

### Where code belongs by layer

- **`libs/keys`** — reusable keyboard-first behavior: scopes, key registration, list navigation, focus zones, focus trap/restore, focusable/tabbable utilities, scroll lock, and small keyboard/focus helpers. Public keyboard callbacks describe the semantic event (`onNavigate`, `onHighlightChange`, `onNavigationBoundaryReached`, `onZoneChange`). Focus utilities respect the element `ownerDocument`. Focusable ≠ tabbable.
- **`libs/ui`** — reusable shadcn-like UI primitives and headless-ish hooks that build app components without importing app code. `Field` owns form wiring (label/control/description/error ARIA); decorated inputs (`InputGroup`) are not form fields. Follow the variant conventions in `libs/ui/docs/content/patterns/variants.mdx`. Public registry source must build for copy/shadcn consumers without unpublished package-only assumptions.
- **`libs/registry`** — registry contracts, shadcn/public registry validation and building, copy-bundle behavior, and shared CLI workflow helpers.
- **`libs/core`** — private business logic shared between CLI and apps. Owns: (1) Zod schemas + types for config, review, events, presentation, git, context; (2) result/error types, format/string utilities, review state machines, provider filtering, API client factories, shared env/port parsing; (3) React hooks for forms, API calls, theme/navigation derived state. It must **not** import from `apps/*` or `cli/*`. Shared theme/query-client/port-parse types that apps re-declare today belong here.
- **`apps/web`** — product-specific composition, copy, domain flows, data fetching, and app-only layout. Private (`@diffgazer/web`); used as a smoke-test dependency and embedded into the `diffgazer` CLI, not published. Extract from web only when behavior is generic and reusable outside Diffgazer.
- **`apps/docs`** — the component + hook documentation site. Consumes `libs/core`, `libs/keys`, `libs/registry`, and `libs/ui` to build a searchable registry browser, theme visualizer, and consumption examples. It must consume `@diffgazer/ui`, not mirror it. Extract from docs only generic utilities, never docs-specific layout.
- **`apps/landing`** — the marketing landing page. Uses only `libs/ui` (currently for theme CSS); no app-specific composition, no product/domain logic, no docs utilities.
- **`apps/hub`** — currently a stub (planned portfolio/app-index). Either document the stub state and scaffold it to sibling-app conventions, or remove it. It must not accrue app-specific logic without a documented boundary.
- **`cli/add`** — the user-facing `dgadd` add/remove/list/diff commands. Preserves copy, package, and direct registry consumption paths. `dgadd remove` respects ownership metadata and must not remove copied shared dependencies still needed by retained items.
- **`cli/server`** — the embedded Hono backend (review pipeline, git, config, shutdown token) consumed only by the `diffgazer` CLI. CLI-internal, not a reusable primitive; bundled into the `diffgazer` binary via tsup `noExternal`.
- **`cli/diffgazer`** — the public `diffgazer` CLI binary. Two modes: web (embeds the built `@diffgazer/web` SPA with a local `cli/server` Hono server) and TUI (Ink.js terminal UI orchestrating review flows). It is a binary, not a library; it consumes `libs/core`, `libs/keys`, and `cli/server` and stays thin — app-specific features belong in web or server.

---

## Big-File Split Plan

Each oversized or multi-concern file below is broken into concrete subfiles. **In every split the original file name is kept as the orchestrator and re-exports the public surface unchanged.** Filenames are exact and proposed relative to the original file's directory.

### 1. `libs/ui/registry/hooks/use-listbox.ts` (436 lines, 5 concerns) — F98, F214, F17

Concerns: DOM item discovery/filtering, active-descendant management, typeahead search, accessible-text extraction, keyboard-navigation binding.

- **`use-listbox-dom.ts`** — internal DOM/query helpers: `hasDomItem`, `getListboxItems`, `getListboxOwnerSelector`, `isOwnedListboxItem`, `getFirstNavigableItemId`, `resolveActiveDescendant`, `getAccessibleText`.
- **`use-listbox-metadata.ts`** — metadata helpers: `hasEnabledMetadataItem`, `hasMetadataItem`, and the `ListboxMetadataItem` type.
- **`use-listbox.ts`** (orchestrator) — keeps public exports `useListbox`, `UseListboxOptions`, `UseListboxReturn`, `getEncodedListboxItemId`, `collectListboxItems`; composes the DOM + metadata helpers and delegates keyboard navigation to `useNavigation`. Target ~200 lines.

### 2. `libs/ui/registry/ui/menu/menu-item.tsx` (361 lines, 8 exports) — F213, F15

Concerns: CVA variant definitions, internal layout components, item state machine, public component.

- **`menu-item-variants.ts`** — `menuItemBase`, `menuItemIndicator`, `menuItemLabel`, `menuItemValue` CVAs + `ItemState` type + `getItemState`.
- **`menu-item-layouts.tsx`** — internal layout components `DefaultItemLayout`, `HubItemLayout`, `MenuItemIndicator`, `MenuItemIconSlot` (also resolves the duplicated icon-slot base classes from F222 into one shared constant).
- **`menu-item.tsx`** (orchestrator) — imports from both, exports `MenuItem` + `MenuItemProps`. Update `menu/index.ts` imports. Target < 250 lines.

### 3. `libs/ui/registry/ui/select/select-content.tsx` (358 lines) — F14

Concerns: listbox navigation, typeahead, search handling, dropdown positioning.

- **`use-select-typeahead.ts`** — extracted typeahead/search hook.
- **`get-visible-enabled-options.ts`** — pure utility for visible/enabled option filtering.
- **`searchable-content.tsx`** — the `SearchableContent` sub-component.
- **`select-content.tsx`** (orchestrator) — composes the above; keeps the public `SelectContent` export. Target ~200 lines.

### 4. `libs/ui/registry/hooks/use-floating-position.ts` (306 lines) — F16

Concerns: position computation, collision detection, CSS edge mapping, hook lifecycle.

- **`compute-floating-position.ts`** — pure math utilities `computePosition`, `wouldOverflow`, `shift`, `resolveCollisionPosition` (these are the same functions flagged in §3 for object-args; extract and convert together). Add unit tests for the pure math.
- **`floating-position-constants.ts`** — `OPPOSITE_SIDE` and `CROSS_AXIS_SIDES` mappings, plus `FloatingSide`/`FloatingAlign` types.
- **`use-floating-position.ts`** (orchestrator) — keeps the hook + hook-specific lifecycle; re-exports the public surface.

### 5. `libs/ui/registry/lib/stepper-variants.ts` (325 lines) — F10

One concern (CVA family) but past target.

- **`stepper-variants.ts`** (kept) — `stepperRootVariants`, `stepperStepVariants`, `stepperIndicatorVariants`, `stepperStatusIndicatorVariants` + referenced types, organized with section markers. Lowest-priority split (cohesion is clear); if compound-variant tables dominate, lift them into `stepper-compound-variants.ts` and keep the four root CVAs here. Also resolves the cross-package duplicate by keeping `libs/ui` canonical and having `apps/docs` consume it (F106).

### 6. `cli/server/src/shared/lib/config/store.ts` (530 lines) — F100, F344

Concerns: config persistence, secrets (keyring + file), trust state, provider credentials, file-watching/mtime.

- **`config-persistence.ts`** — `loadConfig`, `persistConfigAsync`, `persistConfigSync`.
- **`secrets-store.ts`** — file + keyring secret management.
- **`trust-store.ts`** — `loadTrust`, `persistTrustAsync`, `getTrust`, `removeTrust`.
- **`providers-store.ts`** — `getProviders`, `getActiveProvider`, `saveProviderCredentials`.
- **`store.ts`** (orchestrator) — `createConfigStore` becomes a thin composer delegating to the above. Separately, collapse the 13 module-level forwarder exports (lines 517–530, F344/F95/F339/F341): export `getStore()` (or the store instance) and let consumers call methods on it, rather than 13 hand-written `export const X = (...args) => getStore().X(...args)` wrappers that re-type the interface by hand.

### 7. `cli/server/src/features/review/context.ts` (394 lines, 11 functions, 3 concerns) — F101, F215

- **`workspace-discovery.ts`** — `parseWorkspaceYaml`, `resolveWorkspaceRoots`, `filterEscapedRoots`, `getWorkspaceRoots`, `discoverWorkspacePackages`, `formatWorkspaceGraph`, `WorkspacePackage` type.
- **`file-tree.ts`** — `buildFileTree` (convert to options object per §3), `formatFileTree`, `FileTreeNode` type, `MAX_TREE_NODES` constant.
- **`context.ts`** (orchestrator) — `loadContextSnapshot`, `buildProjectContextSnapshot`; imports and orchestrates the two extracted modules. (While here, fold the three near-identical dependency-aggregation `forEach` loops at lines 125–134 into one helper — F340.)

### 8. `libs/ui/scripts/validate-registry-metadata.ts` (547 lines) — F104

Category caveat: F104 is tagged `[architecture]`, but it is a genuine multi-concern oversized file with an explicit module-split remedy, so it is included here. Move the reusable validation logic out of the one-off script into a private module (`libs/ui/src/validation/`) so it is independently testable:

- **`registry-import-validator.ts`** — `extractLocalImports`, `resolveImportToRegistryPath`, `validateRegistryImportClosure`, plus `stripTemplateLiterals`, `aliasImportBase`, `existingRegistryPath`.
- **`registry-orphan-validator.ts`** — `validateOrphanFiles`.
- **`registry-exports-validator.ts`** — `validatePublicExportShape`, `validatePublicComponentProps`.
- **`validate-registry-metadata.ts`** (kept) — thin CLI wrapper that imports the validators and runs them.

### 9. `libs/core/src/schemas/config/providers.ts` (358 lines, 3 concerns) — big-file-split (libs-core)

Concerns: model lists, provider capability constants, Zod config schemas.

- **`models.ts`** — `GEMINI_MODELS`, `GLM_MODELS`, OpenRouter model types/schemas.
- **`capabilities.ts`** — `PROVIDER_CAPABILITIES`, `PROVIDER_ENV_VARS`, `AVAILABLE_PROVIDERS`.
- **`providers.ts`** (kept) — Zod config schemas (`Provider*`, `UserConfig`, `SaveConfigRequest`, etc.); imports model/capability data. Update the `schemas/config` barrel.

### 10. `libs/core/src/review/review-state.ts` (60-line reducer, mixed action + event routing) — srp (libs-core)

Not a file split but a within-file responsibility split:

- Add **`dispatch-event.ts`** (or a local `dispatchEvent()` function) that routes the `EVENT` action's 10+ sub-types (step, file, enrich, tool, agent, …) to the existing per-event handlers (`handleStepEvent`, `handleFileEvent`, …), making the handler relationship explicit.
- **`review-state.ts`** (kept) — `reviewReducer` handles only top-level actions (`START`, `EVENT`, `COMPLETE`, `COMPLETE_WITH_RESULT`, `ERROR`, `RESET`) and delegates `EVENT` to `dispatchEvent`.

### 11. `apps/web/src/features/providers/hooks/use-model-dialog-keyboard.ts` (399 lines, 4+ concerns) — F99, F276

Extract three hooks (filenames kebab-cased from the proposed hook names); the original file stays as the composing orchestrator and keeps the combined return type:

- **`use-model-search-focus.ts`** — `useModelSearchFocus` (search input + keyboard).
- **`use-model-filters.ts`** — `useModelFilters` (tier + category filter keyboards / filter index state).
- **`use-model-dialog-focus-trap.ts`** — `useModelDialogFocusTrap` (dialog boundary + close + focus-zone state).
- **`use-model-dialog-keyboard.ts`** (orchestrator) — composes the above for overall keyboard coordination; preserves the existing public return shape.

### 12. `apps/web/src/features/review/hooks/use-review-results-keyboard.ts` (289 lines) — F274

- **`use-review-severity-filter-keyboard.ts`** — `useReviewSeverityFilterKeyboard` (filter key bindings).
- **`use-review-details-tab-keyboard.ts`** — `useReviewDetailsTabKeyboard` (tab navigation keys).
- **`use-review-results-keyboard.ts`** (orchestrator) — coordinates state (focus zone, issue selection, footer text) and composes the two extracted keyboard hooks.

### 13. `apps/web/src/features/providers/hooks/use-providers-keyboard.ts` (277 lines) — F275

- **`use-providers-list-navigation.ts`** — `useProvidersListNavigation` (search + list focus).
- **`use-providers-action-buttons.ts`** — `useProvidersActionButtons` (button navigation).
- **`use-providers-dialog-keyboard.ts`** — `useProvidersDialogKeyboard` (dialog open/close sync).
- **`use-providers-keyboard.ts`** (orchestrator) — composes the three.

### 14. `apps/web/src/features/onboarding/components/onboarding-wizard.tsx` (344 lines) — F277

Concerns: step rendering, button-row navigation, keyboard handling, footer shortcuts, layout.

- **`use-onboarding-keyboard.ts`** — extracted hook for button navigation + key bindings + footer shortcuts.
- **`onboarding-wizard.tsx`** (kept) — focuses on step rendering and page structure, consumes `useOnboardingKeyboard`.

---

## Object-Args Refactor List

Every function with 3+ positional/boolean parameters (or an equivalently oversized prop/return shape), aggregated across all domains. Each function is listed once even where multiple findings overlap.

### 1. `hasDomItem` — `libs/ui/registry/hooks/use-listbox.ts:95-103` — F211, F342

Current (7 positional params, trailing boolean):
```ts
function hasDomItem(
  container: HTMLElement | null,
  itemRole: string,
  containerRole: "listbox" | "menu",
  idPrefix: string,
  id: string | null,
  getItemId: (idPrefix: string, id: string) => string,
  includeDisabled = false,
): id is string
```
Proposed (group the DOM-query concern):
```ts
function hasDomItem(options: {
  container: HTMLElement | null;
  query: {
    itemRole: string;
    containerRole: "listbox" | "menu";
    idPrefix: string;
    getItemId: (idPrefix: string, id: string) => string;
  };
  id: string | null;
  includeDisabled?: boolean;
}): options is { id: string }
```
Update call sites at lines 269–277 and 307–314.

### 2. `getItemState` — `libs/ui/registry/ui/menu/menu-item.tsx:140` — F210

Current (3 same-typed booleans — highest transposition risk):
```ts
export function getItemState(disabled: boolean, isFocused: boolean, isSelected: boolean): ItemState
```
Proposed:
```ts
export function getItemState(options: { disabled: boolean; isFocused: boolean; isSelected: boolean }): ItemState
```
Update call site at line 304: `const state = getItemState({ disabled, isFocused, isSelected });`. Reuse the same `ItemState` for `DefaultItemLayout`/`HubItemLayout`/`MenuItemIconSlot` instead of their separate `isFocused`/`isSelected`/`isDanger` booleans (F105).

### 3. `buildFileTree` — `cli/server/src/features/review/context.ts:195-201` — F212, F345

Current (5 params, 3 defaulted/threaded through recursion):
```ts
async function buildFileTree(
  root: string,
  depth: number,
  baseRoot: string = root,
  visited: Set<string> = new Set(),
  counter: { count: number; truncated: boolean } = { count: 0, truncated: false },
): Promise<FileTreeNode[]>
```
Proposed (keep `root` positional, group threaded state):
```ts
async function buildFileTree(
  root: string,
  options: {
    depth: number;
    baseRoot?: string;
    visited?: Set<string>;
    counter?: { count: number; truncated: boolean };
  },
): Promise<FileTreeNode[]>
```
Rewrite recursive call (line ~225): `buildFileTree(fullPath, { depth: depth - 1, baseRoot, visited, counter })`.

### 4. `createSession` — `cli/server/src/features/review/sessions.ts:143-150` — F26

Current (6 params):
```ts
export function createSession(
  reviewId: string,
  projectPath: string,
  headCommit: string,
  statusHash: string,
  mode: ReviewMode,
  scopeKey: string = "",
): ActiveSession
```
Proposed:
```ts
export function createSession(
  reviewId: string,
  options: { projectPath: string; headCommit: string; statusHash: string; mode: ReviewMode; scopeKey?: string },
): ActiveSession
```

### 5. `getActiveSessionForProject` — `cli/server/src/features/review/sessions.ts:268-274` — F27

Current (5 params):
```ts
export function getActiveSessionForProject(
  projectPath: string,
  headCommit: string,
  statusHash: string,
  mode: ReviewMode,
  scopeKey: string = "",
): ActiveSession | undefined
```
Proposed:
```ts
export function getActiveSessionForProject(
  projectPath: string,
  options: { headCommit: string; statusHash: string; mode: ReviewMode; scopeKey?: string },
): ActiveSession | undefined
```

### 6. `parseKeysImportLine` — `cli/add/src/utils/transform.ts:241-259` — F103

Current (4 positional params):
```ts
function parseKeysImportLine(
  line: string,
  lineIndex: number,
  regex: RegExp,
  hookNames: Set<string>,
): ParsedKeysImport | null
```
Proposed:
```ts
interface ParseKeysImportLineOptions { line: string; lineIndex: number; regex: RegExp; hookNames: Set<string>; }
function parseKeysImportLine(options: ParseKeysImportLineOptions): ParsedKeysImport | null
```

### 7. `replaceSubpathAlias` — `cli/add/src/utils/transform.ts:11-15` (F103)

Current (3 positional params):
```ts
function replaceSubpathAlias(text: string, regex: RegExp, aliasBase: string): string
```
Proposed:
```ts
function replaceSubpathAlias(options: { text: string; regex: RegExp; aliasBase: string }): string
```
Update call sites at lines 48–49.

### 8. `replaceClosingBlockComment` — `cli/add/src/utils/transform.ts:53-57` (F103)

Current (3 positional params; returns a discriminated shape):
```ts
function replaceClosingBlockComment(
  line: string,
  aliases: ResolvedConfig["aliases"],
  regexes: CompiledAliasRegexes,
): { result: string; stillInBlock: boolean }
```
Proposed:
```ts
function replaceClosingBlockComment(options: {
  line: string;
  aliases: ResolvedConfig["aliases"];
  regexes: CompiledAliasRegexes;
}): { result: string; stillInBlock: boolean }
```
Update call site at line 109; preserve the `{ result, stillInBlock }` return.

### 9. `replaceWithBlockComment` — `cli/add/src/utils/transform.ts:66-71` (F103)

Current (4 positional params; returns a discriminated shape):
```ts
function replaceWithBlockComment(
  line: string,
  openIdx: number,
  aliases: ResolvedConfig["aliases"],
  regexes: CompiledAliasRegexes,
): { result: string; opensBlock: boolean }
```
Proposed:
```ts
function replaceWithBlockComment(options: {
  line: string;
  openIdx: number;
  aliases: ResolvedConfig["aliases"];
  regexes: CompiledAliasRegexes;
}): { result: string; opensBlock: boolean }
```
Update call site at line 116; preserve the `{ result, opensBlock }` return.

### 10. `computePosition` — `libs/ui/registry/hooks/use-floating-position.ts:51-106` — F116

Current (6 positional params):
```ts
export function computePosition(
  triggerRect: DOMRect,
  contentRect: DOMRect,
  side: FloatingSide,
  align: FloatingAlign,
  sideOffset: number,
  alignOffset: number,
): { x: number; y: number }
```
Proposed: `computePosition(options: { triggerRect: DOMRect; contentRect: DOMRect; side: FloatingSide; align: FloatingAlign; sideOffset: number; alignOffset: number }): { x: number; y: number }`. Update call sites at lines 153–159 and 247–251 (and the calls inside `resolveCollisionPosition`).

### 11. `wouldOverflow` — `libs/ui/registry/hooks/use-floating-position.ts:108-122` — F116

Current (5 positional params): `wouldOverflow(x, y, contentRect, padding, vp)`.
Proposed: `wouldOverflow(options: { x: number; y: number; contentRect: DOMRect; padding: number; vp: Viewport }): boolean`.

### 12. `shift` — `libs/ui/registry/hooks/use-floating-position.ts:123-134` — F116

Current (5 positional params): `shift(x, y, contentRect, padding, vp)`.
Proposed: `shift(options: { x: number; y: number; contentRect: DOMRect; padding: number; vp: Viewport }): { x: number; y: number }`.

### 13. `resolveCollisionPosition` — `libs/ui/registry/hooks/use-floating-position.ts:136-161` — F116

Current (8 positional params):
```ts
export function resolveCollisionPosition(
  triggerRect: DOMRect,
  contentRect: DOMRect,
  preferredSide: FloatingSide,
  preferredAlign: FloatingAlign,
  sideOffset: number,
  alignOffset: number,
  collisionPadding: number,
  vp: Viewport,
): { x: number; y: number; side: FloatingSide }
```
Proposed: `resolveCollisionPosition(options: { triggerRect: DOMRect; contentRect: DOMRect; preferredSide: FloatingSide; preferredAlign: FloatingAlign; sideOffset: number; alignOffset: number; collisionPadding: number; vp: Viewport }): { x: number; y: number; side: FloatingSide }`.

### 14. `IssueListPaneProps` (component prop bag, 21 props) — `apps/web/src/features/review/components/issue-list-pane.tsx:12-34` — F162

Not positional args but an oversized prop surface (21 fields). Group into named sub-objects:
```ts
interface IssueListPaneProps {
  listState: { issues; allIssues; selectedIssueId; highlightedIssueId };
  callbacks: { onSelectIssue; onHighlightIssue; onListBoundaryReached; onListFocus };
  filter: { severityFilter; onSeverityFilterChange; onSeverityFilterReset; onSeverityFilterBoundary; focusedFilterIndex; onFocusedFilterIndexChange; isFilterFocused; onFilterKeyDown };
  refs: { filterRef; listRef };
  ui: { isFocused; title; className };
}
```
Update the `IssueListPane` call site to pass grouped objects.

### 15. `UseReviewLifecycleBaseResult` (hook return, 13 props) — `libs/core/src/api/hooks/use-review-lifecycle-base.ts:23-44` — kiss (libs-core)

Not positional args but an oversized return shape (13 properties across 5 concerns). Group into named sub-objects:
```ts
interface UseReviewLifecycleBaseResult {
  stream: { stop; abort; cancel; state; error; isStreaming };
  checks: { isNoDiffError; isCheckingForChanges; loadingMessage };
  completion: { isCompleting; skipDelay; resetCompletion };
  start: { hasStarted; hasStreamed; setHasStarted; setHasStreamed };
}
```

---

## Naming Fixes

Files whose names do not match their primary export / actual responsibility.

### 1. `cli/server/src/dev-server.ts` — F380

The filename and its `DEFAULT_DEV_SERVER_*` constants imply dev-only/test infrastructure, but the file provides the HTTP server abstraction used in **production** (`dev.ts` is the actual entry point referenced in the `package.json` `dev` script; `dev-server.ts` is the core server logic it consumes). New readers will misclassify this as throwaway dev/test code.

**Fix:** rename `dev-server.ts` → `http-server.ts` (or `server.ts`) to reflect that it is core application logic, and update all importers. Optionally move the `DEFAULT_*` constants into a separate `config.ts` to separate infrastructure config from the HTTP layer.

---

### Notes on adjacent naming findings (not file↔export mismatches)

- **F224 (Dialog/Tabs compound-component export consistency)** is an export-*consistency* issue, not a filename mismatch — `dialog.tsx` does export `Dialog`. It is captured in §1 ("Compound-component export consistency: define `XRoot`, then `export { XRoot as X }`").
- **F311 (`SidebarProvider` non-semantic `onStateChange`)** and **F370 (magic env-var-name string literals)** are public-API/constant-naming concerns, not file↔export mismatches; they are out of scope for §4 and are recorded in their respective domain findings.
