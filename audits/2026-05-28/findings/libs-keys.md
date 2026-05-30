# libs/keys — Audit Findings (2026-05-28)

Package: `@diffgazer/keys`

## Summary

| Severity | Count | Status |
| --- | --- | --- |
| Critical | 0 | — |
| High | 0 | — |
| Medium | 6 | NEW (6) |
| Low | 6 | NEW (6) |
| **Total** | **12** | **NEW (12)** |

---

## Medium

### F6 — [NEW] [performance] Object and callback creation on every render in useActionRowNavigation

- **File:** `libs/keys/src/hooks/use-action-row-navigation.ts:282-293`
- **What:** `getActionProps()` creates a new object with new callback functions (ref callback and `onFocus`) on every render, even when dependencies haven't changed.
- **Why:** Recreating callbacks and the props object on every render breaks referential stability for consumers, which can cause unnecessary re-renders and effect re-runs downstream.
- **How:** Wrap `getActionProps` in `useCallback` with appropriate dependencies, or refactor to a factory that creates stable closures. Example: `const getActionProps = useCallback((index: number) => ({ ... }), [actionCount, disabledKey, setZone, setFocusedIndex])` — or if index-dependent logic is complex, consider using a ref-based registry pattern.
- **Effort:** medium

### F7 — [NEW] [performance] Object creation on every render in useFocusZone return value

- **File:** `libs/keys/src/hooks/use-focus-zone.ts:255-267`
- **What:** `getKeyOptions`, `getZoneProps`, and `isZone` are created as new functions on every render, even when dependencies (`safeZone`, `enabled`, etc.) are stable.
- **Why:** New function identities each render undermine referential stability for consumers and any memoization that depends on these returned helpers.
- **How:** Wrap each function in `useCallback`: `const getKeyOptions = useCallback((zone: T, extra?: UseKeyOptions) => ({ ... }), [containerRef, focusWithinOnly, allowInInput, preventDefault, scope, enabled, safeZone])`. Alternatively, move to a `useMemo`'d object containing all three if they're always used together.
- **Effort:** medium

### F109 — [NEW] [error-handling] Empty catch block in restoreFocus lacks documentation

- **File:** `libs/keys/src/dom/focus-restore.ts:31-32`
- **What:** The try-catch block catches errors from `target.focus({ preventScroll })` but has no comment explaining why this fallback is safe or what errors are expected.
- **Why:** An undocumented swallowed error makes it unclear to future maintainers whether the fallback is intentional degradation or an accidental silenced bug.
- **How:** Add a comment explaining that `preventScroll` may throw in older browsers or certain contexts, and that the fallback to `target.focus()` without options is acceptable as a degradation path.
- **Effort:** low

### F217 — [NEW] [performance] Defensive useMemo wrapping already-stable context values

- **File:** `libs/keys/src/context/keyboard-context.ts:34, 41-44`
- **What:** `useKeyboardContext()` and `useOptionalKeyboardContext()` wrap their return values in `useMemo`, combining two context values that are already memoized by the provider. This adds memoization overhead without necessity.
- **Why:** Memoizing values that are already stable adds bookkeeping cost and code noise without a measured performance benefit.
- **How:** Remove the `useMemo` wrappers and return the combined object directly. The context values are already stable.
- **Effort:** low

### F218 — [NEW] [performance] useKey hook generates new registrationVersion string on every render

- **File:** `libs/keys/src/hooks/use-key.ts:59-60`
- **What:** The `registrationVersion` is computed fresh from `handlerMap` on every render (lines 59-60) via `Object.keys().map().join()`, creating a new string each time, which is included as a dependency in `useLayoutEffect` (line 94). This causes the effect to re-run on every render even if the keys haven't changed.
- **Why:** Recomputing a fresh value used as an effect dependency forces the layout effect to re-run on every render, doing redundant registration work even when the keys are unchanged.
- **How:** Memoize the `registrationVersion` string using `useMemo` to ensure it only changes when `handlerMap` keys actually change. Or use a different approach: hash the sorted keys or store them in a ref and compare identity.
- **Effort:** medium

### F219 — [NEW] [performance] useCallbacks in useNavigation depend on unstable consumer callbacks

