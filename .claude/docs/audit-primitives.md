# Primitive Components Audit for @stargazer/ui

Audit date: 2026-02-07
Compared against: shadcn/ui, Radix UI, Ark UI patterns

---

## 1. Button (`apps/web/src/components/ui/button.tsx`)

### Props Interface

```typescript
interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement>, VariantProps<typeof buttonVariants> {
  bracket?: boolean;           // TUI identity: wraps children in [ ... ]
  ref?: React.Ref<HTMLButtonElement>;
}
```

### CVA Variants

**variant** (9 values):
| Name | Classes |
|------|---------|
| `primary` | `bg-tui-blue text-black font-bold hover:bg-tui-blue/90` |
| `secondary` | `border border-tui-border bg-transparent hover:bg-tui-selection` |
| `destructive` | `text-tui-red border border-tui-red bg-transparent hover:bg-tui-red hover:text-black` |
| `success` | `bg-tui-green text-black font-bold hover:bg-tui-green/90` |
| `ghost` | `bg-transparent hover:bg-tui-selection` |
| `outline` | `border border-tui-border bg-transparent text-tui-fg hover:bg-tui-border` |
| `tab` | `bg-transparent text-tui-fg border-b-2 border-transparent hover:border-b-tui-blue data-[active=true]:border-b-tui-blue data-[active=true]:font-bold` |
| `toggle` | `border border-tui-border bg-transparent text-tui-fg data-[active=true]:bg-tui-blue data-[active=true]:text-black data-[active=true]:border-tui-blue` |
| `link` | `bg-transparent text-tui-blue underline-offset-2 hover:underline` |

**size** (3 values):
| Name | Classes |
|------|---------|
| `sm` | `h-7 px-3 text-xs` |
| `md` | `h-9 px-4 py-2 text-sm` |
| `lg` | `h-11 px-6 py-2 text-base` |

**Defaults:** `variant: "primary"`, `size: "md"`

**Base classes:** `inline-flex items-center justify-center font-mono whitespace-nowrap transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-tui-blue focus-visible:ring-offset-2 focus-visible:ring-offset-tui-bg disabled:pointer-events-none disabled:opacity-50 cursor-pointer`

### Hardcoded Colors

| Line | Value | Context | Recommendation |
|------|-------|---------|----------------|
| 6 | `focus-visible:ring-tui-blue` | Focus ring | OK - uses semantic token |
| 6 | `focus-visible:ring-offset-tui-bg` | Focus ring offset | OK - uses semantic token |
| 10 | `text-black` | Primary text on blue bg | Replace with `text-tui-contrast` or `text-tui-on-primary` |
| 13 | `text-black` | Success text on green bg | Replace with `text-tui-contrast` or `text-tui-on-success` |
| 16 | `text-tui-fg` | Outline foreground | OK - semantic token |
| 18 | `text-black` | Toggle active text | Replace with `text-tui-contrast` |

**Summary:** 3 instances of hardcoded `text-black` used for contrast text on colored backgrounds. Need a semantic `text-tui-contrast` or per-variant `text-tui-on-{variant}` token.

### Accessibility

- Focus ring: `focus-visible:ring-2 focus-visible:ring-tui-blue focus-visible:ring-offset-2` (line 6)
- Disabled: `disabled:pointer-events-none disabled:opacity-50` (line 6)
- No `aria-*` attributes added by component (native `<button>` handles this)
- Missing: `aria-pressed` for toggle variant, `aria-selected` for tab variant

### TUI Identity Features (KEEP)

- `bracket` prop: wraps children in `[ ... ]` (line 46) -- **core TUI identity**
- `font-mono` base class (line 6) -- **core TUI identity**
- `data-[active=true]` pattern for tab/toggle -- good pattern, keep

### What to ADD (vs shadcn/Radix)

