# Agent 01: Keys Focus Primitives

Ownership:

- `libs/keys/src/hooks/use-navigation.ts`
- new focused files under `libs/keys/src/utils/` or `libs/keys/src/internal/`
- `libs/keys/src/index.ts`
- adjacent `libs/keys/src/**/*.test.ts(x)`
- handoff notes for docs/registry to Agent 05

You are not alone in the codebase. Do not modify web components or UI registry components except for a tiny compile fix directly caused by your exported API.

## Goal

Make `@diffgazer/keys` own reusable, domain-neutral focus/navigation mechanics so `apps/web` and `libs/ui` can stop duplicating DOM lookup, focus restore, and boundary behavior.

## Tasks

1. Extract navigation item DOM utilities from `use-navigation`.
   - Current source: `libs/keys/src/hooks/use-navigation.ts`
   - Existing internal logic includes data contract selectors, native fallback selectors, owner scoping, disabled filtering, focused-descendant lookup, and boundary movement.
   - Move this into a neutral utility module such as `libs/keys/src/utils/navigation-items.ts`.

2. Proposed public API:

   ```ts
   export const NAVIGATION_ITEM_ATTRIBUTE = "data-diffgazer-navigation-item";

   export type NavigationItemType =
     | "radio"
     | "checkbox"
     | "option"
     | "menuitem"
     | "menuitemradio"
     | "button"
     | "tab";

   export interface NavigationItemQuery {
     type: NavigationItemType;
     skipDisabled?: boolean;
     scopeToContainer?: boolean;
     ownerSelector?: string | null;
   }

   export function getNavigationItems(
     container: HTMLElement | null,
     query: NavigationItemQuery,
   ): HTMLElement[];

   export function findNavigationItemByValue(
     container: HTMLElement | null,
     query: NavigationItemQuery & { value: string },
   ): HTMLElement | null;

   export function getNavigationItemProps(
     type: NavigationItemType,
     value: string,
   ): {
     "data-diffgazer-navigation-item": NavigationItemType;
     "data-value": string;
   };

   export function getFocusedNavigationValue(
     container: HTMLElement | null,
     query: NavigationItemQuery,
   ): string | null;

   export function focusNavigationItem(
     container: HTMLElement | null,
     query: NavigationItemQuery & {
       value: string;
       fallback?: "first" | "last" | "none";
       preventScroll?: boolean;
     },
   ): string | null;

   export function containsActiveElement(element: HTMLElement): boolean;

   export function getFocusableElements(container: HTMLElement | null): HTMLElement[];
   ```

   Keep names role-adjacent but data-contract-first. Do not add product terms.

3. Refactor `useNavigation` to consume these utilities.
   - Preserve public `UseNavigationOptions` unless a narrow rename is necessary.
   - Keep `onNavigationBoundaryReached("previous" | "next")`.
   - Preserve disabled filtering and owner scoping.
   - Keep empty-string `data-value=""` support if it currently works.

4. Add focus restore primitive only if it can stay small and stack-safe.
   - Problem: `Dialog` and `CommandPalette` duplicate previous-focus handling.
   - Additional current consumers: `Popover`, `Select`, and `useFocusTrap`.
   - Candidate API:

     ```ts
     export function getRestorableFocusTarget(document?: Document): HTMLElement | null;

     export function restoreFocus(
       target: HTMLElement | null,
       options?: { preventScroll?: boolean },
     ): boolean;

     export function useFocusRestore(options?: {
       enabled?: boolean;
       restoreOnUnmount?: boolean;
       preventScroll?: boolean;
       fallback?: HTMLElement | null;
     }): {
       capture: () => HTMLElement | null;
       restore: () => boolean;
       target: HTMLElement | null;
     };
     ```

   - Avoid a broad overlay manager. A small stack is acceptable only to prevent nested overlays from restoring the wrong target.
   - If focus restore proves coupled to UI overlay lifecycle, leave a handoff note for Agent 02 instead of overbuilding.

5. Do not build `useActionRowNavigation` yet unless implementation proves it removes repeated generic code immediately.
   - First try to make existing `useNavigation({ role: "button" })` plus new utilities sufficient.
   - If a hook is needed, it must be generic and index/value-based, not footer-specific.
   - Candidate names are `useRovingFocusGroup` or `useActionRow`, but these are P2 unless web adoption shows repeated generic boilerplate remains.

6. Improve `useFocusZone` only if needed for real focus handoff.
   - Current `tabCycle` can change zone state without moving DOM focus.
   - Do not change public behavior silently.
   - If implemented, add explicit `tabBehavior: "state-only" | "focus-target" | "native"` and registered zone focus targets.
   - Otherwise document current behavior and keep app workflows local.

## Tests

Add or update keys tests for:

- data contract selectors: `data-diffgazer-navigation-item`, `data-navigation-item`, `data-value`
- native buttons, radios, and checkboxes with `data-value`
- `[role]` selectors with `data-value`
- disabled exclusion through `aria-disabled`, `data-disabled`, and native `disabled`
- owner scoping for nested listbox/menu/radiogroup/tablist
- `ownerSelector: null` behavior
- empty string values
- focused descendant lookup
- focus-by-value fallback behavior
- boundary behavior still works in `useNavigation`
- unsafe `data-value` strings are not interpolated into selectors unsafely
- nested focus restore restores only the top overlay target

Prefer user-visible focus/value behavior over internal selector assertions.

## Do Not Move To Keys

- app workflow zones, route navigation, footer hints, slash-search behavior, trust save/revoke behavior, provider/model/review state machines
- UI widget roles beyond neutral querying and navigation mechanics
- product names or core schemas

## Validation

- `pnpm --filter @diffgazer/keys test`
- `pnpm --filter @diffgazer/keys type-check`
- `pnpm --filter @diffgazer/keys validate:registry`
- `pnpm --filter @diffgazer/keys verify:rsc`
