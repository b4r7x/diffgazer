# Compound Component Audit

Audit of Dialog, Tabs, Toast, Menu, and NavigationList for extraction into `@stargazer/ui`.

---

## 1. Dialog

**Files:** `apps/web/src/components/ui/dialog/` (11 files)

### Sub-Components and Roles

| Sub-Component | Role | File |
|---|---|---|
| `Dialog` | Root — state management, context provider | `dialog.tsx` |
| `DialogTrigger` | Opens the dialog on click | `dialog-trigger.tsx` |
| `DialogContent` | Overlay + content container, conditionally rendered | `dialog-content.tsx` |
| `DialogHeader` | Top bar with border-bottom | `dialog-header.tsx` |
| `DialogTitle` | `<h2>` linked via `aria-labelledby` | `dialog-title.tsx` |
| `DialogDescription` | Description linked via `aria-describedby` | `dialog-description.tsx` |
| `DialogBody` | Scrollable content area | `dialog-body.tsx` |
| `DialogFooter` | Bottom bar with border-top, right-aligned actions | `dialog-footer.tsx` |
| `DialogClose` | Closes dialog; default renders `[x]` | `dialog-close.tsx` |

### Context API

**File:** `dialog-context.tsx`

```typescript
interface DialogContextValue {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  titleId: string;
  descriptionId: string;
}
```

Split context: No (single context). IDs generated via `React.useId()`.

### Compound Pattern

`Dialog > DialogTrigger | DialogContent > DialogHeader + DialogBody + DialogFooter`

- **Controlled:** `open` + `onOpenChange` props
- **Uncontrolled:** Internal `useState` when `open` is `undefined`
- Pattern is correct — checks `controlledOpen !== undefined` to determine mode.

### CVA Variants

**None.** No CVA used in Dialog. All styling is inline Tailwind classes. This is a gap — no size variants (sm/md/lg/full), no variant options.

### Hardcoded Colors

| File | Line | Class | Recommended Semantic |
|---|---|---|---|
| `dialog-content.tsx` | 75 | `bg-black/60` | `bg-tui-overlay` or CSS var `--tui-overlay` |
| `dialog-content.tsx` | 83 | `bg-tui-bg text-tui-fg` | OK (semantic) |
| `dialog-content.tsx` | 84 | `border-tui-fg` | OK but consider `border-tui-border-strong` |
| `dialog-content.tsx` | 85 | `rgb(48_54_61)` in shadow | Hardcoded — use CSS var |
| `dialog-content.tsx` | 85 | `rgba(0,0,0,0.9)` in shadow | Hardcoded — use CSS var for shadow color |
| `dialog-header.tsx` | 12 | `border-tui-border bg-tui-bg` | OK (semantic) |
| `dialog-title.tsx` | 13 | `font-bold text-sm` | OK |
| `dialog-description.tsx` | 14 | `text-tui-fg/70` | Consider `text-tui-muted` |
| `dialog-footer.tsx` | 12 | `border-tui-border bg-tui-bg` | OK (semantic) |

### Accessibility

**Good:**
- `role="dialog"`, `aria-modal="true"` on content
- `aria-labelledby` linked to `DialogTitle` via generated ID
- `aria-describedby` linked to `DialogDescription` via generated ID
- `aria-hidden="true"` on overlay backdrop
- `aria-label="Close dialog"` on default close button
- Escape key closes dialog

**Focus management:**
- Custom `useFocusTrap` hook in `dialog-content.tsx` (lines 8-55)
- Traps Tab/Shift+Tab within dialog
- Auto-focuses first focusable element on open
- Restores focus to previous element on close
- Locks body scroll (`overflow: hidden`)

**Issues:**
- `useFocusTrap` dependency array is empty `[]` (line 54) — focusable elements queried once. Dynamic content changes (e.g., async-loaded buttons) won't be caught.
- No `aria-modal` announcement for screen readers beyond the attribute (no live region).

### Item Discovery Pattern

**N/A** — Dialog is not a list-based component. Sub-components communicate via context only.

### Keyboard Coupling

