# @stargazer/keyboard Package Audit

**Date:** 2026-02-07
**Scope:** 10 hook files, 2 utility files, 1 provider, 1 test file (~400 LOC total)
**Goal:** Design keyboard navigation as a SEPARATE package from @stargazer/ui

---

## 1. Executive Summary

The existing UI library audit (`ui-library-audit.md`) incorrectly bundles the keyboard system into `@stargazer/ui`. This audit corrects that by designing `@stargazer/keyboard` as a standalone, independently distributable package.

The keyboard system is a **scope-based hotkey manager** (~400 LOC) with zero UI dependencies. It manages a scope stack and handler registry via React context, dispatching keyboard events only to handlers registered in the currently active scope. This is conceptually closer to `react-hotkeys-hook` or `tinykeys` than to Radix's built-in keyboard handling.

**Key finding:** The keyboard system has ZERO dependencies on any UI component, styling, or design token. It is pure React logic. Extracting it as a separate package is straightforward -- import path changes only.

**Recommendation:** **Option A (peer dependency)** -- UI components import `@stargazer/keyboard` as a peer dependency. This is the simplest path, matches the current architecture, and keeps the keyboard system independently useful.

---

## 2. Current File Inventory

### Source Files

| File | Location | LOC | Role |
|------|----------|-----|------|
| `keyboard-utils.ts` | `app/providers/` | 37 | Pure functions: `matchesHotkey()`, `isInputElement()` |
| `keyboard-provider.tsx` | `app/providers/` | 80 | `KeyboardProvider` + `KeyboardContext` -- scope stack + handler registry |
| `use-keyboard-context.ts` | `hooks/keyboard/` | 14 | Context consumer hook |
| `use-key.ts` | `hooks/keyboard/` | 23 | Register single hotkey in active scope |
| `use-keys.ts` | `hooks/keyboard/` | 29 | Register multiple hotkeys in active scope |
| `use-scope.ts` | `hooks/keyboard/` | 16 | Push/pop keyboard scope |
| `use-group-navigation.ts` | `hooks/keyboard/` | 142 | DOM-based arrow key navigation for compound components |
| `use-selectable-list.ts` | `hooks/keyboard/` | 100 | Index-based list navigation (j/k + arrows) |
| `use-footer-navigation.ts` | `hooks/keyboard/` | 75 | Footer/toolbar keyboard nav (left/right between buttons) |
| `use-trust-form-keyboard.ts` | `hooks/keyboard/` | 62 | Form-specific zone navigation (list zone <-> buttons zone) |
| `index.ts` | `hooks/keyboard/` | 8 | Barrel export |

### Test Files

| File | Location |
|------|----------|
| `keyboard-utils.test.ts` | `app/providers/` |
| `keyboard-provider.test.tsx` | `app/providers/` |

### Dependencies

The entire keyboard system depends on:
- `react` (useState, useEffect, useCallback, useMemo, useRef, useContext, createContext, useEffectEvent)
- Nothing else. Zero external dependencies.

---

## 3. Hook-by-Hook Analysis

### Layer 1: Core (brain of the system)

#### `matchesHotkey(event, hotkey)` -- keyboard-utils.ts
- **Signature:** `(event: KeyboardEvent, hotkey: string) => boolean`
- **What it does:** Parses hotkey strings like `"ctrl+shift+a"`, `"ArrowUp"`, `"Escape"` and matches against a KeyboardEvent. Supports modifier combos (ctrl, meta, shift, alt) and aliases (up/down/left/right/esc/space).
- **Dependencies:** None (pure function)

#### `isInputElement(target)` -- keyboard-utils.ts
- **Signature:** `(target: EventTarget | null) => boolean`
- **What it does:** Returns true if target is input, textarea, select, or contentEditable element. Used to suppress hotkeys when user is typing.
- **Dependencies:** None (pure function)

