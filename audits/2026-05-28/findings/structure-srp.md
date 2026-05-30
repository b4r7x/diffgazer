# Findings: structure-srp

## Summary

| Severity | Count | STILL-OPEN | NEW | REGRESSION |
| --- | --- | --- | --- | --- |
| Critical | 0 | 0 | 0 | 0 |
| High | 7 | 0 | 7 | 0 |
| Medium | 7 | 0 | 7 | 0 |
| Low | 7 | 0 | 7 | 0 |
| **Total** | **21** | **0** | **21** | **0** |

---

## Critical

_No critical findings._

---

## High

### F97 — [NEW] [dry] Duplicate hook implementations across monorepo packages (DRY violation)

- **file:line** — `libs/ui/registry/hooks/use-listbox.ts, apps/docs/registry/hooks/use-listbox.ts`
- **What** — The use-listbox hook (436 LOC) is identically duplicated between libs/ui/registry and apps/docs/registry. All registry component files are also duplicated: select-content.tsx (358 LOC), menu-item.tsx (361 LOC), and 40+ other components appear in both locations.
- **Why** — Maintaining two copies of the same registry source means fixes and changes must be applied twice and will inevitably drift apart.
- **How** — Consolidate one of the registries as the canonical source. The apps/docs/registry should import and re-export from libs/ui/registry, or conversely, only maintain one canonical registry. Use symlinking or re-export patterns to share code while respecting package boundaries. Remove the duplicate 614 files from apps/docs/registry.
- **Effort** — high

### F98 — [NEW] [srp] use-listbox hook exceeds SRP (436 lines, 5+ concerns)

- **file:line** — `libs/ui/registry/hooks/use-listbox.ts:1-436`
- **What** — The useListbox hook combines 5 concerns: DOM item discovery/filtering (hasDomItem, getListboxItems), active descendant management (resolveActiveDescendant, syncDomActiveDescendant), typeahead search (handleTypeahead, readTypeaheadQuery integration), accessibility text extraction (getAccessibleText), and keyboard navigation binding (useNavigation integration). Total line count 436 exceeds 200-line …
- **Why** — A single hook owning five unrelated responsibilities is hard to reason about, test in isolation, and change safely.
- **How** — Extract 3-4 smaller hooks: (1) useListboxDOM (DOM discovery, filtering, owner-scoping), (2) useListboxTypeahead (typeahead buffer + search logic), (3) useAccessibleLabel (getAccessibleText). Keep useListbox as the orchestrator, compose the smaller hooks. Move keyboard navigation responsibility to a separate hook or delegate to useNavigation more fully.
- **Effort** — high

### F99 — [NEW] [srp] use-model-dialog-keyboard hook is oversized (399 lines, mixed concerns)

- **file:line** — `apps/web/src/features/providers/hooks/use-model-dialog-keyboard.ts:1-399`
- **What** — This hook manages 4+ concerns: focus zone state (focusZone, setFocusZone), filter state (filterIndex, setFilterIndex), footer button state (footerButtonIndex, tabFocusedFooterIndex), and keyboard event handling across 7 zones (close, search, filters, list, footer, etc). Returns an object with 13+ properties and 7+ handler functions. Nearly 400 lines violates SRP.
- **Why** — Bundling several independent state machines and handlers into one hook makes each concern harder to follow and modify without affecting the others.
- **How** — Break into 4-5 smaller hooks: (1) useModelDialogFocusZones (manage zone state + zone transitions), (2) useModelDialogFilters (manage filter index, filter buttons), (3) useModelDialogFooter (manage footer button state), (4) useModelSelection (model ID state, confirm/cancel logic). Compose these in a hook that exports the combined return type. Each sub-hook handles one responsibility.
- **Effort** — high

### F107 — [NEW] [file-organization] apps/docs/registry is a full copy-mirror of libs/ui/registry; breaks reusability boundary