**Imports from `@/hooks/keyboard`:**
- `useScope('dialog', { enabled: isOpen })` — pushes keyboard scope (line 20)
- `useKey('Escape', ...)` — closes dialog on Escape (line 21)

**Decoupling strategy:**
- `Dialog` root should accept `onEscapeKey?: () => void` callback prop
- Scope management should be the consumer's responsibility or handled by the keyboard package wrapping the dialog, not imported directly
- The internal `useFocusTrap` is self-contained (raw DOM events) — this is fine to keep

### Missing Features vs Radix/shadcn

| Feature | Radix/shadcn | Stargazer | Priority |
|---|---|---|---|
| Portal rendering | `Dialog.Portal` | Missing — renders inline | HIGH |
| Overlay as separate component | `Dialog.Overlay` | Embedded in `DialogContent` | MEDIUM |
| `asChild` prop | All sub-components | Missing | LOW (TUI-specific triggers) |
| Animation support | CSS animation data-attributes `data-state` | No `data-state` attrs | MEDIUM |
| `forceMount` | Keep in DOM when closed | Missing (conditional render) | LOW |
| Size variants | Via className | No CVA variants | MEDIUM |
| `modal` prop | Control modal vs non-modal | Always modal | LOW |
| Alert Dialog variant | Separate `AlertDialog` | Missing | MEDIUM |
| Nested dialog support | Supported | Not tested/supported | LOW |

### Recommendations

**KEEP (TUI identity):**
- Double-border style (`border-[6px] border-double`)
- `[x]` default close text
- Header/Body/Footer layout structure
- Shadow with depth effect

**ADD:**
- Portal rendering (createPortal to document.body)
- CVA size variants: `sm` (max-w-sm), `md` (max-w-2xl, current), `lg` (max-w-4xl), `full` (max-w-full)
- `data-state="open"|"closed"` on content for animation hooks
- Extract overlay as `DialogOverlay` sub-component
- Semantic CSS var for overlay color (`--tui-overlay`)

**REMOVE:**
- Direct `useScope` / `useKey` imports — accept callbacks

**REWORK:**
- `useFocusTrap` — move to a shared utility or accept via prop. Re-query focusables on mutation (MutationObserver) or use a more robust approach.

---

## 2. Tabs

**Files:** `apps/web/src/components/ui/tabs/` (6 files)

### Sub-Components and Roles

| Sub-Component | Role | File |
|---|---|---|
| `Tabs` (exported as `TabsRoot`) | Root — state + context + ref registry | `tabs.tsx` |
| `TabsList` | Container for triggers, `role="tablist"`, arrow key nav | `tabs-list.tsx` |
| `TabsTrigger` | Individual tab button, `role="tab"` | `tabs-trigger.tsx` |
| `TabsContent` | Panel shown when value matches, `role="tabpanel"` | `tabs-content.tsx` |

### Context API

**File:** `tabs-context.tsx`

```typescript
interface TabsContextValue {
  value: string;
  onValueChange: (value: string) => void;
  registerTrigger: (value: string, element: HTMLButtonElement | null) => void;
  getTriggers: () => Map<string, HTMLButtonElement | null>;
}
```

Ref-based trigger registration for arrow key navigation focus management.

### Compound Pattern

`Tabs > TabsList > TabsTrigger* + TabsContent*`

- **Controlled:** `value` + `onValueChange`
- **Uncontrolled:** `defaultValue` + internal `useState`
- Generic type parameter: `TabsProps<T extends string>` for type-safe values

### CVA Variants

**None.** All styling inline. Missing variants for:
- Orientation (`horizontal` | `vertical`)
- Visual style (`underline` | `enclosed` | `outline`)

### Hardcoded Colors

| File | Line | Class | Recommended Semantic |
|---|---|---|---|
| `tabs-trigger.tsx` | 35 | `border-[--tui-border]` | OK (CSS var syntax) |
| `tabs-trigger.tsx` | 36 | `ring-[--tui-primary]` | OK (CSS var) |
| `tabs-trigger.tsx` | 37 | `bg-tui-blue text-black border-tui-blue` | Active state — `text-black` is hardcoded. Use `text-tui-on-accent` or similar |
| `tabs-trigger.tsx` | 38 | `bg-[--tui-bg] text-[--tui-fg] hover:bg-[--tui-selection]` | OK (CSS vars) |
| `tabs-list.tsx` | 40 | `font-mono` | OK (TUI identity) |