| Feature | shadcn has | Notes |
|---------|-----------|-------|
| `asChild` prop (Slot pattern) | Yes | Use Radix Slot or custom. Allows rendering as `<a>`, `<Link>`, etc. |
| `loading` prop | No (but common) | Show spinner, disable interactions. TUI could show `[...]` or `[loading]` |
| `icon` size auto-scaling | Yes (via size) | When button is icon-only, use square dimensions |
| `iconOnly` / `size="icon"` | Yes | Square button for icon-only use: `h-9 w-9` |

### What to REMOVE for library

| Item | Reason |
|------|--------|
| `tab` variant | App-specific. Belongs in a `Tabs` component, not a generic Button. |
| `toggle` variant | App-specific. Should be a separate `ToggleButton` or `Toggle` component. |

### Keyboard Coupling

**None.** Button has no keyboard hook imports. Clean for extraction.

---

## 2. Badge (`apps/web/src/components/ui/badge/badge.tsx`)

### Props Interface

```typescript
interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement>, VariantProps<typeof badgeVariants> {}
```

### CVA Variants

**variant** (6 values):
| Name | Classes |
|------|---------|
| `success` | `bg-tui-green/10 text-tui-green border-tui-green` |
| `warning` | `bg-tui-yellow/10 text-tui-yellow border-tui-yellow` |
| `error` | `bg-tui-red/10 text-tui-red border-tui-red` |
| `info` | `bg-tui-blue/10 text-tui-blue border-tui-blue` |
| `neutral` | `bg-tui-muted/10 text-tui-muted border-tui-border` |
| `stored` | `bg-transparent text-tui-green border-transparent` |

**size** (2 values):
| Name | Classes |
|------|---------|
| `sm` | `px-2 py-0.5 text-xs` |
| `md` | `px-3 py-1 text-sm` |

**Defaults:** `variant: "neutral"`, `size: "sm"`

**Base classes:** `inline-flex items-center font-bold tracking-wider rounded-sm border shrink-0 whitespace-nowrap`

### Hardcoded Colors

**None.** All colors use `tui-*` semantic tokens. Excellent.

### Accessibility

- No `role` attribute (semantic `<span>`, may need `role="status"` in some contexts)
- No `aria-label` -- callers responsible

### TUI Identity Features (KEEP)

- `font-bold tracking-wider` -- gives the dense TUI label feel
- `rounded-sm` -- minimal rounding, TUI aesthetic
- `border` always present -- TUI box-drawing feel

### What to ADD (vs shadcn/Radix)

| Feature | Notes |
|---------|-------|
| `dot` prop or `indicator` variant | Show a colored dot before text (common in status badges) |
| `removable` / `onRemove` | Closable badge with [x] in TUI style |
| `lg` size | Missing from size scale, inconsistent with Button which has sm/md/lg |

### What to REMOVE for library

| Item | Reason |
|------|--------|
| `stored` variant | Domain-specific (Stargazer review storage concept). Move to app-level extension. |

### Keyboard Coupling

**None.** Badge has no keyboard hook imports. Clean for extraction.

---

## 3. Input (`apps/web/src/components/ui/form/input.tsx`)

### Props Interface

```typescript
interface InputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'size'>, VariantProps<typeof inputVariants> {
  ref?: React.Ref<HTMLInputElement>;
}
```

Note: `size` from native HTML is omitted to avoid conflict with CVA `size` variant.

### CVA Variants

**size** (3 values):
| Name | Classes |
|------|---------|
| `sm` | `h-7 px-2 py-1 text-xs` |
| `md` | `h-9 px-3 py-2 text-sm` |
| `lg` | `h-11 px-4 py-2 text-base` |

**Defaults:** `size: "md"`

**Base classes:** `flex w-full bg-tui-bg border border-tui-border text-tui-fg font-mono placeholder:text-tui-fg/50 transition-colors focus:border-tui-blue focus:ring-1 focus:ring-tui-blue focus:outline-none disabled:opacity-50 disabled:cursor-not-allowed`

### Hardcoded Colors

**None.** All colors use `tui-*` tokens. Excellent.

### Accessibility