- **file:line** — `apps/docs/registry/ (entire directory, 614 files)`
- **What** — The apps/docs package contains a complete copy of libs/ui/registry (all 614 .ts/.tsx files: hooks, components, docs, examples, registry.json). This violates the reusability + public API boundary: registry items should have a single source of truth in libs/ui and be re-exported or imported, not duplicated.
- **Why** — A full duplicated mirror has no single source of truth, so the docs app can silently diverge from the published library.
- **How** — Restructure apps/docs to import and re-export from @diffgazer/ui. Remove apps/docs/registry/ entirely. Update apps/docs tsconfig paths or build logic to resolve @components, @hooks, @lib aliases to @diffgazer/ui/components, @diffgazer/ui/hooks, @diffgazer/ui/lib. Ensure the docs app consumes the published lib, not a copy.
- **Effort** — high

### F211 — [NEW] [object-args] hasDomItem: 7 positional parameters should become object args (with nested query helper)

- **file:line** — `libs/ui/registry/hooks/use-listbox.ts:95-103`
- **What** — Function `hasDomItem` takes 7 positional parameters: container, itemRole, containerRole, idPrefix, id, getItemId, includeDisabled. This makes the function hard to call and maintain.
- **Why** — A seven-argument positional signature is error-prone at call sites and obscures which value maps to which parameter.
- **How** — Refactor to: `hasDomItem(options: { container: HTMLElement | null; query: { itemRole: string; containerRole: 'listbox' | 'menu'; idPrefix: string; getItemId: (prefix: string, id: string) => string }; id: string | null; includeDisabled?: boolean }): id is string`. This groups DOM query concerns and item lookup concerns, making the intent clearer. Update call sites (lines 269, 307) to pass a `query`…
- **Effort** — medium

### F342 — [NEW] [object-args] Multiple positional parameters on hasDomItem function

- **file:line** — `libs/ui/registry/hooks/use-listbox.ts:95-103`
- **What** — The function hasDomItem accepts 7 positional parameters including a boolean flag, making it difficult to read at call sites (lines 269-277 and 307-314). Current signature: function hasDomItem(container, itemRole, containerRole, idPrefix, id, getItemId, includeDisabled)
- **Why** — A long positional list ending in a bare boolean flag makes call sites unreadable and easy to get wrong.
- **How** — Refactor to accept an options object: hasDomItem(container, query) where query: { itemRole, containerRole, idPrefix, id, getItemId, includeDisabled? }. Update both call sites (lines 269-277, 307-314).
- **Effort** — low

### F343 — [NEW] [dry] Artifact copy-mode creates 400+ identical duplicated files from @diffgazer/ui registry

- **file:line** — `apps/docs/registry/* (all identical copies from libs/ui/registry/)`
- **What** — The entire @diffgazer/ui registry (hooks, lib, component-docs, ui components, examples) is duplicated verbatim in apps/docs/registry/. Diff confirms binary-identical files across 400+ paths (e.g., use-listbox.ts, menu-item.tsx, dialog components, component-docs/, etc.). This is intentional artifact sync per prepare-generated.mjs, but represents substantial maintenance burden.
- **Why** — Even when intentional, 400+ verbatim duplicated files are a large maintenance surface that must be kept in sync.
- **How** — This is working as designed per artifact sync architecture. No change needed if copy-mode is intentional. Document in AGENTS.md or keep as-is; treat as verified anti-pattern (accepted per architecture), not a bug.
- **Effort** — low

---

## Medium

### F100 — [NEW] [srp] config/store.ts is too large (530 lines, mixed responsibilities)

- **file:line** — `cli/server/src/shared/lib/config/store.ts:1-530`
- **What** — The createConfigStore factory mixes config persistence, secrets management (keyring + file-based), trust state management, provider credentials, and file-watching/mtime tracking. 530 lines of nested async functions and state management. Embeds 6+ inner functions (persistConfig, persistTrust, persistFileSecrets, getSettings, updateSettings, saveProviderCredentials).
- **Why** — One factory owning persistence, secrets, trust, credentials, and file-watching is hard to test and change without unintended cross-effects.
- **How** — Extract to separate modules: (1) config-persistence.ts (loadConfig, persistConfigAsync, persistConfigSync), (2) secrets-store.ts (file and keyring secret management), (3) trust-store.ts (loadTrust, persistTrustAsync, getTrust, removeTrust), (4) providers-store.ts (getProviders, getActiveProvider, saveProviderCredentials). Compose these in createConfigStore as a thin orchestrator that delegates to …
- **Effort** — high

