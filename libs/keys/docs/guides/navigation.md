# Navigation

> Try the [List Navigation](../../examples/playground/) and [Tab Bar](../../examples/playground/) demos to see navigation in action.

Two hooks for keyboard-driven navigation. `useNavigation` is standalone (no Provider needed) and `useScopedNavigation` integrates with `KeyboardProvider`. Both query the DOM for items inside a container, then move focus between them with arrow keys, Home, End, Enter, and Space.

## useNavigation

The main hook. Handles arrow key navigation, selection, and focus tracking for any list of role-attributed elements.

### DOM setup

Three things need to be true about your HTML:

1. A **container element** with a ref
2. Child elements with a matching **`role`** attribute (`"option"`, `"menuitem"`, `"radio"`, `"checkbox"`, `"button"`, or `"tab"`)
3. Each child has a **`data-value`** attribute -- this is how the hook tracks which item is focused

Disabled items use `aria-disabled="true"` (not the HTML `disabled` attribute). When `skipDisabled` is true (the default), the selector becomes `[role="option"]:not([aria-disabled="true"])`, so disabled items get skipped during navigation.

```tsx
const containerRef = useRef<HTMLDivElement>(null);

const { highlighted, isHighlighted, onKeyDown } = useNavigation({
  containerRef,
  role: "option",
  onSelect: (value) => console.log("selected", value),
});

return (
  <div ref={containerRef} role="listbox" onKeyDown={onKeyDown}>
    {items.map((item) => (
      <div
        key={item.id}
        role="option"
        data-value={item.id}
        aria-disabled={item.disabled ? "true" : undefined}
        aria-selected={isHighlighted(item.id)}
        style={{ background: isHighlighted(item.id) ? "#e0e7ff" : undefined }}
      >
        {item.label}
      </div>
    ))}
  </div>
);
```

On every focus change, the hook calls `scrollIntoView({ block: "nearest" })` on the focused element, so long lists scroll to keep the focused item visible.

### Standalone vs scoped

`useNavigation` is standalone — it returns an `onKeyDown` handler you attach to your container. No `KeyboardProvider` required.

```tsx
// Standalone — you wire up the handler
const { highlighted, isHighlighted, highlight, onKeyDown } = useNavigation({
  containerRef,
  role: "option",
});

return (
  <div ref={containerRef} role="listbox" onKeyDown={onKeyDown}>
    {/* items */}
  </div>
);
```

For scope-aware navigation (e.g., modals, panels), use `useScopedNavigation` instead. It registers keys through `KeyboardProvider` via `useKey`, so they participate in the scope stack.

```tsx
import { useScopedNavigation } from "@diffgazer/keys";

// Scoped — keys register through KeyboardProvider
const { highlighted, isHighlighted, highlight } = useScopedNavigation({
  containerRef,
  role: "option",
  requireFocusWithin: true, // only respond when focus is inside container
});
```

When to use which:
- **useNavigation**: the list is embedded inside a component (combobox, dropdown, tab bar). You attach `onKeyDown` to the container.
- **useScopedNavigation**: the list is the main content of a panel, dialog, or page. You want arrow keys to work without the user clicking into the list first, and you need scope awareness.

### Controlled vs uncontrolled

**Uncontrolled** (default): pass `initialValue` and the hook manages highlight state internally. `highlighted` reflects the internal state.

```tsx
const { highlighted } = useNavigation({
  containerRef,
  role: "option",
  initialValue: "first-item", // starts highlighted here (null if omitted)
});
```

**Controlled**: pass `value` and `onValueChange`. The hook calls `onValueChange` instead of updating internal state -- you own the highlighted value.

```tsx
const [focused, setFocused] = useState<string | null>("first-item");

const { isHighlighted } = useNavigation({
  containerRef,
  role: "option",
  value: focused,
  onValueChange: setFocused,
});
```

The distinction is the same as controlled/uncontrolled inputs in React. If `value` is passed (even as `null`), the hook is controlled.

### Selection semantics

Two keys trigger selection, and they map to different callbacks:

- **Space** calls `onSelect(value, event)`. Think "toggle" or "check".
- **Enter** calls `onEnter(value, event)`. Think "activate" or "open". If `onEnter` is not provided, Enter falls back to `onSelect`.

This matches ARIA guidelines where Space toggles and Enter activates.

```tsx
useNavigation({
  containerRef,
  role: "option",
  onSelect: (value) => toggleItem(value),     // Space
  onEnter: (value) => openItem(value),         // Enter (falls back to onSelect if omitted)
});
```

### Orientation

Default is `"vertical"` -- ArrowUp/ArrowDown navigate. Set `orientation: "horizontal"` for ArrowLeft/ArrowRight.

```tsx
useNavigation({
  containerRef,
  role: "option",
  orientation: "horizontal",
});
```

You can also override the exact keys with `upKeys` and `downKeys`:

```tsx
useNavigation({
  containerRef,
  role: "option",
  upKeys: ["ArrowUp", "k"],    // vim-style
  downKeys: ["ArrowDown", "j"],
});
```

Home always jumps to the first item, End to the last. These aren't configurable.

### Boundary behavior

When the user presses down on the last item (or up on the first):

- **`wrap: true`** (default): focus wraps to the other end of the list
- **`wrap: false`**: nothing happens, but `onBoundaryReached` fires with `"up"` or `"down"`

```tsx
useNavigation({
  containerRef,
  role: "option",
  wrap: false,
  onBoundaryReached: (direction) => {
    if (direction === "down") focusNextSection();
  },
});
```

This is useful for multi-section layouts where hitting the bottom of one list should move focus to the next list.

### Focus tracking

Three ways to observe focus:

- `highlighted` -- the current highlighted item's `data-value`, or `null`
- `isHighlighted(value)` -- returns `true` if that value is currently highlighted
- `onHighlightChange(value)` -- callback fired on every focus change

The `highlight(value)` function lets you programmatically set the highlighted item:

```tsx
const { highlight } = useNavigation({ containerRef, role: "option" });

// Jump to a specific item
highlight("item-42");
```

### Full options reference

```ts
interface UseNavigationOptions {
  containerRef: RefObject<HTMLElement | null>;  // required
  role: NavigationRole;                         // required
  value?: string | null;
  onValueChange?: (value: string) => void;
  onSelect?: (value: string, event: KeyboardEvent) => void;
  onEnter?: (value: string, event: KeyboardEvent) => void;
  onHighlightChange?: (value: string) => void;
  wrap?: boolean;                   // default: true
  enabled?: boolean;                // default: true
  preventDefault?: boolean;         // default: true
  onBoundaryReached?: (direction: "up" | "down") => void;
  initialValue?: string | null;     // default: null
  orientation?: "vertical" | "horizontal";  // default: "vertical"
  skipDisabled?: boolean;           // default: true
  upKeys?: string[];                // default: ["ArrowUp"] or ["ArrowLeft"]
  downKeys?: string[];              // default: ["ArrowDown"] or ["ArrowRight"]
}

// useScopedNavigation extends the same options:
interface UseScopedNavigationOptions extends UseNavigationOptions {
  requireFocusWithin?: boolean;     // default: false
}
```

---

## Tab navigation

The old `useTabNavigation` hook has been replaced by `useNavigation` with `role: "tab"`. This provides consistent behavior with other navigation roles.

### DOM setup

The container needs `role="tablist"`. Tab buttons need `role="tab"` and `data-value` attributes. Disabled tabs use `aria-disabled="true"`.

```tsx
const containerRef = useRef<HTMLDivElement>(null);
const { onKeyDown } = useNavigation({
  containerRef,
  role: "tab",
  orientation: "horizontal",
});

return (
  <div ref={containerRef} role="tablist" onKeyDown={onKeyDown}>
    <button role="tab" data-value="one" onClick={() => setTab("one")}>
      Tab One
    </button>
    <button role="tab" data-value="two" onClick={() => setTab("two")}>
      Tab Two
    </button>
    <button role="tab" data-value="three" aria-disabled="true">
      Tab Three
    </button>
  </div>
);
```

Arrow keys move between tabs. Home jumps to the first tab, End to the last. Wrapping is on by default.

### Vertical tabs

Pass `orientation: "vertical"` to switch from ArrowLeft/ArrowRight to ArrowUp/ArrowDown.

```tsx
const { onKeyDown } = useNavigation({
  containerRef,
  role: "tab",
  orientation: "vertical",
});
```

### Full example

```tsx
function Tabs() {
  const [active, setActive] = useState("overview");
  const containerRef = useRef<HTMLDivElement>(null);
  const { isHighlighted, onKeyDown } = useNavigation({
    containerRef,
    role: "tab",
    orientation: "horizontal",
    onSelect: (value) => setActive(value),
  });

  const tabs = [
    { id: "overview", label: "Overview" },
    { id: "settings", label: "Settings" },
    { id: "billing", label: "Billing", disabled: true },
    { id: "team", label: "Team" },
  ];

  return (
    <div>
      <div ref={containerRef} role="tablist" onKeyDown={onKeyDown}>
        {tabs.map((tab) => (
          <button
            key={tab.id}
            role="tab"
            data-value={tab.id}
            aria-disabled={tab.disabled ? "true" : undefined}
            aria-selected={active === tab.id}
            tabIndex={active === tab.id ? 0 : -1}
            onClick={() => !tab.disabled && setActive(tab.id)}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div role="tabpanel">
        {active === "overview" && <p>Overview content</p>}
        {active === "settings" && <p>Settings content</p>}
        {active === "team" && <p>Team content</p>}
      </div>
    </div>
  );
}
```

Focus a tab with your mouse or Tab key, then use Left/Right arrows to move between tabs. The billing tab is skipped because it has `aria-disabled="true"`. Home/End jump to the first and last enabled tabs.