- Focus: `focus:border-tui-blue focus:ring-1 focus:ring-tui-blue` (line 5)
- Disabled: `disabled:opacity-50 disabled:cursor-not-allowed` (line 5)
- Missing: no `aria-invalid`, `aria-describedby` support (callers must add)
- No label association built in (expected -- atomic component)

### TUI Identity Features (KEEP)

- `font-mono` -- core TUI identity
- `bg-tui-bg border border-tui-border` -- terminal input box feel
- `placeholder:text-tui-fg/50` -- dimmed placeholder, terminal feel

### What to ADD (vs shadcn/Radix)

| Feature | Notes |
|---------|-------|
| `variant` for error state | `error` variant with `border-tui-red focus:ring-tui-red` |
| Left/right slot (`startAdornment`/`endAdornment`) | For icons, prefixes, clear buttons |
| `asChild` or wrapper for Textarea | Or create separate Textarea with shared variants |

### What to REMOVE for library

Nothing domain-specific. Clean as-is.

### Keyboard Coupling

**None.** Input has no keyboard hook imports. Clean for extraction.

---

## 4. Callout (`apps/web/src/components/ui/callout.tsx`)

### Props Interface

```typescript
interface CalloutProps extends React.HTMLAttributes<HTMLDivElement>, VariantProps<typeof calloutVariants> {
  title?: string;
}
```

### CVA Variants

**Three separate CVA definitions:**

**calloutVariants** (container):
| Name | Classes |
|------|---------|
| `info` | `border-tui-blue/40 bg-tui-blue/5` |
| `warning` | `border-tui-yellow/40 bg-tui-yellow/5` |
| `error` | `border-tui-red/40 bg-tui-red/5` |
| `success` | `border-tui-green/40 bg-tui-green/5` |

Base: `relative border font-mono p-4 flex gap-4 items-start`

**iconVariants** (icon badge):
| Name | Classes |
|------|---------|
| `info` | `bg-tui-blue text-black shadow-tui-blue/20` |
| `warning` | `bg-tui-yellow text-black shadow-tui-yellow/20` |
| `error` | `bg-tui-red text-black shadow-tui-red/20` |
| `success` | `bg-tui-green text-black shadow-tui-green/20` |

Base: `w-5 h-5 flex items-center justify-center text-xs font-bold rounded-sm shrink-0 mt-0.5 shadow-lg`

**textVariants**:
| Name | Classes |
|------|---------|
| `info` | `text-tui-blue` |
| `warning` | `text-tui-yellow` |
| `error` | `text-tui-red` |
| `success` | `text-tui-green` |

Base: `text-sm`

### Hardcoded Colors

| Line | Value | Context | Recommendation |
|------|-------|---------|----------------|
| 24 | `text-black` | Icon text on info bg | Replace with `text-tui-contrast` |
| 25 | `text-black` | Icon text on warning bg | Replace with `text-tui-contrast` |
| 26 | `text-black` | Icon text on error bg | Replace with `text-tui-contrast` |
| 27 | `text-black` | Icon text on success bg | Replace with `text-tui-contrast` |

**Summary:** 4 instances of `text-black` in iconVariants for contrast on colored backgrounds. Same issue as Button.

### TUI Icon Map (KEEP)

```typescript
const icons = { info: "i", warning: "!", error: "✕", success: "✓" };
```

These are text-character icons -- **core TUI identity**. Do NOT replace with SVG icons.

### Accessibility

- `role="status"` default (line 64) -- good
- Role is configurable via `role` prop spread
- Missing: `aria-live` for dynamic callouts (should be `aria-live="polite"` when role is "status")

### TUI Identity Features (KEEP)

- Text-character icons (`i`, `!`, `✕`, `✓`) -- core TUI aesthetic
- `font-mono` base class
- `rounded-sm` on icon badge
- Border-only container (no heavy background)

### What to ADD (vs shadcn/Radix)

| Feature | Notes |
|---------|-------|
| `icon` prop override | Allow custom icon while defaulting to TUI chars |
| `closable` / `onClose` | Dismissable callouts with `[x]` button |
| `compact` size variant | Smaller version without title |
| Export `calloutVariants` | Currently not exported -- needed for library consumers |