### F101 — [NEW] [srp] review/context.ts has mixed concerns: workspace discovery, file tree building, context snapshot generation (394 lines)

- **file:line** — `cli/server/src/features/review/context.ts:1-394`
- **What** — This file handles: (1) workspace discovery (parseWorkspaceYaml, getWorkspaceRoots, discoverWorkspacePackages), (2) file-tree building (buildFileTree, formatFileTree), (3) context snapshot generation (buildProjectContextSnapshot), and (4) snapshot loading/caching (loadContextSnapshot). 394 lines with 7+ exported/internal functions.
- **Why** — Three distinct concerns in one file blur module boundaries and make each harder to locate, test, and reuse.
- **How** — Extract to separate modules: (1) workspace-discovery.ts (parseWorkspaceYaml, getWorkspaceRoots, discoverWorkspacePackages), (2) file-tree.ts (buildFileTree, formatFileTree, formatWorkspaceGraph), (3) context-snapshot.ts (buildProjectContextSnapshot, loadContextSnapshot, cache invalidation logic). Compose in a facade or use composition at the call site.
- **Effort** — medium

### F102 — [NEW] [dry] Duplicate component-docs files across apps/docs and libs/ui

- **file:line** — `libs/ui/registry/component-docs/*, apps/docs/registry/component-docs/*`
- **What** — Documentation metadata (component-docs/menu.ts, select.ts, sidebar.ts, etc., 40+ files) are duplicated between libs/ui/registry and apps/docs/registry. Each file is 250-320 LOC of component documentation, props descriptions, and examples lists.
- **Why** — Duplicated documentation metadata across packages drifts apart, producing inconsistent docs between the library and the docs app.
- **How** — Keep single source in libs/ui/registry/component-docs. Have apps/docs/registry re-export from the lib version, or generate docs programmatically during the build.
- **Effort** — medium

### F210 — [NEW] [object-args] getItemState: Replace 3 boolean positional params with object args

- **file:line** — `libs/ui/registry/ui/menu/menu-item.tsx:140`
- **What** — Function `getItemState(disabled: boolean, isFocused: boolean, isSelected: boolean)` takes 3 boolean positional parameters
- **Why** — Three same-typed boolean positionals are easy to transpose at call sites without any compiler signal.
- **How** — Create an options object: `getItemState(options: { disabled: boolean; isFocused: boolean; isSelected: boolean }): ItemState`. Update call site at line 304: `const state = getItemState({ disabled, isFocused, isSelected });`
- **Effort** — low

### F212 — [NEW] [object-args] buildFileTree: 5 positional params with defaults should use options object

- **file:line** — `cli/server/src/features/review/context.ts:195-201`
- **What** — Function `buildFileTree(root: string, depth: number, baseRoot?: string, visited?: Set, counter?: {...})` has 5 positional parameters, with 3 having default values. This makes recursive calls hard to read.
- **Why** — Trailing optional positionals make the recursive call site unclear about which inherited state is being threaded through.
- **How** — Refactor to: `buildFileTree(root: string, options: { depth: number; baseRoot?: string; visited?: Set<string>; counter?: { count: number; truncated: boolean } } = {}): ...`. Rewrite recursive call: `buildFileTree(fullPath, { depth: depth - 1, baseRoot, visited, counter })`. Clarifies that baseRoot, visited, and counter are inherited from parent calls.
- **Effort** — low

### F215 — [NEW] [srp] review/context.ts: 394 lines mixing workspace discovery, file tree building, and formatting

- **file:line** — `cli/server/src/features/review/context.ts:1-394`
- **What** — File contains 11 functions across 3 distinct concerns: (1) workspace discovery (parseWorkspaceYaml, resolveWorkspaceRoots, filterEscapedRoots, getWorkspaceRoots, discoverWorkspacePackages, formatWorkspaceGraph), (2) file tree building (buildFileTree, formatFileTree), (3) project context snapshot (loadContextSnapshot, buildProjectContextSnapshot). Public exports: loadContextSnapshot, buildProjectCo…
- **Why** — Eleven functions spanning three concerns in one module make ownership unclear and changes more error-prone.
- **How** — Split into 3 files: (1) `workspace-discovery.ts` – parseWorkspaceYaml, resolveWorkspaceRoots, filterEscapedRoots, getWorkspaceRoots, discoverWorkspacePackages, formatWorkspaceGraph, WorkspacePackage type. (2) `file-tree.ts` – buildFileTree, formatFileTree, FileTreeNode type, MAX_TREE_NODES constant. (3) `context.ts` – loadContextSnapshot, buildProjectContextSnapshot, which import and orchestrate t…
- **Effort** — medium