#### `KeyboardProvider` -- keyboard-provider.tsx
- **Signature:** `({ children }: { children: ReactNode }) => JSX.Element`
- **What it does:** Manages a scope stack (initialized with `["global"]`) and a handler registry (`Map<scope, Map<hotkey, HandlerEntry>>`). Attaches a single `window.addEventListener("keydown")` listener that dispatches to handlers in the active (topmost) scope only. Scopes are push/pop -- when a Dialog opens and pushes `"dialog"` scope, only dialog handlers fire. When it unmounts and pops, the previous scope becomes active again.
- **Exports:** `KeyboardContext` (React context)
- **Dependencies:** `keyboard-utils.ts` (matchesHotkey, isInputElement)

#### `useKeyboardContext()` -- use-keyboard-context.ts
- **Signature:** `() => KeyboardContextValue`
- **Returns:** `{ activeScope: string | null, pushScope: (scope) => cleanup, register: (scope, hotkey, handler, options?) => cleanup }`
- **What it does:** Consumes `KeyboardContext`, throws if used outside provider.
- **Dependencies:** `KeyboardContext` from keyboard-provider

#### `useKey(hotkey, handler, options?)` -- use-key.ts
- **Signature:** `(hotkey: string, handler: () => void, options?: { enabled?: boolean, allowInInput?: boolean }) => void`
- **What it does:** Registers a single hotkey handler in the active scope. Auto-cleans up on unmount or when deps change. Uses `useEffectEvent` for stable handler reference.
- **Dependencies:** `useKeyboardContext`

#### `useKeys(keys, handler, options?)` -- use-keys.ts
- **Signature:** `(keys: readonly string[], handler: (key: string, index: number) => void, options?: { enabled?: boolean }) => void`
- **What it does:** Registers multiple hotkeys that call the same handler with the matched key and its index. Used for number-key jump (`["1","2","3"..."9"]`).
- **Dependencies:** `useKeyboardContext`

#### `useScope(name, options?)` -- use-scope.ts
- **Signature:** `(name: string, options?: { enabled?: boolean }) => void`
- **What it does:** Pushes a named scope onto the stack when mounted/enabled, pops on unmount/disable. This is what makes Dialog/Menu keyboard isolation work.
- **Dependencies:** `useKeyboardContext`

### Layer 2: Navigation Primitives

#### `useGroupNavigation(options)` -- use-group-navigation.ts
- **Signature:** `(options: UseGroupNavigationOptions) => UseGroupNavigationReturn`
- **Params:**
  - `containerRef: RefObject<HTMLElement>` -- DOM container to query
  - `role: "radio" | "checkbox" | "option" | "menuitem"` -- ARIA role to match
  - `value?: string | null` -- controlled focus value
  - `onValueChange?: (value: string) => void` -- controlled callback
  - `onSelect?: (value: string) => void` -- uncontrolled select
  - `onEnter?: (value: string) => void` -- Enter key handler
  - `onFocusChange?: (value: string) => void` -- uncontrolled focus callback
  - `wrap?: boolean` (default true)
  - `enabled?: boolean` (default true)
  - `onBoundaryReached?: (direction) => void`
  - `initialValue?: string | null`
- **Returns:** `{ focusedValue: string | null, isFocused: (value: string) => boolean, focus: (value: string) => void }`
- **What it does:** DOM-based keyboard navigation. Queries container for `[role="<role>"]:not([aria-disabled="true"])` elements, reads `data-value` attributes, moves focus with ArrowUp/ArrowDown, selects with Enter/Space. Supports controlled and uncontrolled modes. Scrolls focused element into view.
- **Dependencies:** `useKey`
- **Used by:** NavigationList, CheckboxGroup, RadioGroup, timeline-list (feature)

#### `useSelectableList(options)` -- use-selectable-list.ts
- **Signature:** `(options: UseSelectableListOptions) => UseSelectableListReturn`
- **Params:**
  - `itemCount: number`
  - `getDisabled?: (index: number) => boolean`
  - `wrap?: boolean` (default true)
  - `onBoundaryReached?: (direction) => void`
  - `onFocus?: (index: number) => void`
  - `enabled?: boolean` (default true)
  - `initialIndex?: number` (default 0)
  - `upKeys?: readonly string[]` (default `["ArrowUp", "k"]`)
  - `downKeys?: readonly string[]` (default `["ArrowDown", "j"]`)