### What to REMOVE for library

Nothing domain-specific. Clean as-is.

### Keyboard Coupling

**None.** Callout has no keyboard hook imports. Clean for extraction.

---

## 5. Checkbox / CheckboxGroup (`apps/web/src/components/ui/form/checkbox.tsx`)

### Props Interfaces

**Checkbox (standalone):**
```typescript
interface CheckboxProps {
  checked?: boolean;
  defaultChecked?: boolean;
  onCheckedChange?: (checked: boolean) => void;
  label?: React.ReactNode;
  description?: React.ReactNode;
  disabled?: boolean;
  focused?: boolean;           // Visual focus ring (from keyboard nav)
  size?: SelectableItemSize;   // "sm" | "md" | "lg"
  variant?: CheckboxVariant;   // "x" | "bullet"
  className?: string;
  "data-value"?: string;       // Used by useGroupNavigation DOM queries
}
```

**CheckboxGroup:**
```typescript
interface CheckboxGroupProps<T extends string = string> {
  value?: T[];
  defaultValue?: T[];
  onValueChange?: (value: T[]) => void;
  onEnter?: (itemValue: T, newValues: T[]) => void;  // App-specific callback
  disabled?: boolean;
  size?: SelectableItemSize;
  variant?: CheckboxVariant;
  className?: string;
  children: React.ReactNode;
  wrap?: boolean;                                      // Keyboard nav wrap
  onBoundaryReached?: (direction: "up" | "down") => void; // Keyboard nav boundary
}
```

**CheckboxItem:**
```typescript
interface CheckboxItemProps {
  value: string;
  label: React.ReactNode;
  description?: React.ReactNode;
  disabled?: boolean;
  className?: string;
}
```

### CVA Variants

Uses shared `selectable-item.ts` variants (see section 7 below). No component-specific CVA.

### TUI Visual Indicators

| Variant | Checked | Unchecked |
|---------|---------|-----------|
| `x` | `[x]` | `[ ]` |
| `bullet` | `[ ● ]` | `[   ]` |

These are **core TUI identity** -- keep.

### Hardcoded Colors

Inherits from `selectable-item.ts` (see section 7).

### Accessibility

- `role="checkbox"` (line 69)
- `aria-checked={checked}` (line 71)
- `aria-disabled={disabled}` (line 72)
- `tabIndex={disabled ? -1 : 0}` (line 73)
- `onClick` + `onKeyDown` (Space/Enter) handlers (lines 55-65)
- CheckboxGroup: `role="group"` (line 206)
- Missing: `aria-label` or `aria-labelledby` on group

### Keyboard Coupling -- CRITICAL

**Direct import:** `import { useGroupNavigation } from "@/hooks/keyboard"` (line 3)

**Coupling chain:**
```
CheckboxGroup
  └─ useGroupNavigation (hooks/keyboard/use-group-navigation.ts)
       └─ useKey (hooks/keyboard/use-key.ts)
            └─ useKeyboardContext (global scope/registry system)
```

**What useGroupNavigation provides to CheckboxGroup:**
- Arrow up/down navigation between items
- Space/Enter to toggle selection
- Wrap-around at boundaries
- `isFocused(value)` callback for visual focus state
- DOM querying via `containerRef` + `role` + `data-value`

**Decoupling strategy:**
The standalone `Checkbox` is already clean -- it accepts `focused` as a prop and handles its own click/keydown. The coupling is only in `CheckboxGroup`.

For the library, `CheckboxGroup` should:
1. Accept an optional `navigationHook` or `focusedValue` + `onFocusedValueChange` props
2. Remove the direct `useGroupNavigation` import
3. Provide a `useCheckboxGroupNavigation` adapter in `@stargazer/keyboard` that wires up the hook

Alternatively, split into:
- `@stargazer/ui`: exports `Checkbox`, `CheckboxGroup` (no keyboard nav, just context)
- `@stargazer/keyboard`: exports `KeyboardCheckboxGroup` that wraps `CheckboxGroup` + adds nav

