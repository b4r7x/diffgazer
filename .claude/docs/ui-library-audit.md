# UI Component Library Extraction Audit (v2)

**Date:** 2026-02-07 (updated)
**Scope:** 143 .tsx files, 50 hooks, 68 design tokens across `apps/web/src/`
**Goal:** Extract TWO reusable packages: `@stargazer/ui` (components) + `@stargazer/keyboard` (navigation)

---

## 1. Executive Summary

Stargazer's web app contains **30+ UI primitives** built with Tailwind 4 + CVA + tailwind-merge forming a **terminal UI (TUI) component library for the web**. The TUI aesthetic is the library's identity:

- **Monospace typography** (`font-mono`) is the only font
- **Bracket notation** (`[ Submit ]`, `[x]`, `[ . ]`) is a signature visual pattern
- **Text-character icons** (`"i"`, `"!"`, `">"`, `"▌"`) replace SVG icons
- **Sharp corners** (`rounded-sm` / 2px) enforce the terminal feel
- **Only 2 themes:** dark (default) + light

### Two Packages (NOT one)

The library is split into **two independent packages**:

| Package | Purpose | Depends on |
|---------|---------|------------|
| `@stargazer/keyboard` | Scope-based keyboard navigation system | React only |
| `@stargazer/ui` | TUI-themed styled components | React, `@stargazer/keyboard` (peer) |

**Why separate:** The keyboard system is a generic scope-based hotkey manager (~400 LOC) with zero UI dependencies. It's useful independently for any React app. UI components use it via peer dependency.

### Extraction Summary

| Category | Extract | Generalize | Rework | Skip |
|----------|---------|------------|--------|------|
| Primitives | 6 | 0 | 0 | 0 |
| Compound | 4 | 0 | 1 (Menu) | 0 |
| Display/Layout | 6 | 0 | 4 | 5 |
| Feature extractions | 4 | 5 | 0 | 14 |
| **Total** | **20** | **5** | **5** | **19** |

### Critical Issues

1. **~75 hardcoded colors** across 36 files break light theme (biggest migration task)
2. **5 token bugs** (dead tokens, duplicates, broken radius)
3. **Menu needs rework** (fragile Children.forEach, no CVA, heavy keyboard coupling)
4. **No portal rendering** (Dialog renders inline)
5. **No `data-state` attributes** (blocks CSS animation hooks)

---

## 2. Package Architecture

### @stargazer/keyboard

```
packages/keyboard/
  src/
    index.ts                    # Public barrel export
    keyboard-provider.tsx       # KeyboardProvider + KeyboardContext
    keyboard-utils.ts           # matchesHotkey(), isInputElement()
    use-keyboard-context.ts     # Context consumer hook
    use-key.ts                  # Single hotkey registration
    use-keys.ts                 # Multi-hotkey registration
    use-scope.ts                # Scope push/pop
    use-group-navigation.ts     # DOM-based compound component navigation
    use-selectable-list.ts      # Index-based list navigation
    use-footer-navigation.ts    # Toolbar/footer zone navigation
```

**Public API:**
```typescript
// Provider
export { KeyboardProvider } from "./keyboard-provider";

// Core hooks
export { useKey, useKeys, useScope, useKeyboardContext } from "./...";

// Navigation primitives
export { useGroupNavigation, useSelectableList, useFooterNavigation } from "./...";

// Utilities
export { matchesHotkey, isInputElement } from "./keyboard-utils";
```

**NOT included:** `useTrustFormKeyboard` (app-specific, stays in app code).

### @stargazer/ui