- **File:** `libs/keys/src/hooks/use-navigation.ts:174`
- **What:** The `move()` callback at line 174 includes `onNavigationBoundaryReached` in its dependency array. This callback comes from `UseNavigationOptions` and is typically passed as an inline arrow function from consumers, making it unstable across renders.
- **Why:** Depending on an inline consumer callback means `move()` is recreated on every render, defeating the purpose of the `useCallback` and propagating instability to anything that depends on `move`.
- **How:** Consider storing the callback in a ref (via `useLayoutEffect`) and reading it from the ref, or require consumers to memoize their callbacks. Alternatively, use a stable dispatch pattern like `useEffectEvent` for non-prop handlers.
- **Effort:** medium

---

## Low

### F1 — [NEW] [reusability] Defensive useMemo without profiler justification in context hook

- **File:** `libs/keys/src/context/keyboard-context.ts:34`
- **What:** `useKeyboardContext` creates a new memoized object every render with `[...registry]` spread operator, memoizing the result without documented performance issue.
- **Why:** Adding `useMemo` without a measured performance need is defensive overhead that obscures intent and adds maintenance cost.
- **How:** Remove `useMemo` and return the plain object directly: `return { activeScope: scope.activeScope, ...registry }`. Let React's component render-time memoization handle context consumers. If memoization proves necessary after profiling, add it back with clear comments.
- **Effort:** low

### F2 — [NEW] [reusability] Defensive useMemo without profiler justification in context hook (optional variant)

- **File:** `libs/keys/src/context/keyboard-context.ts:41-44`
- **What:** `useOptionalKeyboardContext` creates a memoized object with conditional logic, memoizing without documented performance issue.
- **Why:** Same defensive memoization concern as the non-optional variant — extra complexity without a measured benefit.
- **How:** Remove `useMemo` and return the plain conditional object. If profiling later shows this needs memoization, add it back with justification.
- **Effort:** low

### F3 — [NEW] [reusability] Defensive useMemo in provider context values

- **File:** `libs/keys/src/providers/keyboard-provider.tsx:220-228`
- **What:** `KeyboardProvider` wraps context values (`registryValue`, `scopeValue`) in `useMemo` without documented performance justification.
- **Why:** Memoizing provider values without a profiled need adds indirection and noise without confirmed benefit.
- **How:** Remove `useMemo` wrapping and provide values directly: `<KeyboardRegistryContext.Provider value={{ getActiveScope, getScopeForOrder, pushScope, register }}>`. If profiling shows memo is needed, add back with comments explaining the perf issue.
- **Effort:** low

### F4 — [NEW] [public-api] Re-export of external function without semantic clarity

- **File:** `libs/keys/src/dom/navigation-items.ts:196`
- **What:** `getFocusableElements` is imported as `getFocusableElementsImpl` from `focusable.ts` and re-exported without wrapping or comment explaining why it's available from both modules.
- **Why:** Exposing the same function from two modules without explanation muddies the public API surface and leaves consumers unsure which import path is canonical.
- **How:** Either: (1) Keep the re-export only from `navigation-items.ts` (if it's the primary API) and update `focusable.ts` to export it as well for direct access, OR (2) Remove the re-export from `navigation-items` and document that consumers should import from `focusable.ts` directly. Choose based on intended public API surface.
- **Effort:** low

### F5 — [NEW] [type-safety] Type assertion without explanation (trivial case but notable pattern)

- **File:** `libs/keys/src/hooks/use-action-row-navigation.ts:287`
- **What:** `data-action-index` prop is cast with `as number` even though the value is already type-narrowed as `ActionRowIndex<Actions>`.
- **Why:** An unnecessary type assertion suppresses the type system needlessly and signals a pattern that can hide real type mismatches elsewhere.
- **How:** Remove the `as number` cast: `"data-action-index": index,`. The type is already correct and TypeScript will not complain.
- **Effort:** low

### F220 — [NEW] [type-safety] Type cast needed for DOM data-value boundary crossing

- **File:** `libs/keys/src/hooks/use-navigation.ts:136, 157`
- **What:** Lines 136 and 157 cast `data-value` from the DOM (a string) to `TValue` using `as TValue`. While documented in comments, this is a type boundary that bypasses type safety.
- **Why:** The cast crosses a real DOM-to-typed-value boundary; it is documented and expected, so it carries low risk, but it remains an unchecked conversion.
- **How:** This is acceptable as-is since it's a known DOM boundary and documented. No action needed unless you want to introduce a validation layer or stricter bounds.
- **Effort:** low