### What to ADD (vs shadcn/Radix)

| Feature | Notes |
|---------|-------|
| `indeterminate` state | For "select all" parent checkboxes: `[~]` or `[-]` in TUI |
| `name` prop | For form submission |
| `required` prop | Form validation |
| `orientation` prop on group | horizontal/vertical layout (only vertical currently) |

### What to REMOVE for library

| Item | Reason |
|------|--------|
| `onEnter` prop on CheckboxGroup | App-specific callback (confirm action on Enter). Move to keyboard layer. |
| `onBoundaryReached` prop | Keyboard navigation concern, not UI concern. Move to keyboard layer. |
| `wrap` prop | Keyboard navigation concern. Move to keyboard layer. |
| Direct `useGroupNavigation` import | Must be decoupled (see strategy above). |

---

## 6. Radio / RadioGroup (`apps/web/src/components/ui/form/radio-group.tsx`)

### Props Interfaces

**Radio (standalone):**
```typescript
interface RadioProps {
  checked?: boolean;
  onCheckedChange?: (checked: boolean) => void;
  label?: ReactNode;
  description?: ReactNode;
  disabled?: boolean;
  focused?: boolean;
  size?: SelectableItemSize;
  className?: string;
  "data-value"?: string;
}
```

**RadioGroup:**
```typescript
interface RadioGroupProps<T extends string = string> {
  value?: T;
  defaultValue?: T;
  onValueChange?: (value: T) => void;
  onFocus?: (value: T) => void;
  onFocusZoneEnter?: () => void;      // App-specific
  orientation?: "vertical" | "horizontal";
  disabled?: boolean;
  size?: SelectableItemSize;
  className?: string;
  children: ReactNode;
  wrap?: boolean;                       // Keyboard nav
  onBoundaryReached?: (direction: "up" | "down") => void; // Keyboard nav
}
```

**RadioGroupItem:**
```typescript
interface RadioGroupItemProps {
  value: string;
  label: ReactNode;
  description?: ReactNode;
  disabled?: boolean;
  className?: string;
}
```

### CVA Variants

Uses shared `selectable-item.ts` variants (see section 7 below). No component-specific CVA.

### TUI Visual Indicators

| State | Display |
|-------|---------|
| Checked | `[ ● ]` |
| Unchecked | `[   ]` |

**Core TUI identity** -- keep.

### Hardcoded Colors

Inherits from `selectable-item.ts` (see section 7).

### Accessibility

- `role="radio"` on Radio (line 52)
- `role="radiogroup"` on RadioGroup container (line 172)
- `aria-checked={checked}` (line 54)
- `aria-disabled={disabled}` (line 55)
- `aria-orientation={orientation}` on group (line 173)
- `tabIndex={disabled ? -1 : 0}` (line 57)
- `onClick` + `onKeyDown` (Space/Enter) handlers
- Missing: `aria-label` or `aria-labelledby` on group
- Missing: `aria-required` for form usage

### Keyboard Coupling -- CRITICAL

**Direct import:** `import { useGroupNavigation } from "@/hooks/keyboard"` (line 4)

**Same coupling chain as Checkbox:**
```
RadioGroupRoot
  └─ useGroupNavigation
       └─ useKey
            └─ useKeyboardContext
```

**What useGroupNavigation provides to RadioGroup:**
- Arrow up/down navigation between items
- Space/Enter to select
- Wrap-around at boundaries
- `isFocused(value)` callback for visual focus state

**Decoupling strategy:** Same as Checkbox (see section 5).

For the library, `RadioGroup` should:
1. Accept `focusedValue` + `onFocusedValueChange` props (or render prop)
2. Remove the direct `useGroupNavigation` import
3. `@stargazer/keyboard` provides `KeyboardRadioGroup` wrapper

### What to ADD (vs shadcn/Radix)

| Feature | Notes |
|---------|-------|
| `name` prop | For form submission |
| `required` prop | Form validation |
| `loop` (rename `wrap`) | Radix naming convention |

### What to REMOVE for library