```
packages/ui/
  src/
    components/
      button.tsx
      badge/
      callout.tsx
      form/                     # input, checkbox, radio-group, selectable-item (internal)
      dialog/
      tabs/
      toast/
      menu/
      navigation-list/
      panel/
      stepper/                  # renamed from progress/
      scroll-area.tsx
      focusable-pane.tsx
      section-header.tsx
      empty-state.tsx
      key-value-row.tsx         # renamed from status-row
      card-layout.tsx           # renamed from wizard-layout
      block-bar.tsx             # generalized from severity-bar
      code-block.tsx            # extracted from features/review
      diff-view.tsx             # extracted from features/review
      key-value.tsx             # extracted from features/review
      labeled-field.tsx         # extracted from features/home
      search-input.tsx          # unified from 2 duplicates
      toggle-group.tsx          # unified from 2 duplicates
      checklist.tsx             # generalized from features/review
      horizontal-stepper.tsx    # generalized from features/onboarding
      timer.tsx                 # generalized from features/review
    internal/
      selectable-item.ts        # Shared CVA for Checkbox/RadioGroup (not exported)
      slot.tsx                  # asChild/Slot pattern (new)
      portal.tsx                # createPortal wrapper (new)
    styles/
      theme.css                 # Token definitions (:root dark + [data-theme="light"])
      index.css                 # Tailwind imports, @theme bridge, globals
    lib/
      cn.ts                     # clsx + tailwind-merge utility
    index.ts                    # Public barrel export
```

### Consumer Setup

```tsx
import { KeyboardProvider } from "@stargazer/keyboard";
import "@stargazer/ui/styles/theme.css";
import "@stargazer/ui/styles/index.css";

function App() {
  return (
    <KeyboardProvider>
      <Routes />
    </KeyboardProvider>
  );
}
```

### Dependency Graph

```
@stargazer/ui
  peerDeps: react, @stargazer/keyboard

@stargazer/keyboard
  peerDeps: react

App (apps/web)
  deps: @stargazer/ui, @stargazer/keyboard
```

---

## 3. Components to Extract

### Tier 1: Primitives (P0)

| Component | Source | Variants | Hardcoded Colors | Keyboard Coupled |
|-----------|--------|----------|------------------|------------------|
| **Button** | `ui/button.tsx` | 9 variants, 3 sizes | 3x `text-black` | None |
| **Badge** | `ui/badge/badge.tsx` | 6 variants, 2 sizes | None | None |
| **Input** | `ui/form/input.tsx` | 3 sizes | None | None |
| **Callout** | `ui/callout.tsx` | 4 variants (3 CVA defs) | 4x `text-black` | None |
| **Checkbox** | `ui/form/checkbox.tsx` | via selectable-item | via selectable-item | Group uses `useGroupNavigation` |
| **RadioGroup** | `ui/form/radio-group.tsx` | via selectable-item | via selectable-item | Group uses `useGroupNavigation` |

**Changes needed:**
- Button: Remove `tab`/`toggle` variants (app-specific), add `loading` prop, add `asChild`
- Badge: Remove `stored` variant (domain-specific), add `lg` size
- Input: Add `error` variant, add `startAddon`/`endAddon` slots
- Callout: Add `icon` prop override, add `onDismiss`
- Checkbox/Radio: Add `name`, `required`, `indeterminate` (checkbox). Groups import from `@stargazer/keyboard` (peer dep)
- All: Replace `text-black` with semantic token `text-primary-foreground`

### Tier 2: Compound Components (P0-P1)

| Component | Source | Keyboard Coupled | CVA | Priority |
|-----------|--------|------------------|-----|----------|
| **Toast** | `ui/toast/` | None | Yes (2 recipes) | P0 (most ready) |
| **Tabs** | `ui/tabs/` | None (self-contained) | None (add) | P0 |
| **Dialog** | `ui/dialog/` | `useScope` + `useKey` | None (add) | P1 |
| **NavigationList** | `ui/navigation-list/` | `useGroupNavigation` | None (add) | P1 |
| **Menu** | `ui/menu/` | `useKey` x3 + `useKeys` | None (needs rework) | P2 |

**Extraction priority (readiness):**
1. Toast -- best structured, fix reduced-motion bug + `text-gray-500`
2. Tabs -- no keyboard coupling, fix disabled-tab-skip a11y bug
3. Dialog -- needs portal, overlay extraction, CVA sizes
4. NavigationList -- unique `isFocused` multi-pane feature
5. Menu -- most work needed (Children.forEach replacement, CVA, consider rename to Listbox)

### Tier 3: Display & Layout (P1)

