# Contract: Two-Layer Keyboard Integration

## Layer 1 — diff-ui Component Contract

Every interactive diff-ui component MUST:

### Props Interface (controlled mode)

```typescript
interface NavigableComponentProps {
  // Highlight control (optional — when provided, component uses controlled mode)
  highlighted?: string | null;
  onHighlightChange?: (value: string) => void;

  // Selection control
  value?: string;              // or selectedId for Menu/NavigationList
  onChange?: (value: string) => void;  // or onSelect

  // Keyboard passthrough
  onKeyDown?: (event: KeyboardEvent) => void;

  // Container ref forwarding
  ref?: Ref<HTMLDivElement>;
}
```

### Behavioral Contract

1. **Standalone mode** (no `highlighted` prop): Component manages highlight state internally via its own `useNavigation`/`useListbox` hook
2. **Controlled mode** (`highlighted` prop provided): Component uses `useControllableState` to merge internal and external state. External value takes priority.
3. **onKeyDown passthrough**: When external `onKeyDown` is provided, component calls it. If external handler calls `event.preventDefault()`, internal navigation is skipped (Tabs pattern).
4. **Ref forwarding**: Component MUST forward `ref` to its root container element so consumers can provide `containerRef` for keyscope hooks.

### ARIA Requirements

Each component MUST render correct WAI-ARIA roles:

| Component | Container Role | Item Role | Key Attributes |
|-----------|---------------|-----------|----------------|
| Menu | `role="menu"` | `role="menuitem"` | `aria-current`, `aria-disabled` |
| RadioGroup | `role="radiogroup"` | `role="radio"` | `aria-checked`, `aria-orientation` |
| CheckboxGroup | `role="group"` | `role="checkbox"` | `aria-checked` (supports mixed) |
| Tabs | `role="tablist"` | `role="tab"` | `aria-selected`, `aria-controls` |
| NavigationList | `role="listbox"` | `role="option"` | `aria-selected`, `aria-orientation` |
| Dialog | `role="dialog"` | N/A | `aria-labelledby`, `aria-modal` |
| Select | `role="listbox"` | `role="option"` | `aria-activedescendant` |
| Accordion | N/A | `role="button"` | `aria-expanded`, `aria-controls` |

## Layer 2 — Keyscope Enhancement Contract

### Provider-Dependent Hooks (require KeyboardProvider)

Used by diffgazer pages for page-level features:

```typescript
// Scope isolation — only topmost scope's handlers fire
useScope("page-name");

// Hotkey registration — scoped to active scope
useKey("Escape", handler);
useKey("Enter", handler, { enabled: condition });

// Multi-zone focus management
useFocusZone({
  zones: ["list", "details"],
  zone: activeZone,
  onZoneChange: setActiveZone,
  transitions: ({ zone, key }) => { ... },
});
```

### Standalone Hooks (no provider needed)

```typescript
// Arrow key navigation — ONLY used by diff-ui components internally
// Consumer should NOT duplicate this for the same container
useNavigation({
  containerRef,
  role: "radio",
  value: highlighted,     // controlled value
  onValueChange: setter,
  enabled: true,          // can be disabled
});
```

## Integration Contract

### Consumer (diffgazer) MUST:

1. Wrap app in `<KeyboardProvider>` (already done in AppProviders)
2. Use `useScope` per page for handler isolation
3. Use `useKey` for page-level hotkeys (Escape, shortcuts)
4. Use `useFocusZone` for multi-pane layouts
5. Pass `highlighted` and `onHighlightChange` to diff-ui components for coordination with focus zones
6. NOT create redundant `useNavigation` instances for containers where diff-ui components already handle navigation

### Consumer MUST NOT:

1. Create `useNavigation` and also let the diff-ui component create its own `useNavigation` for the same container
2. Pass `onKeyDown` from a consumer `useNavigation` to a diff-ui component that has its own internal navigation
3. Use mismatched ARIA roles between consumer `useNavigation` (e.g., `role: "option"`) and diff-ui component items (e.g., `role="menuitem"`)
