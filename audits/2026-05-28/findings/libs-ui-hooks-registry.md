# Findings: `@diffgazer/ui` — Hooks & Registry

Domain audit of `libs/ui` registry hooks, UI primitives, package exports, and public registry handoff.

## Summary

| Severity | Count | Statuses |
| --- | --- | --- |
| Critical | 0 | — |
| High | 2 | NEW ×2 |
| Medium | 6 | NEW ×6 |
| Low | 7 | NEW ×7 |
| **Total** | **15** | **NEW ×15** |

---

## High

### F227 — [NEW] [error-handling] Missing dependency array on `useLayoutEffect` causes expensive subscription churn

- **File:** `libs/ui/registry/hooks/use-form-reset.ts:23`
- **What:** The first `useLayoutEffect` in `useFormReset` has no dependency array, causing it to run on every render. This repeatedly attaches and detaches form event listeners on every parent render.
- **Why:** Re-running the effect on every render re-establishes the form subscription each time, churning event listeners and undermining the reset subscription's reliability.
- **How:** Add dependency array `[enabled, ref]` to the `useLayoutEffect` at line 23 to match the pattern of the cleanup effect at line 45 which correctly uses `[]`. The minimal deps should track when the form subscription needs to be re-established.
- **Effort:** Low

### F229 — [NEW] [public-api] Package exports missing for two built and registry-declared hooks

- **File:** `libs/ui/package.json:19`
- **What:** The `package.json` exports map does not include entries for `./hooks/use-is-mobile` and `./hooks/typeahead-buffer`, even though both hooks are registered in `registry.json`, built into `dist/hooks/`, and have public `.d.ts` type declarations.
- **Why:** Package consumers cannot import these hooks despite them being built, typed, and registry-declared, breaking the complete-exports contract for the public handoff.
- **How:** Add two export entries to the `package.json` exports object matching the pattern of existing hook exports:
  - `"./hooks/use-is-mobile": { "types": "./dist/hooks/use-is-mobile.d.ts", "import": "./dist/hooks/use-is-mobile.js" }`
  - `"./hooks/typeahead-buffer": { "types": "./dist/hooks/typeahead-buffer.d.ts", "import": "./dist/hooks/typeahead-buffer.js" }`
- **Effort:** Low

---

## Medium

### F11 — [NEW] [anti-slop] `useEffect` state-sync anti-pattern in Checkbox

- **File:** `libs/ui/registry/ui/checkbox/checkbox.tsx:137-139`
- **What:** `useEffect(() => { if (isChecked) setNativeInvalid(false); }, [isChecked])` is calling `setState` based on another state change.
- **Why:** Syncing derived state through an effect adds an extra render pass and obscures the actual relationship between checked state and native validity; the value can be derived directly during render.
- **How:** Replace the `useEffect` with a derived variable: `const resolvedNativeInvalid = nativeInvalid && !(isChecked || isIndeterminate)` and use it in the `aria-invalid` calculation. Only call `setNativeInvalid` in the `onInvalid` handler of the native input.
- **Effort:** Low

### F12 — [NEW] [anti-slop] `useEffect` state-sync anti-pattern in Switch

- **File:** `libs/ui/registry/ui/switch/switch.tsx:144-146`
- **What:** `useEffect(() => { if (isChecked) setNativeInvalid(false); }, [isChecked])` is calling `setState` based on another state change.
- **Why:** The invalid state is derivable during render; routing it through an effect causes redundant re-renders and hides the dependency between checked state and validity.
- **How:** Replace the `useEffect` with derived state in the `resolveAriaInvalid` calculation: compute the final invalid state as a boolean expression based on `ariaInvalid`, `nativeInvalid`, `required`, and `isChecked` during render. Only call `setNativeInvalid` in event handlers (`onInvalid`).
- **Effort:** Low

### F13 — [NEW] [anti-slop] `useEffect` side-effect dispatch in Radio