| Item | Reason |
|------|--------|
| `onFocusZoneEnter` prop | App-specific (trust form zones). Move to app layer. |
| `onBoundaryReached` prop | Keyboard nav concern. Move to keyboard layer. |
| `wrap` prop | Keyboard nav concern. Move to keyboard layer. |
| Direct `useGroupNavigation` import | Must be decoupled. |
| `onFocus` on RadioGroup | Ambiguous name (is it DOM focus or visual focus?). Rename to `onHighlightChange` or move to keyboard layer. |

---

## 7. Selectable Item (shared CVA) (`apps/web/src/components/ui/form/selectable-item.ts`)

### Exported Variants

This file provides **5 CVA variant functions** shared by Checkbox and Radio:

**selectableItemVariants** (container state):
| Variant | Value | Classes |
|---------|-------|---------|
| `focused` | `true` | `bg-tui-selection text-white font-bold before:absolute before:left-0 before:top-0 before:bottom-0 before:w-1 before:bg-tui-blue` |
| `focused` | `false` | `text-tui-fg hover:bg-tui-selection/50` |
| `disabled` | `true` | `opacity-50 cursor-not-allowed` |
| `disabled` | `false` | (empty) |

Base: `flex cursor-pointer select-none font-mono relative`

**selectableItemContainerVariants** (layout):
Base only: `flex items-center gap-3 px-3 py-2`

**selectableItemIndicatorVariants** (check/radio indicator):
| Variant | Value | Classes |
|---------|-------|---------|
| `size.sm` | - | `text-sm min-w-4` |
| `size.md` | - | `min-w-5` |
| `size.lg` | - | `text-lg min-w-6` |
| Compound: `checked: true, focused: false` | - | `text-tui-green` |

Base: `font-bold`

**selectableItemLabelVariants** (label text):
| Variant | Value | Classes |
|---------|-------|---------|
| `size.sm` | - | `text-sm` |
| `size.md` | - | `text-base` |
| `size.lg` | - | `text-lg` |

**selectableItemDescriptionVariants** (description text):
| Variant | Value | Classes |
|---------|-------|---------|
| `focused.true` | - | `text-white/70` |
| `focused.false` | - | `text-tui-muted` |

Base: `text-sm mt-0.5`

### Exported Types

```typescript
export type SelectableItemSize = "sm" | "md" | "lg";
export type SelectableItemVariants = VariantProps<typeof selectableItemVariants>;
```

### Hardcoded Colors

| Line | Value | Context | Recommendation |
|------|-------|---------|----------------|
| 8 | `text-white` | Focused item text | Replace with `text-tui-fg-focus` or `text-tui-on-selection` |
| 8 | `before:bg-tui-blue` | Focus indicator bar | OK - semantic token |
| 44 | `text-tui-green` | Checked indicator (unfocused) | OK - semantic token (checked = green is intentional) |
| 69 | `text-white/70` | Description when focused | Replace with `text-tui-fg-focus/70` or `text-tui-on-selection-muted` |

**Summary:** 2 instances of `text-white` (lines 8, 69) that assume dark theme. These break on light themes. Need semantic tokens for "text color on selection background".

### TUI Identity Features (KEEP)

- `font-mono` base class
- `before:` pseudo-element focus bar (left edge highlight) -- terminal selection indicator
- `cursor-pointer select-none` -- intentional for keyboard-driven TUI
- `gap-3 px-3 py-2` spacing -- compact, terminal-like density

### Recommendations for Library

This file is well-designed as a shared primitive. Keep it as the styling foundation for all selectable items (checkbox, radio, future switch, listbox items, etc.).

Changes needed:
1. Replace `text-white` / `text-white/70` with semantic tokens
2. Consider making the focus indicator bar (`before:` pseudo) configurable or a separate variant
3. Export from `@stargazer/ui` as internal utility (not public API, consumed by Checkbox/Radio)

---

## Cross-Cutting Issues

### 1. `text-black` / `text-white` Hardcoding