| Component | Source | Decision | Notes |
|-----------|--------|----------|-------|
| **Panel** | `ui/containers/panel.tsx` | EXTRACT | Highest value. 5 header + 4 value + 3 spacing variants |
| **Stepper** | `ui/progress/` (3 files) | EXTRACT (minor rework) | Unique differentiator. Make badge labels configurable |
| **ScrollArea** | `ui/scroll-area.tsx` | EXTRACT | Simple, ready as-is |
| **FocusablePane** | `ui/focusable-pane.tsx` | EXTRACT | Visual focus indicator, pairs with keyboard package |
| **CardLayout** | `shared/wizard-layout.tsx` | REWORK | Rename, add size variant |
| **BlockBar** | `ui/severity/severity-bar.tsx` | REWORK | Replace `severity` prop with `color` |
| **SectionHeader** | `ui/section-header.tsx` | REWORK | Add variant + heading level props |
| **EmptyState** | `ui/empty-state.tsx` | REWORK | Fix raw gray-500, add icon/action slots |
| **KeyValueRow** | `ui/status-row.tsx` | EXTRACT | Generic key-value row |

### Tier 4: Feature Extractions (P1-P3)

| Component | Source | Library Name | Priority |
|-----------|--------|-------------|----------|
| **SearchInput** | 2 duplicates unified | `SearchInput` | P1 |
| **ToggleGroup** | 2 duplicates unified | `ToggleGroup` | P1 |
| **CodeBlock** | review/code-snippet.tsx | `CodeBlock` | P2 |
| **DiffView** | review/diff-view.tsx | `DiffView` | P2 |
| **KeyValue** | review/metric-item.tsx | `KeyValue` | P2 |
| **LabeledField** | home/info-field.tsx | `LabeledField` | P2 |
| **Checklist** | review/fix-plan-checklist.tsx | `Checklist` | P2 |
| **HorizontalStepper** | onboarding/wizard-progress.tsx | `HorizontalStepper` | P2 |
| **Timer** | review/timer.tsx | `Timer` | P3 |

---

## 4. Design Token Strategy

### 2-Layer Architecture

```
Layer 1 (palette):   --tui-bg, --tui-blue, --tui-red, ...     (theme-specific raw values)
Layer 2 (semantic):  --background, --primary, --destructive, ... (shadcn-compatible bare names)
Layer 3 (Tailwind):  --color-background, --color-primary, ...   (@theme bridge)
```

### 5 Bugs to Fix

1. **`--radius-sm` = 0px** -- `calc(4px - 4px)`. Fix: `max(calc(var(--radius) - 4px), 1px)`
2. **Duplicate severity systems** -- `--severity-*` vs `--tui-severity-*` with conflicting `low` values. Fix: Remove `--tui-severity-*`
3. **`--color-*` bridge defined twice** -- in theme.css AND @theme block. Fix: Remove from theme.css
4. **`--muted` uses hardcoded hex** -- should be `var(--tui-muted)`. Fix: reference palette token
5. **Dead tokens** -- `--background0`, `--foreground0` (zero usage). Fix: Remove

### Missing Tokens to Add

| Token | Purpose |
|-------|---------|
| `--success` / `--success-foreground` | Green semantic (button success, callout) |
| `--warning` / `--warning-foreground` | Yellow semantic (callout) |
| `--severity-nit` | Missing severity level |
| `--accent` (bare name) | shadcn compat (only in @theme currently) |
| `--card`, `--popover`, `--ring` (bare names) | shadcn compat |

### Hardcoded Color Migration (~75 instances, 36 files)

| From | To | Count |
|------|-----|-------|
| `text-gray-300` | `text-tui-fg/80` | 5 |
| `text-gray-400` | `text-tui-muted` | 11 |
| `text-gray-500` | `text-tui-muted` | ~35 |
| `text-gray-600` | `text-muted-foreground` | 8 |
| `border-gray-*` | `border-tui-border` | ~8 |
| `bg-black` | `bg-tui-bg` | 2 |
| `text-black` (on colored bg) | `text-primary-foreground` | ~25 |
| `text-white` (non-inverted) | `text-tui-fg` | 5 |

Full per-file details: see `audit-design-tokens.md` Section 3.

---

## 5. Components NOT to Extract