- **Returns:** `{ focusedIndex: number, setFocusedIndex: (index: number) => void }`
- **What it does:** Index-based navigation (no DOM queries). Moves focus index up/down with configurable keys, skips disabled items, wraps or reports boundary. Uses pending-callback pattern to fire onFocus after state settles.
- **Dependencies:** `useKeys`
- **Used by:** use-review-results-keyboard (feature)

#### `useFooterNavigation(options)` -- use-footer-navigation.ts
- **Signature:** `(options: UseFooterNavigationOptions) => UseFooterNavigationReturn`
- **Params:**
  - `enabled: boolean`
  - `buttonCount: number`
  - `onAction: (index: number) => void`
- **Returns:** `{ inFooter: boolean, focusedIndex: number, setFocusedIndex, enterFooter, exitFooter, reset }`
- **What it does:** Manages a footer/toolbar navigation zone. ArrowLeft/Right to move between buttons, ArrowUp to exit footer, Enter/Space to activate. Designed as a composable "zone" that integrates with other keyboard hooks.
- **Dependencies:** `useKey`
- **Used by:** diagnostics/page (feature)

### Layer 3: Composite (App-Specific)

#### `useTrustFormKeyboard(options)` -- use-trust-form-keyboard.ts
- **Signature:** `(options: UseTrustFormKeyboardOptions) => void`
- **Params:**
  - `enabled?: boolean`
  - `focusZone: "list" | "buttons"`
  - `buttonIndex: number`
  - `buttonsCount: number`
  - `onButtonIndexChange: (index: number) => void`
  - `onFocusZoneChange: (zone) => void`
  - `onSave?: () => void`
  - `onRevoke?: () => void`
- **What it does:** Wires ArrowLeft/Right/Up for button zone navigation, Enter/Space for save/revoke actions. Pure composition of `useKey` calls with form-specific logic (hardcoded button indices 0=save, 1=revoke).
- **Dependencies:** `useKey`
- **Used by:** TrustPermissionsContent (shared component)

---

## 4. Import Map -- Who Uses What

### UI Components (would be in @stargazer/ui)

| Component | File | Hooks Used | How Used |
|-----------|------|------------|----------|
| **Dialog** | `ui/dialog/dialog.tsx` | `useScope`, `useKey` | Scope isolation when open, Escape to close |
| **Menu** | `ui/menu/menu.tsx` | `useKey`, `useKeys` | ArrowUp/Down navigation, Enter to activate, number-key jump |
| **NavigationList** | `ui/navigation-list/navigation-list.tsx` | `useGroupNavigation` | DOM-based arrow key navigation |
| **CheckboxGroup** | `ui/form/checkbox.tsx` | `useGroupNavigation` | DOM-based arrow key navigation for checkbox items |
| **RadioGroup** | `ui/form/radio-group.tsx` | `useGroupNavigation` | DOM-based arrow key navigation for radio items |
| **TrustPermissionsContent** | `shared/trust-permissions-content.tsx` | `useTrustFormKeyboard` | Form zone navigation (list <-> buttons) |

### Feature/App Code (stays in app)

| Feature | File | Hooks Used |
|---------|------|------------|
| Home page | `features/home/components/page.tsx` | `useKey`, `useScope` |
| History keyboard | `features/history/hooks/use-history-keyboard.ts` | `useScope`, `useKey` |
| History timeline | `features/history/components/timeline-list.tsx` | `useGroupNavigation` |
| Review results | `features/review/hooks/use-review-results-keyboard.ts` | `useScope`, `useKey`, `useSelectableList` |
| Review progress | `features/review/hooks/use-review-progress-keyboard.ts` | `useScope`, `useKey` |
| Review summary | `features/review/components/review-summary-view.tsx` | `useScope`, `useKey` |
| No changes view | `features/review/components/no-changes-view.tsx` | `useScope`, `useKey` |
| API key missing | `features/review/components/api-key-missing-view.tsx` | `useScope`, `useKey` |
| Providers keyboard | `features/providers/hooks/use-providers-keyboard.ts` | `useKey` |
| Model dialog keyboard | `features/providers/hooks/use-model-dialog-keyboard.ts` | `useKey` |
| API key dialog | `features/providers/components/api-key-dialog/api-key-dialog.tsx` | `useKey` |
| Settings hub | `features/settings/components/hub/page.tsx` | `useScope`, `useKey` |
| Settings diagnostics | `features/settings/components/diagnostics/page.tsx` | `useKey`, `useFooterNavigation` |
| Settings theme | `features/settings/components/theme/page.tsx` | `useKey` |
| Settings analysis | `features/settings/components/analysis/page.tsx` | `useKey` |
| Settings storage | `features/settings/components/storage/page.tsx` | `useKey` |
| Settings trust | `features/settings/components/trust-permissions/page.tsx` | `useKey` |

