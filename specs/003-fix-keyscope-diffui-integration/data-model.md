# Data Model: Keyscope + diff-ui Integration

## Entities

### NavigationController (keyscope useNavigation)

State managed per container:

| Field | Type | Description |
|-------|------|-------------|
| highlighted | `string \| null` | Currently highlighted item's data-value |
| isControlled | `boolean` | `true` when external `value` prop provided |
| enabled | `boolean` | When `false`, onKeyDown returns immediately |
| containerRef | `RefObject<HTMLElement>` | Container element for DOM queries |
| role | `NavigationRole` | ARIA role to query items (`radio`, `checkbox`, `option`, `menuitem`, `button`, `tab`) |

State transitions:
- **ArrowDown/ArrowRight** → highlight moves to next item (wraps if `wrap: true`)
- **ArrowUp/ArrowLeft** → highlight moves to previous item
- **Home** → highlight moves to first item
- **End** → highlight moves to last item
- **Enter** → `onEnter` callback fires with current highlighted value
- **Space** → `onSelect` callback fires with current highlighted value
- **Boundary reached** → `onBoundaryReached("up" | "down")` fires (used for focus zone transitions)

### ListboxController (diff-ui useListbox)

Wraps NavigationController with controllable state for menu/listbox pattern:

| Field | Type | Description |
|-------|------|-------------|
| selectedId | `string \| null` | Currently selected item (via useControllableState) |
| highlightedId | `string \| null` | Currently highlighted item (via useControllableState) |
| typeaheadQuery | `string` | Accumulated keypress buffer (500ms reset) |

Additional behavior: typeahead search, `aria-activedescendant` generation, composed container props.

### FocusZone (keyscope useFocusZone)

Multi-pane layout manager used by diffgazer:

| Field | Type | Description |
|-------|------|-------------|
| zones | `string[]` | Named zones (e.g., `["filters", "list", "details"]`) |
| activeZone | `string` | Currently active zone |
| transitions | `function` | Maps (zone, key) → target zone |

### Scope (keyscope useScope)

Handler isolation stack:

| Field | Type | Description |
|-------|------|-------------|
| name | `string` | Scope name (e.g., `"settings-hub"`, `"api-key-dialog"`) |
| active | `boolean` | `true` when this scope is topmost |
| handlers | `Map<string, handler[]>` | Key → handler mappings registered via `useKey` |

## Relationships

```
AppProviders
  └── KeyboardProvider (scope stack + handler registry)
        └── useScope("page-name") ← per page
        └── useKey("Escape", ...) ← per page hotkey
        └── useFocusZone({ zones }) ← multi-pane pages

diff-ui Component (e.g., RadioGroup)
  └── Internal useNavigation (handles arrow keys, Enter/Space)
  └── Accepts controlled props: highlighted, onHighlightChange, onSelect

Consumer (diffgazer page)
  └── Local state: focusedValue, selectedValue
  └── Passes highlighted={focusedValue} to diff-ui component
  └── Receives onHighlightChange callback to update local state
  └── Uses useKey/useScope/useFocusZone for page-level keyboard features
```

## State Sync Flow

```
User presses ArrowDown
  → diff-ui component's internal onKeyDown fires
  → Internal useNavigation moves highlight
  → onHighlightChange callback fires
  → Consumer's local state updates (setFocusedValue)
  → Consumer re-renders with new highlighted prop
  → diff-ui component highlights new item
```