### Accessibility

**Good:**
- `role="tablist"` on `TabsList`
- `role="tab"` on `TabsTrigger` with `aria-selected`, `aria-controls`
- `role="tabpanel"` on `TabsContent` with `aria-labelledby`
- `tabIndex={isActive ? 0 : -1}` — roving tabindex pattern
- Arrow Left/Right navigation in `TabsList` with wrap-around
- Focus follows selection (line 34: `nextItem[1]?.focus()`)
- `id` linking: `tab-{value}` ↔ `tabpanel-{value}`

**Issues:**
- Arrow key handling is in `TabsList.handleKeyDown` (DOM event) — not from keyboard package. This is actually good for decoupling.
- `disabled` prop on trigger prevents click but arrow keys can still navigate TO a disabled tab (the `findIndex` in TabsList doesn't skip disabled). This differs from Radix which skips disabled tabs.
- No Home/End key support (Radix supports this per WAI-ARIA tabs pattern).

### Item Discovery Pattern

**Ref registration** via `registerTrigger(value, element)` called in `TabsTrigger` useEffect.

**Quality:** Good. Each trigger registers/unregisters via effect cleanup. Uses a `Map<string, HTMLButtonElement | null>` stored in a ref. The Map preserves insertion order for arrow key navigation. Dynamic tab additions/removals handled correctly.

**Issue:** Map iteration order = insertion order, not DOM order. If tabs are conditionally rendered in different orders, navigation order could diverge from visual order.

### Keyboard Coupling

**No imports from `@/hooks/keyboard`.** Arrow key handling is self-contained in `TabsList` via `onKeyDown` React event handler.

This is the best pattern among all compound components — fully decoupled from the keyboard system.

### Missing Features vs Radix/shadcn

| Feature | Radix/shadcn | Stargazer | Priority |
|---|---|---|---|
| Orientation prop | `horizontal` \| `vertical` | Horizontal only | MEDIUM |
| `activationMode` | `automatic` \| `manual` | Automatic only (selection = activation) | LOW |
| Skip disabled tabs in arrow nav | Yes | No | HIGH (a11y bug) |
| `forceMount` on content | Keep panel in DOM | Conditional render only | LOW |
| Home/End key support | Yes | Missing | MEDIUM |
| `asChild` on trigger | Yes | No | LOW |
| `data-state` / `data-orientation` | Yes | No | MEDIUM |
| Loop/wrap option | Configurable | Always wraps | LOW |

### Recommendations

**KEEP (TUI identity):**
- `font-mono` on tab list
- Border-based active indicator (not underline)
- Compact sizing

**ADD:**
- CVA variants: `variant` (enclosed | outline | underline), `size` (sm | md)
- `orientation` prop (horizontal | vertical) — changes arrow keys to Up/Down
- Skip disabled tabs in arrow navigation
- Home/End key support
- `data-state="active"|"inactive"` on triggers and panels

**REMOVE:**
- Nothing

**REWORK:**
- Arrow navigation should skip disabled tabs (a11y compliance)
- Consider using DOM order instead of Map insertion order for navigation sequence

---

## 3. Toast

**Files:** `apps/web/src/components/ui/toast/` (4 files)

### Sub-Components and Roles

| Sub-Component | Role | File |
|---|---|---|
| `ToastProvider` | Global state manager (context provider) | `toast-context.tsx` |
| `ToastContainer` | Fixed-position container that renders toasts | `toast-container.tsx` |
| `Toast` | Individual toast notification with icon/title/message | `toast.tsx` |

### Context API

**File:** `toast-context.tsx`

**Split context pattern (good):**

```typescript
// Data context — re-renders when toasts change
interface ToastDataContextValue {
  toasts: Toast[];
  dismissingIds: Set<string>;
}

// Actions context — stable references, no re-renders
interface ToastActionsContextValue {
  showToast: (options: Omit<Toast, "id">) => void;
  dismissToast: (id: string) => void;
  removeToast: (id: string) => void;
}
```

Uses `useRef` for stable action callbacks — prevents unnecessary re-renders. Backward-compatible `useToast()` hook combines both.

### Compound Pattern

This is a **Provider pattern**, not a traditional compound component:

`ToastProvider > [app content] + ToastContainer`

- No Root/Trigger/Content composition
- Imperative API via `useToastActions().showToast()`
- Provider manages queue, auto-dismiss, max toasts (5)

### CVA Variants

**Yes — well-defined:**

```typescript
const toastVariants = cva("w-full border border-tui-border bg-tui-bg shadow-2xl", {
  variants: {
    variant: {
      success: "border-tui-green",
      error: "border-tui-red",
      warning: "border-tui-yellow",
      info: "border-tui-blue",
    },
  },
  defaultVariants: { variant: "info" },
});

const iconVariants = cva("font-bold", {
  variants: {
    variant: {
      success: "text-tui-green",
      error: "text-tui-red",
      warning: "text-tui-yellow",
      info: "text-tui-blue",
    },
  },
  defaultVariants: { variant: "info" },
});
```

### Hardcoded Colors

| File | Line | Class | Recommended Semantic |
|---|---|---|---|
| `toast.tsx` | 77 | `bg-tui-selection/40` | OK (semantic with opacity) |
| `toast.tsx` | 83 | `text-tui-fg` | OK |
| `toast.tsx` | 89 | `text-gray-500` | HARDCODED — use `text-tui-muted` |
| `toast.tsx` | 89 | `hover:text-tui-fg` | OK |
| `toast.tsx` | 97 | `text-tui-fg/90` | OK |
| `toast-container.tsx` | 16 | No color issues | OK |

### Accessibility

**Good:**
- `role="alert"` + `aria-live="assertive"` for error toasts
- `role="status"` + `aria-live="polite"` for non-error toasts
- `aria-atomic="true"` on each toast
- `role="region"` + `aria-label="Notifications"` on container
- `aria-label="Dismiss notification"` on close button
- `sr-only` variant label (line 82)
- `aria-hidden="true"` on icon (line 79)

**Issues:**
- No keyboard navigation between toasts (not typically needed)
- No `aria-relevant` attribute on live region
- Dismiss animation uses `onAnimationEnd` — if animations are disabled (`prefers-reduced-motion: reduce`), `motion-safe:animate-*` won't fire, so `onRemove` may never be called. This is a **bug**.

### Item Discovery Pattern

**N/A** — Toast list is data-driven from state array, not child-based discovery.

### Keyboard Coupling

**No imports from `@/hooks/keyboard`.** Fully decoupled. This is correct for a toast system.

### Missing Features vs Radix/shadcn (Sonner)

| Feature | Radix Toast / Sonner | Stargazer | Priority |
|---|---|---|---|
| Swipe to dismiss | Yes | No | LOW (TUI feel) |
| Configurable position | Top/bottom/left/right | Bottom-right only | LOW |
| Action button | `Toast.Action` | No | MEDIUM |
| Undo support | Sonner `action` prop | No | LOW |
| Promise toast | `toast.promise()` | No | MEDIUM |
| Custom duration per toast | Yes | Yes (via `duration` prop) | N/A |
| Pause on hover | Yes | No | LOW |
| Portal rendering | Yes | No (fixed position) | LOW |
| Stacking/expansion | Sonner stacks collapsed | Simple vertical list | LOW |
| Close on Escape | Yes | No | MEDIUM |

### Recommendations

**KEEP (TUI identity):**
- ASCII icons (checkmark, X, !, i)
- Header bar with uppercase title
- Border-color-as-variant pattern
- Split context (data/actions) — excellent pattern

**ADD:**
- Action button slot (e.g., "Undo" button)
- Close-on-Escape support
- Fallback for `onAnimationEnd` not firing when `prefers-reduced-motion: reduce` (use timeout fallback)
- `position` prop for container placement

**REMOVE:**
- `text-gray-500` hardcoded color on dismiss button (line 89)

**REWORK:**
- Fix reduced-motion bug: add `setTimeout` fallback alongside `onAnimationEnd`
- Consider extracting `ToastProvider` logic into a headless hook for reuse

---

## 4. Menu

**Files:** `apps/web/src/components/ui/menu/` (5 files)

### Sub-Components and Roles

| Sub-Component | Role | File |
|---|---|---|
| `Menu` | Root — state, context, keyboard nav, item discovery | `menu.tsx` |
| `MenuItem` | Individual selectable option | `menu-item.tsx` |
| `MenuDivider` | Visual separator between items | `menu-divider.tsx` |

### Context API

**File:** `menu-context.tsx`

```typescript
interface InternalMenuItemData<T extends string = string> {
  id: T;
  disabled: boolean;
  index: number;
}

interface MenuContextValue {
  selectedIndex: number;
  onSelect: (index: number) => void;
  onActivate?: (item: InternalMenuItemData) => void;
  items: Map<string, InternalMenuItemData>;
  variant: "default" | "hub";
}
```

Generic `<T extends string>` for type-safe item IDs at the call site.

### Compound Pattern

`Menu > MenuItem* | MenuDivider*`

- **Controlled only.** `selectedIndex` and `onSelect` are required props. No uncontrolled mode.
- This is intentional — Menu is always driven by parent state.

### CVA Variants

**None on `Menu` root.** The `variant` prop (`"default" | "hub"`) controls layout via conditional classes in `MenuItem`, but this is not CVA — it's manual conditionals scattered throughout `MenuItem` (lines 43-67).

This is a significant complexity issue. `MenuItem` has ~25 lines of conditional class logic based on:
- `isHub` (menu variant)
- `isDanger` (item variant)
- `isSelected` state
- `disabled` state
- `valueVariant` (4 options: default, success, success-badge, muted)

### Hardcoded Colors

| File | Line | Class | Recommended Semantic |
|---|---|---|---|
| `menu-item.tsx` | 41 | `bg-tui-red` | OK (semantic — danger selected) |
| `menu-item.tsx` | 41 | `bg-tui-blue` | OK (semantic — default selected) |
| `menu-item.tsx` | 47 | `text-tui-red` | OK (danger text) |
| `menu-item.tsx` | 53-54 | `text-black font-bold` | HARDCODED — use `text-tui-on-accent` |
| `menu-item.tsx` | 60 | `text-tui-muted` | OK |
| `menu-item.tsx` | 64 | `text-tui-green ... border-tui-green/30 bg-tui-green/10` | OK (semantic) |
| `menu-item.tsx` | 66 | `text-tui-violet` | OK |
| `menu-item.tsx` | 69 | `text-tui-red` / `text-tui-blue` | OK (indicator color) |
| `menu-item.tsx` | 87-88 | `text-tui-blue opacity-0` / `text-black` | Hub hover — `text-black` hardcoded |
| `menu-item.tsx` | 92 | `group-hover:text-white` | HARDCODED — use `group-hover:text-tui-fg` or similar |
| `menu-item.tsx` | 116 | `group-hover:text-white` | Same issue |

### Accessibility

**Good:**
- `role="listbox"` on container
- `role="option"` on items
- `aria-selected` on items
- `aria-disabled` on disabled items
- `aria-label` prop passthrough on Menu
- `role="separator"` on divider

**Issues:**
- Uses `listbox`/`option` roles — this is semantically a listbox, not a menu. WAI-ARIA `menu`/`menuitem` roles are for action menus (like dropdown menus). `listbox`/`option` is correct for selection lists. The component NAME is misleading — it behaves like a `SelectionList` or `Listbox`, not a `Menu`.
- No `aria-activedescendant` — selection is tracked by index but the active item isn't announced to screen readers via this pattern
- No `id` attributes on items for `aria-activedescendant` linking

### Item Discovery Pattern

**`Children.forEach` with type checking** (lines 32-57 in `menu.tsx`):

```typescript
Children.forEach(node, (child) => {
  if (!isValidElement(child)) return;
  if (child.type === Fragment) {
    extract((child.props as { children?: ReactNode }).children);
  }
  if (child.type === MenuItem) {
    const props = child.props as MenuItemProps;
    // ... register item
  }
});
```

**Quality assessment:**
- **Pros:** Handles `Fragment` wrapping, skips non-MenuItem children (dividers), extracts props directly
- **Cons:** `Children.forEach` is a legacy React pattern. Breaks with component wrappers (e.g., `<ConditionalMenuItem>` wrapping `MenuItem`). The `child.type === MenuItem` check is fragile — fails with React.memo, React.lazy, or HOCs. Also re-runs on every render since `items` is computed inline (no memoization).
- **Recommendation:** Switch to ref-based registration (like Tabs does) or use the collection pattern from Ark UI

### Keyboard Coupling

**Heavy coupling. Imports from `@/hooks/keyboard`:**
- `useKey('ArrowUp', ...)` — navigate up (line 70-76)
- `useKey('ArrowDown', ...)` — navigate down (line 79-85)
- `useKey('Enter', ...)` — activate selected (line 88-94)
- `useKeys(NUMBER_KEYS, ...)` — number jump (line 97-108)

All gated by `keyboardEnabled` prop.

**Decoupling strategy:**
- Accept `onKeyDown` handler prop or keyboard event callbacks (`onArrowUp`, `onArrowDown`, `onEnter`)
- Or: provide a headless `useMenuNavigation()` hook that consumers can wire up with any keyboard system
- The number-jump feature is Stargazer-specific — should be a feature of the keyboard layer, not the UI component

### Missing Features vs Radix/shadcn

| Feature | Radix DropdownMenu | Stargazer Menu | Priority |
|---|---|---|---|
| Trigger + Popover | `Menu.Trigger` + positioning | No trigger/popover — inline only | N/A (different use case) |
| Sub-menu | `Menu.Sub` | No | LOW |
| Checkbox/Radio items | `Menu.CheckboxItem` / `Menu.RadioItem` | No | LOW |
| Type-ahead search | Yes | No | MEDIUM |
| `asChild` | Yes | No | LOW |
| Keyboard navigation decoupled | Internal | Imported from keyboard hooks | HIGH |
| Proper ARIA menu pattern | `menu`/`menuitem` | `listbox`/`option` | MEDIUM (rename?) |

**Note:** Stargazer's `Menu` is really a `Listbox` or `SelectionList`. It's not a dropdown/context menu. This is fine but the naming is confusing vs standard component library terminology.

### Recommendations

**KEEP (TUI identity):**
- `▌` selection indicator character
- `[n]` hotkey display
- Hub variant (card-like items)
- Number-jump feature (but move to keyboard layer)

**ADD:**
- `aria-activedescendant` support (add `id` to items, track on container)
- CVA for the variant system (extract the 25+ lines of conditional classes)
- Type-ahead search (filter items by typing)

**REMOVE:**
- Direct `useKey`/`useKeys` imports — accept event callbacks
- `Children.forEach` discovery pattern

**REWORK:**
- Rename to `Listbox` / `SelectionList` for library extraction (or keep `Menu` but document that it's a listbox, not a WAI-ARIA menu)
- Replace `Children.forEach` item discovery with ref-based registration
- Extract the conditional class logic in `MenuItem` into CVA slot recipes or at least separate utility functions
- The `hub` variant is different enough that it could be a separate component (`HubList` vs `Menu`)

---

## 5. NavigationList

**Files:** `apps/web/src/components/ui/navigation-list/` (4 files)

### Sub-Components and Roles

| Sub-Component | Role | File |
|---|---|---|
| `NavigationList` | Root — context, keyboard nav via `useGroupNavigation` | `navigation-list.tsx` |
| `NavigationListItem` | Individual item with selection indicator, badge, subtitle | `navigation-list-item.tsx` |

### Context API

**File:** `navigation-list-context.tsx`

```typescript
interface NavigationListContextValue {
  selectedId: string | null;
  onSelect: (id: string) => void;
  onActivate?: (id: string) => void;
  isFocused: boolean;
}
```

Minimal context. `isFocused` controls whether selection highlight is shown (supports multi-pane focus).

### Compound Pattern

`NavigationList > NavigationListItem*`

- **Controlled only.** `selectedId` and `onSelect` are required.
- `isFocused` prop enables multi-pane UX (item stays selected but highlight dims when pane loses focus).
- `onBoundaryReached` callback for pane-switching when navigation hits top/bottom.

### CVA Variants

**None.** All styling is inline conditionals in `NavigationListItem`. Missing variants for density, size.

### Hardcoded Colors

| File | Line | Class | Recommended Semantic |
|---|---|---|---|
| `navigation-list-item.tsx` | 45 | `bg-tui-fg text-black` | Selected state — `text-black` HARDCODED, use `text-tui-on-accent` |
| `navigation-list-item.tsx` | 46 | `hover:bg-tui-selection border-tui-border/50` | OK |
| `navigation-list-item.tsx` | 54 | `bg-tui-blue` / `bg-transparent group-hover:bg-tui-muted` | OK (semantic) |
| `navigation-list-item.tsx` | 59 | `text-black` (in `showSelection &&`) | HARDCODED — same `text-tui-on-accent` issue |
| `navigation-list-item.tsx` | 64 | `text-black` / `text-tui-yellow` | `text-black` HARDCODED |
| `navigation-list-item.tsx` | 73 | `text-black/70` / `text-tui-muted` | `text-black/70` HARDCODED |

Pattern: `text-black` appears 4 times as the "text on selected background" color. This should be a single semantic token.

### Accessibility

**Good:**
- `role="listbox"` on container
- `role="option"` on items
- `data-value={id}` on items (used by `useGroupNavigation`)
- `aria-selected` on items
- `aria-disabled` on disabled items
- `aria-activedescendant` on container linked to `navlist-{id}`
- `id={`navlist-${id}`}` on items for activedescendant linking

**Issues:**
- No `aria-label` on the listbox container (passed by consumer, but not enforced/documented)
- The `▌` indicator is visual-only — not announced to screen readers (which is correct, but could add `sr-only` label for selection state)

### Item Discovery Pattern

**DOM-based via `useGroupNavigation`** — queries `[role="option"]` elements within the container ref, reads `data-value` attributes.

**Quality:** Good. DOM-order-based discovery means visual order always matches navigation order. Works with conditional rendering, fragments, wrapper components. No `Children.forEach` fragility.

**However:** This couples the component to the `useGroupNavigation` hook from the keyboard package.

### Keyboard Coupling

**Imports from `@/hooks/keyboard`:**
- `useGroupNavigation({...})` — handles ArrowUp/Down, Enter, boundary detection (line 29-38)

**Decoupling strategy:**
- `useGroupNavigation` is a DOM-query-based navigation hook. For library extraction, the NavigationList should either:
  1. Accept `onKeyDown` prop and handle navigation externally, or
  2. Accept a `navigation` prop that provides the hook behavior, or
  3. Use the Radix pattern: embed keyboard handling within the component but make it self-contained (no external hook import)
- The `onBoundaryReached` callback is Stargazer-specific (pane switching) — good that it's already a prop

### Missing Features vs Radix/shadcn

| Feature | Radix Listbox / shadcn | Stargazer | Priority |
|---|---|---|---|
| Type-ahead search | Yes | No | MEDIUM |
| Multi-select | Optional | No | LOW |
| Grouped items | `Listbox.Group` with label | No | MEDIUM |
| Empty state | Slot/component | No | LOW |
| Loading state | Skeleton pattern | No | LOW |
| Virtualization | Via composition | No | MEDIUM (large lists) |
| `asChild` | Yes | No | LOW |
| Orientation | horizontal/vertical | Vertical only | LOW |

### Recommendations

**KEEP (TUI identity):**
- `▌` selection indicator
- Left color bar (blue/muted)
- Badge/subtitle layout
- `isFocused` prop for multi-pane UX — this is a unique and valuable feature
- `onBoundaryReached` for pane switching

**ADD:**
- CVA variants for density: `compact` (py-2), `default` (py-3), `comfortable` (py-4)
- `aria-label` prop requirement (or console warning if missing)
- Group/section support (`NavigationListGroup`)
- Empty state slot

**REMOVE:**
- Direct `useGroupNavigation` import

**REWORK:**
- Extract keyboard handling to accept callbacks or be self-contained
- `text-black` hardcoded appearances (4x) should use semantic token

---

## Cross-Cutting Issues

### 1. Keyboard Decoupling Summary

| Component | Keyboard Imports | Decoupling Effort |
|---|---|---|
| Dialog | `useScope`, `useKey` | LOW — 2 simple callbacks |
| Tabs | None | DONE — already decoupled |
| Toast | None | DONE — no keyboard needed |
| Menu | `useKey` (x3), `useKeys` (x1) | MEDIUM — 4 hooks, need onKeyDown or callback props |
| NavigationList | `useGroupNavigation` | MEDIUM — deep integration, need navigation abstraction |

### 2. Item Discovery Patterns

| Component | Pattern | Quality | Recommendation |
|---|---|---|---|
| Dialog | N/A | N/A | N/A |
| Tabs | Ref registration (`registerTrigger`) | Good | Keep, but consider DOM-order fallback |
| Toast | Data-driven (state array) | Good | Keep |
| Menu | `Children.forEach` + type checking | Fragile | Switch to ref registration or DOM query |
| NavigationList | DOM query (`[role="option"]` + `data-value`) | Good | Keep, but decouple from keyboard hook |

### 3. Controlled vs Uncontrolled

| Component | Controlled | Uncontrolled | Pattern |
|---|---|---|---|
| Dialog | `open` + `onOpenChange` | Yes (internal state) | Correct |
| Tabs | `value` + `onValueChange` | `defaultValue` | Correct |
| Toast | N/A (imperative API) | N/A | Correct |
| Menu | `selectedIndex` + `onSelect` | No | Should add `defaultIndex` |
| NavigationList | `selectedId` + `onSelect` | No | Should add `defaultSelectedId` |

### 4. Recurring Hardcoded `text-black`

Appears in: Menu (2x), NavigationList (4x), Tabs (1x)

Always means "text color on an accent/selected background." This should be a single semantic token: `--tui-on-accent` / `text-tui-on-accent`.

### 5. Missing Portal Rendering

Only Dialog needs portaling (overlay), but currently renders inline. Add `createPortal` to `document.body` in `DialogContent`.

### 6. No `data-state` Attributes

None of the components emit `data-state`, `data-orientation`, or `data-disabled` attributes for CSS-based styling/animation. Adding these would follow Radix convention and enable animation libraries.

### 7. No Animation Strategy

- Dialog: No open/close animation
- Tabs: No panel transition
- Toast: Has `animate-slide-in-right` / `animate-slide-out-right` (only component with animation)
- Menu: No selection animation
- NavigationList: No animation

Recommendation: Add `data-state` attributes and let consumers use CSS `[data-state=open]` selectors or Tailwind `data-[state=open]:` variants.

---

## Summary Table

| Component | Sub-parts | CVA | Keyboard Coupled | A11y Quality | Item Discovery | Library-Ready |
|---|---|---|---|---|---|---|
| Dialog | 9 | None | YES (useScope, useKey) | Good (focus trap, ARIA) | N/A | MEDIUM — needs portal, CVA, decoupling |
| Tabs | 4 | None | No (self-contained) | Good (roving tabindex) | Ref registration (good) | HIGH — closest to ready |
| Toast | 3 | Yes (2 recipes) | No | Good (live regions) | Data-driven (good) | HIGH — well-structured |
| Menu | 3 | None | YES (useKey x4) | Decent (listbox pattern) | Children.forEach (fragile) | LOW — needs significant rework |
| NavigationList | 2 | None | YES (useGroupNavigation) | Good (activedescendant) | DOM query (good) | MEDIUM — needs decoupling |

### Extraction Priority

1. **Toast** — Most library-ready. Clean CVA, split context, no keyboard coupling. Fix reduced-motion bug and `text-gray-500`.
2. **Tabs** — No keyboard coupling, good ref registration. Needs CVA variants and disabled-tab-skip fix.
3. **Dialog** — Good a11y but needs portal, overlay extraction, CVA sizes, keyboard decoupling.
4. **NavigationList** — Good patterns but tightly coupled to keyboard hook. Unique `isFocused` feature is valuable.
5. **Menu** — Needs most work: Children.forEach replacement, massive MenuItem rework, keyboard decoupling, possible rename.