### F344 — [NEW] [srp] Store facade exports 13 module-level functions that all delegate to singleton

- **file:line** — `cli/server/src/shared/lib/config/store.ts:517-530`
- **What** — Lines 517-530 export 13 functions (getSettings, updateSettings, getProviders, etc.) that are thin wrappers delegating all arguments to a singleton getStore() call. Each is nearly identical boilerplate: export const X = (...args) => getStore().X(...args).
- **Why** — Thirteen near-identical delegating wrappers are repetitive boilerplate that must be updated in lockstep with the store API.
- **How** — Option A: Remove module-level exports 517-530 entirely; consumers use getStore().getSettings() directly or import getStore. Option B (lighter): Document the pattern as intentional for lazy initialization, keep exports but remove duplication by using a factory function that generates re-exports. Option A is preferred.
- **Effort** — low

---

## Low

### F103 — [NEW] [object-args] Overly complex parameter handling in parseKeysImportLine and related regex functions

- **file:line** — `cli/add/src/utils/transform.ts:241-259`
- **What** — parseKeysImportLine accepts 4 positional parameters (line: string, lineIndex: number, regex: RegExp, hookNames: Set<string>). Returns a union type ParsedKeysImport | null. Similar pattern in replaceSubpathAlias, replaceClosingBlockComment, replaceWithBlockComment functions all take 3+ positional parameters.
- **Why** — Several functions with 3-4 positional parameters obscure call-site intent and are awkward to extend.
- **How** — Convert to: parseKeysImportLine({ line, lineIndex, regex, hookNames }). Create an options type ParseKeysImportLineOptions. Similarly refactor replaceSubpathAlias, replaceClosingBlockComment, replaceWithBlockComment to accept options objects. This improves clarity at call sites (lines 312, 239-241, etc.) and allows future extensions without signature changes.
- **Effort** — low

### F104 — [NEW] [architecture] Unused internal helper functions may exist; validate validate-registry-metadata.ts module separation

- **file:line** — `libs/ui/scripts/validate-registry-metadata.ts:1-547`
- **What** — This 547-line validation script bundles validation rules, path resolution, import extraction, registry dependency resolution, and orphan detection. Many internal helper functions (stripTemplateLiterals, extractLocalImports, aliasImportBase, existingRegistryPath, resolveImportToRegistryPath, etc.) are specific to registry validation but live in a script file rather than a reusable module.
- **Why** — Reusable validation logic buried in a one-off script cannot be shared or unit-tested independently of the CLI entry point.
- **How** — Consider extracting core validation functions into libs/ui/src/validation/ as a private module: (1) registry-import-validator.ts (extractLocalImports, resolveImportToRegistryPath, validateRegistryImportClosure), (2) registry-orphan-validator.ts (validateOrphanFiles), (3) registry-exports-validator.ts (validatePublicExportShape, validatePublicComponentProps). Keep the script as a thin CLI wrapper. …
- **Effort** — medium

### F105 — [NEW] [type-safety] DefaultItemLayout, HubItemLayout, MenuItemIconSlot use multiple boolean props instead of union state

- **file:line** — `libs/ui/registry/ui/menu/menu-item.tsx:62-136`
- **What** — DefaultItemLayout and HubItemLayout accept isFocused, isSelected, isDanger (separate booleans). Combined, they create 8 possible states, but not all are semantically meaningful. MenuItemIconSlot has isFocused, isSelected booleans plus optional className flags. Boolean soup can lead to invalid state combinations.
- **Why** — Independent booleans permit semantically invalid combinations that a single union state would make unrepresentable.
- **How** — Introduce a union type: type ItemState = 'normal' | 'focused' | 'selected' | 'danger' | 'danger-focused' | 'disabled' | 'disabled-focused' (actually, MenuItem already has getItemState function at line 140; reuse it for these layout components). Replace {isFocused, isSelected, isDanger} with {state: ItemState}. Update rendering logic to branch on state instead of boolean combinations.
- **Effort** — low