---

## 5. Comparison with Existing Libraries

| Library | Approach | Keyboard Separate? | Notes |
|---------|----------|---------------------|-------|
| **Radix UI** | Built into each component | NO | Each primitive has its own keyboard handling baked in. No shared keyboard system. Components handle their own ArrowUp/Down/Escape internally. |
| **react-hotkeys-hook** | Standalone package | YES (it IS the package) | `useHotkeys("ctrl+k", handler)`. No scope system. No provider needed. |
| **tinykeys** | Standalone vanilla JS | YES | `tinykeys(window, { "ctrl+k": handler })`. No React. No scopes. |
| **cmdk** | Built into component | NO | Command palette with built-in keyboard nav. |
| **@stargazer/keyboard** | Scope-based system with provider | YES | Unique: scope stack isolates keyboard contexts (dialog > menu > page). Closest to react-hotkeys-hook but with scoping. |

**Stargazer's system is unique** in combining:
1. A scope stack (like a modal/focus-trap hierarchy for keyboard events)
2. React context-based registration (declarative, auto-cleanup)
3. Navigation primitives built on top (useGroupNavigation, useSelectableList)

This is more than a hotkey library but less than a full component library. It's a **keyboard interaction framework** -- the right scope for a standalone package.

---

## 6. Interface Contract Analysis

### Option A: UI components import @stargazer/keyboard as peer dependency

```typescript
// In @stargazer/ui package.json
{ "peerDependencies": { "@stargazer/keyboard": "^1.0.0" } }

// In Dialog component (inside @stargazer/ui)
import { useScope, useKey } from "@stargazer/keyboard";
```

**Pros:**
- Simplest migration -- change import paths, zero logic changes
- Current architecture already works this way (just different import paths)
- UI components get full keyboard integration out of the box
- Consumers who use @stargazer/ui get keyboard-enabled components automatically
- Keyboard package is independently useful (app pages use it directly too)

**Cons:**
- UI lib has a hard dependency on keyboard lib (peer dep, but still required)
- Can't use @stargazer/ui without @stargazer/keyboard

**Mitigation:** This is fine. The keyboard system IS the interaction model. Using these TUI components without keyboard navigation defeats their purpose.

### Option B: UI components accept keyboard behavior via props/callbacks

```typescript
// Dialog would NOT import keyboard hooks
// Consumer wires it up:
function MyDialog({ open, onOpenChange }) {
  useScope("dialog", { enabled: open });
  useKey("Escape", () => onOpenChange(false), { enabled: open });
  return <Dialog open={open} onOpenChange={onOpenChange}>...</Dialog>;
}
```

**Pros:**
- UI components are truly standalone with zero keyboard dependency
- Maximum flexibility -- consumers choose their own keyboard system

**Cons:**
- Much more complex consumer API -- every Dialog/Menu/NavigationList user must manually wire keyboard
- Breaks the TUI interaction model (keyboard IS the primary input)
- Duplicates keyboard wiring code across every consumer
- NavigationList/CheckboxGroup/RadioGroup would lose arrow key navigation entirely (their core value proposition)
- Components become barely usable without keyboard wiring

**Verdict:** Not viable. Too much burden on consumers. Keyboard is not optional for these components.

### Option C: Hybrid -- basic keyboard built-in, scope-based via peer dep

```typescript
// Dialog has built-in onKeyDown for Escape (no scope system needed)
// But if KeyboardProvider exists, it uses useScope for isolation

// NavigationList has built-in ArrowUp/Down via onKeyDown
// But uses useGroupNavigation (from keyboard pkg) if available
```