- **File:** `libs/ui/registry/ui/radio/radio.tsx:171-173`
- **What:** `useEffect(() => { if (isChecked) notifySameNameRadios(); }, [isChecked, notifySameNameRadios])` is dispatching a custom event side effect based on state change. This should be called from the event handler that changed the state.
- **Why:** Firing the notification from an effect decouples it from the user action that caused the change, risking extra dispatches on unrelated re-renders and making the notification timing implicit rather than synchronous with the state change.
- **How:** Move the `notifySameNameRadios()` call into the `toggle()` function (line 178) after `setIsChecked(true)`. This ensures notifications happen synchronously with the state change that triggered them.
- **Effort:** Low

### F115 — [NEW] [public-api] Missing `DialogKeyboardHints` component export from Dialog index

- **File:** `libs/ui/registry/ui/dialog/index.ts:1-40`
- **What:** `DialogKeyboardHints` component is exported from `dialog-footer.ts` and is part of the `Dialog.Footer` compound component, but is NOT exported from the main `dialog/index.ts`. Only the types (`DialogKeyboardHintsProps`, `KeyboardHint`) are exported.
- **Why:** Consumers can reference the component's types but cannot import the component itself from the package entry point, breaking the compound-component public contract.
- **How:** Add `import { DialogKeyboardHints } from "./dialog-keyboard-hints";` (it's already imported in `dialog-footer`), and add `export { DialogKeyboardHints };` to line 40 alongside the types export.
- **Effort:** Low

### F116 — [NEW] [object-args] Positional parameter overload: multiple functions have 6+ positional parameters

- **File:** `libs/ui/registry/hooks/use-floating-position.ts:51-106, 108-134, 123-134, 136-161`
- **What:** Functions `computePosition` (6 params), `wouldOverflow` (5 params), `shift` (5 params), and `resolveCollisionPosition` (8 params) all use positional parameters. These are exported public utilities called from within the hook and passed positional arguments throughout.
- **Why:** Long positional argument lists are error-prone (easy to transpose arguments) and hard to read at call sites, especially for an exported public utility surface.
- **How:** Refactor each function to accept a single options object parameter. E.g., `computePosition({ triggerRect, contentRect, side, align, sideOffset, alignOffset })` instead of positional args. Update all call sites (lines 153-159, 247-251).
- **Effort:** Medium

### F228 — [NEW] [anti-slop] Inconsistent callback invocation pattern in `usePresence` exit flow

- **File:** `libs/ui/registry/hooks/use-presence.ts:59`
- **What:** The hook defines a `notifyExit` `useEffectEvent` at line 41-43 that wraps `onExitComplete?.()`, but the local `commitExit()` function at line 56-60 calls `onExitComplete?.()` directly, duplicating the invocation pattern.
- **Why:** Two parallel invocation paths for the same notification risk divergence (e.g., stale-closure handling provided by `useEffectEvent` is bypassed in the direct call) and make the exit-notification logic harder to reason about.
- **How:** Refactor `commitExit()` to call `notifyExit()` instead of directly invoking `onExitComplete?.()`. This centralizes the exit notification: `function commitExit() { if (phase !== 'closing') return; setPhase('hidden'); notifyExit(); }`
- **Effort:** Low

---

## Low

### F14 — [NEW] [big-file-split] Large file: `select-content.tsx` exceeds recommended size

- **File:** `libs/ui/registry/ui/select/select-content.tsx:1-359`
- **What:** `select-content.tsx` is 358 lines, with multiple responsibilities: listbox navigation, typeahead, search handling, and dropdown positioning logic.
- **Why:** A single file mixing several distinct concerns is harder to navigate, test, and maintain, and obscures the boundaries between navigation, search, and positioning behavior.
- **How:** Extract search/typeahead logic into a custom hook (`useSelectTypeahead`). Extract visible option filtering into a utility (`getVisibleEnabledOptions`). Extract the `SearchableContent` sub-component into its own file. Aim for a 200-line target.
- **Effort:** Medium

### F15 — [NEW] [big-file-split] Large file: `menu-item.tsx` exceeds recommended size

- **File:** `libs/ui/registry/ui/menu/menu-item.tsx:1-361`
- **What:** `menu-item.tsx` is 361 lines with multiple layout variants (`DefaultItemLayout`, `HubItemLayout`, `MenuItemIconSlot`) and a state machine (`ItemState`) in the same file.
- **Why:** Bundling several layout components and the item state machine in one file inflates its size and couples otherwise independent concerns.
- **How:** Extract `DefaultItemLayout` and `HubItemLayout` into separate functions in a layouts file. Extract `MenuItemIconSlot` into its own file or utility. Keep `MenuItem` and `getItemState` in `menu-item.tsx`. Target <250 lines per file.
- **Effort:** Medium

### F16 — [NEW] [big-file-split] Large file: `use-floating-position.ts` exceeds recommended size

- **File:** `libs/ui/registry/hooks/use-floating-position.ts:1-306`
- **What:** `use-floating-position.ts` is 306 lines with multiple concerns: position computation, collision detection, CSS edge mapping, and layout math.
- **Why:** Mixing pure layout math with hook lifecycle logic makes the math harder to unit-test in isolation and the file harder to reason about.
- **How:** Extract `computePosition` into a pure math utility (`compute-floating-position.ts`). Extract `OPPOSITE_SIDE` and `CROSS_AXIS_SIDES` mappings into a constants file. Keep the hook and hook-specific logic in `use-floating-position.ts`. Add unit tests for the math utility.
- **Effort:** Medium

### F17 — [NEW] [big-file-split] Large file: `use-listbox.ts` exceeds recommended size

- **File:** `libs/ui/registry/hooks/use-listbox.ts:1-436`
- **What:** `use-listbox.ts` is 436 lines with multiple responsibilities: item collection, DOM querying, metadata resolution, typeahead, and active descendant logic.
- **Why:** A 436-line hook combining DOM querying, metadata resolution, and typeahead is difficult to navigate and test, and the distinct utilities are reusable in isolation.
- **How:** Extract DOM query utilities into `use-listbox-dom.ts` (`hasDomItem`, `getListboxItems`, `getListboxOwnerSelector`, `isOwnedListboxItem`, `getFirstNavigableItemId`). Extract metadata helpers into `use-listbox-metadata.ts`. Keep the main hook at ~200 lines.
- **Effort:** Medium

### F117 — [NEW] [error-handling] `internalRef` not synchronized with state in `useControllableState`

- **File:** `libs/ui/registry/hooks/use-controllable-state.ts:18-40`
- **What:** The `internalRef` is initialized with the `defaultValue` but never explicitly synced after internal state changes via `useLayoutEffect`. While the current callback pattern (write ref, then `setState`) works, the ref can become stale if the hook is refactored.
- **Why:** The ref's correctness currently depends on every state mutation also writing the ref by hand; a future refactor that updates state without that manual write would silently desync the ref.
- **How:** Add `useLayoutEffect` to sync the ref after state updates: `useLayoutEffect(() => { internalRef.current = internal; }, [internal]);`
- **Effort:** Low

### F118 — [NEW] [docs] Memoization comment in `useIsMobile` lacks explicit concurrent-safety explanation

- **File:** `libs/ui/registry/hooks/use-is-mobile.ts:14-15`
- **What:** The comment on lines 14-15 explains that `useMemo` prevents listener reattachment, but does not explicitly explain WHY this matters (React 19 concurrent rendering safety).
- **Why:** Without the rationale, a future reader may judge the `useMemo` as defensive and remove it, reintroducing a subscription bug under concurrent rendering.
- **How:** Expand comment to: "Memoize to prevent listener detachment and re-attachment on every parent render, which breaks subscriptions under React 19 concurrent rendering. Without memoization, `useSyncExternalStore` would re-subscribe each render, losing state synchronization."
- **Effort:** Low

### F119 — [NEW] [handoff] No build-time validation prevents relative `.js` imports in public keys registry

- **File:** `libs/ui/scripts/transform-public-registry-keys-imports.ts:55-70`
- **What:** `AGENTS.md` line 111 requires "Public `libs/keys/public/r` TypeScript content must not emit relative `.js` import specifiers". The `stripRelativeJsExtensions` function removes them during the UI build, but the `libs/keys` build has no corresponding validation to catch the problem at source.
- **Why:** The contract is enforced only as a downstream cleanup in the UI build; a regression in `libs/keys` source would not fail its own build, leaving copy/shadcn consumers exposed to broken `.js` specifiers.
- **How:** Add validation in `libs/keys` build scripts to assert no generated `registry.json` or `public/r/*.json` files contain content with `from "` patterns ending in `.js` (except intentional external imports).
- **Effort:** Medium