| Component | Line(s) | Issue |
|-----------|---------|-------|
| Button | 10, 13, 18 | `text-black` on colored bg |
| Callout iconVariants | 24-27 | `text-black` on colored bg |
| selectable-item | 8, 69 | `text-white` on selection bg |

**Fix:** Define semantic tokens:
- `text-tui-contrast` -- for text on colored backgrounds (dark on light bg, light on dark bg)
- `text-tui-on-selection` -- for text on selection background
- `text-tui-on-selection-muted` -- for secondary text on selection background

### 2. Keyboard Navigation Coupling

Only **CheckboxGroup** and **RadioGroup** have keyboard coupling. The standalone `Checkbox` and `Radio` are clean.

**Dependency chain:**
```
Component (CheckboxGroup / RadioGroup)
  └─ useGroupNavigation
       └─ useKey
            └─ useKeyboardContext (global keyboard scope registry)
```

**Decoupling approach:**
The Group components should accept keyboard state via props rather than importing hooks:

```typescript
// Library-friendly API
interface CheckboxGroupProps {
  // ... existing props ...
  focusedValue?: string | null;
  onFocusedValueChange?: (value: string) => void;
}
```

Then `@stargazer/keyboard` provides the integration:
```typescript
// In @stargazer/keyboard
function KeyboardCheckboxGroup(props) {
  const nav = useGroupNavigation({ ... });
  return <CheckboxGroup focusedValue={nav.focusedValue} ... />;
}
```

### 3. Missing `asChild` / Slot Pattern

None of the components support polymorphic rendering. Button especially needs this for rendering as `<a>`, `<Link>`, `<label>`, etc.

**Recommendation:** Add `asChild` prop using Radix's Slot approach or a simpler `as` prop with `React.ElementType`.

### 4. Missing Form Integration

Checkbox, Radio, and Input lack:
- `name` prop passthrough for form submission
- `aria-invalid` for error states
- `aria-describedby` for error/help text
- `required` prop with `aria-required`

These are expected at the component level for library-quality primitives.

### 5. Consistent Size Scale

| Component | sm | md | lg |
|-----------|----|----|-----|
| Button | h-7 | h-9 | h-11 |
| Input | h-7 | h-9 | h-11 |
| Badge | yes | yes | **NO** |
| Checkbox | yes (via selectable-item) | yes | yes |
| Radio | yes (via selectable-item) | yes | yes |
| Callout | N/A (no size variant) | N/A | N/A |

Badge is missing `lg` size. Consider adding for consistency.

---

## Extraction Readiness Summary

| Component | Keyboard Coupling | Hardcoded Colors | Domain Coupling | Ready for Library? |
|-----------|-------------------|------------------|-----------------|-------------------|
| Button | None | 3x `text-black` | `tab`/`toggle` variants | Nearly ready (remove tab/toggle, fix colors) |
| Badge | None | None | `stored` variant | Nearly ready (remove stored) |
| Input | None | None | None | Ready |
| Callout | None | 4x `text-black` | None | Nearly ready (fix colors) |
| Checkbox | None (standalone) | Via selectable-item | None | Ready (standalone) |
| CheckboxGroup | **useGroupNavigation** | Via selectable-item | `onEnter`, `wrap`, `onBoundaryReached` | Needs decoupling |
| Radio | None (standalone) | Via selectable-item | None | Ready (standalone) |
| RadioGroup | **useGroupNavigation** | Via selectable-item | `onFocusZoneEnter`, `wrap`, `onBoundaryReached` | Needs decoupling |
| selectable-item | None | 2x `text-white` | None | Nearly ready (fix colors) |

### Priority Actions

1. **Define semantic tokens:** `text-tui-contrast`, `text-tui-on-selection`, `text-tui-on-selection-muted`
2. **Decouple keyboard from Groups:** Accept `focusedValue`/`onFocusedValueChange` props instead of importing `useGroupNavigation`
3. **Remove domain variants:** `tab`, `toggle` from Button; `stored` from Badge
4. **Add `asChild` support:** At minimum on Button
5. **Add form props:** `name`, `required`, `aria-invalid` on Checkbox, Radio, Input