**Pros:**
- Components work standalone with basic keyboard
- Enhanced behavior when keyboard package is present

**Cons:**
- Two code paths per component (with/without keyboard package)
- Complex conditional logic
- Testing surface doubles
- Scope isolation only works with the keyboard package, creating inconsistent behavior
- NavigationList's DOM-based approach is cleaner than duplicating with onKeyDown

**Verdict:** Over-engineered. The complexity isn't justified when keyboard is the primary interaction model.

### RECOMMENDATION: Option A

**Use Option A (peer dependency).** The keyboard system is the defining interaction pattern of these TUI components. Making it optional would be like making a mouse optional for a GUI toolkit -- technically possible but architecturally wrong.

The peer dependency approach:
- Zero code changes to hooks or components (import paths only)
- Both packages are independently installable
- @stargazer/keyboard works without @stargazer/ui (for custom components)
- @stargazer/ui requires @stargazer/keyboard (correct -- TUI components need keyboard nav)
- Clean dependency graph: `@stargazer/ui -> peer: @stargazer/keyboard -> peer: react`

---

## 7. Hook Classification

### PACKAGE: belongs in @stargazer/keyboard

| Hook/Module | Reasoning |
|-------------|-----------|
| `keyboard-utils.ts` | Pure utility functions, zero dependencies, foundational |
| `keyboard-provider.tsx` | Core provider, manages scope stack + registry, foundational |
| `use-keyboard-context.ts` | Context consumer, required by all other hooks |
| `use-key.ts` | Core API -- single hotkey registration |
| `use-keys.ts` | Core API -- multi-hotkey registration |
| `use-scope.ts` | Core API -- scope management |
| `use-group-navigation.ts` | Navigation primitive -- used by 4+ components, generic (any ARIA role), no UI dependency |
| `use-selectable-list.ts` | Navigation primitive -- index-based, configurable keys, no UI dependency |
| `use-footer-navigation.ts` | Navigation primitive -- toolbar/footer zone pattern, generic, no UI dependency |

**Total: 9 modules (+ barrel index.ts)**

All 9 modules have:
- Zero UI/styling dependencies
- Zero external dependencies beyond React
- Generic, reusable APIs
- Clear use cases beyond Stargazer

### APP-SPECIFIC: stays in the app

| Hook | Reasoning |
|------|-----------|
| `use-trust-form-keyboard.ts` | Hardcoded to trust form semantics (save=index 0, revoke=index 1). Composed from `useKey` calls with domain-specific logic. Not reusable. |

**Why not `useFooterNavigation` instead?** `useFooterNavigation` is generic (any button count, any action callback). `useTrustFormKeyboard` is specific (exactly 2 buttons, save + revoke semantics). The generic version belongs in the package; the specific composition stays app-side.

### Borderline Cases

| Hook | Decision | Reasoning |
|------|----------|-----------|
| `use-footer-navigation.ts` | **PACKAGE** | Despite being used by only 1 feature currently, it's a generic toolbar navigation pattern with no domain coupling. Valuable as a building block. |
| `use-selectable-list.ts` | **PACKAGE** | Used by 1 feature, but it's a clean index-based navigation primitive with configurable keys. The complement to DOM-based `useGroupNavigation`. |

---

## 8. Package Design

### Package Structure

```
packages/keyboard/
  package.json
  tsconfig.json
  vitest.config.ts
  src/
    index.ts                    # Public barrel export
    keyboard-provider.tsx       # KeyboardProvider + KeyboardContext
    keyboard-utils.ts           # matchesHotkey(), isInputElement()
    keyboard-utils.test.ts      # Existing test (move from app/providers/)
    keyboard-provider.test.tsx  # Existing test (move from app/providers/)
    use-keyboard-context.ts     # Context consumer hook
    use-key.ts                  # Single hotkey registration
    use-keys.ts                 # Multi-hotkey registration
    use-scope.ts                # Scope push/pop
    use-group-navigation.ts     # DOM-based compound component navigation
    use-selectable-list.ts      # Index-based list navigation
    use-footer-navigation.ts    # Toolbar/footer zone navigation
```

### package.json