| Component | Reason |
|-----------|--------|
| AsciiLogo | App branding, depends on figlet |
| IssueListItem | Coupled to ReviewIssue domain type |
| GlobalLayout | App shell with router/provider wiring |
| Header | App branding |
| Footer | App-specific status bar |
| SeverityBreakdown | Domain composition (17 lines) |
| Severity Constants | Domain config |
| PathList | Too specific (16 lines) |
| All 50+ feature-specific components | Domain-coupled |

---

## 6. Cross-Cutting Concerns

### Keyboard Decoupling

UI components import from `@stargazer/keyboard` as peer dependency. No logic changes needed.

| Component | Imports | Effort |
|-----------|---------|--------|
| Dialog | `useScope`, `useKey` | Import path change only |
| Menu | `useKey` x3, `useKeys` | Import path change only |
| NavigationList | `useGroupNavigation` | Import path change only |
| CheckboxGroup | `useGroupNavigation` | Import path change only |
| RadioGroup | `useGroupNavigation` | Import path change only |
| Tabs | None (self-contained) | None |
| Toast | None | None |

### Item Discovery Patterns

| Component | Pattern | Quality | Action |
|-----------|---------|---------|--------|
| NavigationList | DOM query (`[role="option"]`) | Best | Keep |
| Tabs | Ref registration (`Map`) | Good | Keep |
| Toast | Data-driven (state array) | Good | Keep |
| Menu | `Children.forEach` + type check | Fragile | Replace with ref registration |

### Controlled/Uncontrolled Support

| Component | Controlled | Uncontrolled | Action |
|-----------|------------|--------------|--------|
| Dialog | YES | YES | None |
| Tabs | YES | YES | None |
| Toast | N/A (imperative) | N/A | None |
| Menu | YES | NO | Add `defaultIndex` |
| NavigationList | YES | NO | Add `defaultSelectedId` |

---

## 7. Implementation Phases

### Phase 1: Foundation

1. Create `packages/keyboard/` -- copy 9 modules, fix internal imports, verify tests
2. Create `packages/ui/` -- package structure, `cn()` utility, base CSS
3. Fix design tokens (5 bugs, add missing tokens)
4. Build Portal, Slot/asChild utilities
5. Update all import paths (keyboard: 24 files, import path changes only)

### Phase 2: Core Primitives

1. Button (remove tab/toggle, add loading + asChild)
2. Badge (remove stored, add lg size)
3. Input (add error state, addon slots)
4. Callout (add icon prop, onDismiss)
5. Separator (new)
6. Panel (token abstraction only)
7. ScrollArea, FocusablePane, KeyValueRow (as-is)

### Phase 3: Compound Components

1. Toast (fix reduced-motion bug, add action slot)
2. Tabs (add orientation, fix disabled-tab-skip, add CVA)
3. Dialog (add Portal, overlay extraction, CVA sizes)
4. SearchInput (unify 2 implementations)
5. ToggleGroup (unify 2 implementations)

### Phase 4: Advanced

1. Checkbox/RadioGroup (add form props, indeterminate)
2. Stepper (decouple schemas, configurable labels)
3. Menu (replace Children.forEach, add CVA, consider rename)
4. NavigationList (add uncontrolled mode, typeahead)
5. CodeBlock, DiffView, KeyValue, LabeledField
6. CardLayout, BlockBar, SectionHeader, EmptyState
7. Checklist, HorizontalStepper, Timer

### Phase 5: Token Migration

1. Migrate ~75 hardcoded gray classes to semantic tokens (per-file, see audit-design-tokens.md)

---

## 8. Detailed Sub-Audits

| Audit File | Scope |
|------------|-------|
| `audit-primitives.md` | 7 components, CVA variants, hardcoded colors, keyboard coupling |
| `audit-compound.md` | 5 components (761 lines), sub-components, item discovery, a11y |
| `audit-display-layout.md` | 16 components, extract/rework/skip decisions |
| `audit-feature-extractions.md` | 23 components, 3 duplicate patterns, unified APIs |
| `audit-design-tokens.md` | Full token inventory, 75 hardcoded instances, clean spec |
| `audit-keyboard-package.md` | 9 hooks, 3 interface options, migration strategy |