### F106 — [NEW] [dry] Duplicate stepper-variants definitions across monorepo

- **file:line** — `libs/ui/registry/lib/stepper-variants.ts, apps/docs/registry/lib/stepper-variants.ts`
- **What** — The stepper-variants.ts file (325 LOC) is identically duplicated between libs/ui/registry and apps/docs/registry. It defines a large CVA (class-variance-authority) object with 100+ variants.
- **Why** — A 325-line variant definition kept in two places will drift, yielding inconsistent stepper styling between the library and docs.
- **How** — Consolidate: keep only libs/ui/registry/lib/stepper-variants.ts. Have apps/docs/registry re-export from it.
- **Effort** — low

### F213 — [NEW] [big-file-split] menu-item.tsx: 8 exports including CVA variants should split layout logic into separate file

- **file:line** — `libs/ui/registry/ui/menu/menu-item.tsx:1-361`
- **What** — File exports 8 items: ItemState type, getItemState function, 4 CVA variant exports (menuItemBase, menuItemIndicator, menuItemLabel, menuItemValue), MenuItemProps interface, and MenuItem component. The component is 361 lines and includes internal layout components (MenuItemIndicator, MenuItemIconSlot, DefaultItemLayout, HubItemLayout).
- **Why** — A single file mixing variant definitions, layout components, and the public component is harder to navigate and grows past a reviewable size.
- **How** — Split into 3 files: (1) `menu-item-variants.ts` – exports menuItemBase, menuItemIndicator, menuItemLabel, menuItemValue CVAs + ItemState type + getItemState. (2) `menu-item-layouts.tsx` – exports DefaultItemLayout, HubItemLayout, MenuItemIndicator, MenuItemIconSlot as internal components. (3) `menu-item.tsx` – imports from both and exports MenuItem + MenuItemProps. Update imports in menu/index.ts …
- **Effort** — medium

### F214 — [NEW] [big-file-split] use-listbox.ts: 6 exported items (hook + internal helpers + types) should extract query utilities

- **file:line** — `libs/ui/registry/hooks/use-listbox.ts:1-436`
- **What** — File exports 6 items: ListboxMetadataItem type, UseListboxOptions interface, UseListboxReturn interface, getEncodedListboxItemId function, collectListboxItems function, and useListbox hook. The file is 436 lines and includes 10+ internal helper functions (hasDomItem, hasEnabledMetadataItem, hasMetadataItem, resolveActiveDescendant, getAccessibleText, getListboxOwnerSelector, isOwnedListboxItem, ge…
- **Why** — A 436-line file with the hook plus a dozen DOM/query helpers is hard to scan and review as one unit.
- **How** — Extract into `use-listbox-dom.ts`: hasDomItem, hasEnabledMetadataItem, hasMetadataItem, resolveActiveDescendant, getAccessibleText, getListboxOwnerSelector, isOwnedListboxItem, getListboxItems, getFirstNavigableItemId as internal exports. Keep public exports (ListboxMetadataItem, getEncodedListboxItemId, collectListboxItems) in a new `listbox-types.ts` or fold into `use-listbox.ts` but mark DOM he…
- **Effort** — medium

### F345 — [NEW] [object-args] buildFileTree function accepts 5 parameters with 3 defaults, borderline SRP

- **file:line** — `cli/server/src/features/review/context.ts:195-201`
- **What** — The async function buildFileTree(root, depth, baseRoot = root, visited = new Set(), counter = { count: 0, truncated: false }) has 5 parameters with 3 defaults. Call site at line 225 passes only baseRoot, visited, counter as closure-captured state for recursion.
- **Why** — Threading three defaulted recursion parameters positionally makes the call site hard to read and the inherited state implicit.
- **How** — Consider refactoring to split concerns: buildFileTree(root, depth, config) where config = { baseRoot?, visited?, counter? }. Alternatively, use a return value { nodes, truncated } instead of mutating counter. This is borderline; only refactor if the function is called from multiple places or if readability becomes a problem.
- **Effort** — medium