```json
{
  "name": "@stargazer/keyboard",
  "version": "0.0.1",
  "type": "module",
  "main": "src/index.ts",
  "types": "src/index.ts",
  "peerDependencies": {
    "react": "^19.0.0"
  },
  "devDependencies": {
    "react": "^19.0.0",
    "vitest": "^3.0.0"
  }
}
```

### Public API Surface

```typescript
// packages/keyboard/src/index.ts

// Provider (wrap app root)
export { KeyboardProvider, KeyboardContext } from "./keyboard-provider";

// Core hooks
export { useKey } from "./use-key";
export { useKeys } from "./use-keys";
export { useScope } from "./use-scope";
export { useKeyboardContext } from "./use-keyboard-context";

// Navigation primitives
export { useGroupNavigation } from "./use-group-navigation";
export { useSelectableList } from "./use-selectable-list";
export { useFooterNavigation } from "./use-footer-navigation";

// Utilities (for advanced consumers)
export { matchesHotkey, isInputElement } from "./keyboard-utils";

// Types
export type { UseGroupNavigationOptions, UseGroupNavigationReturn } from "./use-group-navigation";
export type { UseSelectableListOptions, UseSelectableListReturn } from "./use-selectable-list";
export type { UseFooterNavigationOptions } from "./use-footer-navigation";
```

### What is NOT exported

- `useTrustFormKeyboard` -- app-specific, stays in `apps/web/src/hooks/keyboard/` or moves to `features/settings/hooks/`
- Internal types (`HandlerEntry`, `HandlerMap`) -- implementation details

### Dependencies

```
@stargazer/keyboard
  peerDependencies:
    react: ^19.0.0
  dependencies: (none)
  devDependencies:
    react, vitest, @testing-library/react
```

Zero dependencies on:
- @stargazer/ui (no styling, no components)
- @stargazer/core (no Result type, no utilities)
- @stargazer/schemas (no validation schemas)
- tailwind, CVA, or any CSS tooling

---

## 9. Migration Strategy

### Phase 1: Create Package (no breaking changes)

1. Create `packages/keyboard/` directory with package.json, tsconfig.json
2. Copy (not move) all 9 modules + 2 test files into `packages/keyboard/src/`
3. Update internal import paths:
   - `use-keyboard-context.ts`: change `from "@/app/providers/keyboard-provider"` to `from "./keyboard-provider"`
   - `keyboard-provider.tsx`: change `from "@/app/providers/keyboard-utils"` to `from "./keyboard-utils"`
4. Create barrel `index.ts`
5. Verify tests pass: `pnpm --filter @stargazer/keyboard test`

### Phase 2: Update Consumers

Update all import paths. Zero logic changes.

**UI components (6 files):**

```typescript
// Before:
import { useScope, useKey } from '@/hooks/keyboard';
import { useGroupNavigation } from '@/hooks/keyboard';
import { useKey, useKeys } from "@/hooks/keyboard";

// After:
import { useScope, useKey } from '@stargazer/keyboard';
import { useGroupNavigation } from '@stargazer/keyboard';
import { useKey, useKeys } from "@stargazer/keyboard";
```

Files to update:
- `components/ui/dialog/dialog.tsx`
- `components/ui/menu/menu.tsx`
- `components/ui/navigation-list/navigation-list.tsx`
- `components/ui/form/checkbox.tsx`
- `components/ui/form/radio-group.tsx`
- `components/shared/trust-permissions-content.tsx`

**Feature/app code (17 files):**

Same import path change for all feature files listed in Section 4.

**Provider setup:**

```typescript
// Before (in app root):
import { KeyboardProvider } from "@/app/providers/keyboard-provider";

// After:
import { KeyboardProvider } from "@stargazer/keyboard";
```

### Phase 3: Clean Up

1. Delete old files:
   - `apps/web/src/hooks/keyboard/` (entire directory)
   - `apps/web/src/app/providers/keyboard-provider.tsx`
   - `apps/web/src/app/providers/keyboard-utils.ts`
   - `apps/web/src/app/providers/keyboard-provider.test.tsx`
   - `apps/web/src/app/providers/keyboard-utils.test.ts`
2. Move `use-trust-form-keyboard.ts` to `apps/web/src/features/settings/hooks/` (or keep in a local `hooks/` if shared component uses it)
3. Update `use-trust-form-keyboard.ts` import:
   ```typescript
   // Before:
   import { useKey } from "./use-key";
   // After:
   import { useKey } from "@stargazer/keyboard";
   ```

### Phase 4: Wire Up @stargazer/ui Peer Dependency

When `@stargazer/ui` package is created:

```json
// packages/ui/package.json
{
  "peerDependencies": {
    "react": "^19.0.0",
    "@stargazer/keyboard": "workspace:*"
  }
}
```

### Migration Checklist

| Step | Files Changed | Risk |
|------|---------------|------|
| Create package structure | 0 existing files | None |
| Copy modules | 0 existing files | None |
| Fix internal imports | 2 new files | Low (within new package) |
| Update UI component imports | 6 files | Low (import path only) |
| Update feature imports | 17 files | Low (import path only) |
| Update provider import | 1 file (app root) | Low |
| Delete old files | ~12 files | Medium (verify nothing references them) |
| Move trust-form-keyboard | 2 files | Low |

**Total effort:** ~30 minutes. Zero logic changes. Zero behavior changes.

---

## 10. Relationship to @stargazer/ui

### Dependency Graph

```
@stargazer/ui
  peerDeps: react, @stargazer/keyboard
  uses: useKey, useKeys, useScope, useGroupNavigation (in Dialog, Menu, NavigationList, Checkbox, RadioGroup)

@stargazer/keyboard
  peerDeps: react
  uses: nothing from @stargazer/ui

App (apps/web)
  deps: @stargazer/ui, @stargazer/keyboard
  uses: useKey, useScope, useSelectableList, useFooterNavigation (directly)
  uses: Dialog, Menu, NavigationList (from @stargazer/ui, which internally uses keyboard)
```

### What Changes in the UI Library Audit

The `ui-library-audit.md` Section 4 (Keyboard Navigation) and Section 2 (Library Architecture) need these corrections:

1. **Remove** `hooks/keyboard/` from the `packages/ui/` structure
2. **Remove** keyboard hooks from `@stargazer/ui` public API exports
3. **Add** `@stargazer/keyboard` as peer dependency of `@stargazer/ui`
4. **Update** consumer setup example:

```tsx
// Before (from ui-library-audit.md):
import { KeyboardProvider } from "@stargazer/ui";

// After (correct):
import { KeyboardProvider } from "@stargazer/keyboard";

function App() {
  return (
    <KeyboardProvider>
      <Routes />
    </KeyboardProvider>
  );
}
```

5. **Update** migration Phase 1 step 5: keyboard extraction creates a separate package, not a subdirectory of @stargazer/ui

### Both Packages Work Independently

| Usage | @stargazer/keyboard | @stargazer/ui | Both |
|-------|---------------------|---------------|------|
| Custom app with keyboard shortcuts | YES | no | -- |
| TUI components with full keyboard nav | -- | -- | YES |
| Static TUI-themed components (no keyboard) | -- | Technically possible but defeats purpose | -- |

The recommended setup is to use both together. But `@stargazer/keyboard` is useful on its own for any React app that wants scope-based keyboard shortcuts.

---

## 11. Future Considerations

### Potential Additions to @stargazer/keyboard

| Feature | Priority | Notes |
|---------|----------|-------|
| `useHotkey` alias | Low | Alias for `useKey` that matches react-hotkeys-hook naming |
| Chord support | Low | `"g i"` (press g then i) -- currently not supported |
| Debug mode | Low | Log scope changes and handler matches to console |
| `useFocusTrap` | Medium | Currently lives in Dialog, but is a generic keyboard/focus utility |
| Scope priority/ordering | Low | Currently LIFO stack, might need weighted priorities |

### NOT Adding

| Feature | Why Not |
|---------|---------|
| Focus management (roving tabindex) | Tabs component handles this with standard onKeyDown -- correct for DOM-focused elements |
| Virtual focus | Complex, overlaps with browser focus APIs |
| Keyboard shortcut display/help | UI concern, belongs in app or UI library |
