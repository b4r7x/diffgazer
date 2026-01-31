# useScreenState Implementation Details

## Summary of Changes

Added persistent state management to review feature components using the existing `useScreenState` hook. This persists user navigation state, selection indices, and UI preferences across screen transitions.

## Files Modified

### 1. ReviewSplitScreen
**Path:** `/Users/voitz/Projects/stargazer/apps/cli/src/features/review/components/review-split-screen.tsx`

**Changes:**
- Added import: `import { useScreenState } from "../../../hooks/use-screen-state.js";`
- Replaced 4 `useState` calls with `useScreenState`:
  - `activeTab` → persists selected issue detail tab
  - `focus` → persists keyboard focus area (list/details/filters)
  - `filterFocusedIndex` → persists focused filter button
  - `activeFilter` → persists active severity filter

**Before:**
```typescript
const [activeTab, setActiveTab] = useState<IssueTab>("details");
const [focus, setFocus] = useState<FocusArea>("list");
const [filterFocusedIndex, setFilterFocusedIndex] = useState(0);
const [activeFilter, setActiveFilter] = useState<SeverityFilter>("all");
```

**After:**
```typescript
const [activeTab, setActiveTab] = useScreenState<IssueTab>("activeTab", "details");
const [focus, setFocus] = useScreenState<FocusArea>("focus", "list");
const [filterFocusedIndex, setFilterFocusedIndex] = useScreenState<number>("filterFocusedIndex", 0);
const [activeFilter, setActiveFilter] = useScreenState<SeverityFilter>("activeFilter", "all");
```

### 2. ReviewScreen
**Path:** `/Users/voitz/Projects/stargazer/apps/cli/src/features/review/components/review-screen.tsx`

**Changes:**
- Added import: `import { useScreenState } from "../../../hooks/use-screen-state.js";`
- Replaced 2 `useState` calls with `useScreenState`:
  - `selectedIndex` → persists currently selected issue position
  - `issueStatuses` → persists ignored/applied status for each issue
- Fixed import: Changed `TRIAGE_SEVERITY_COLORS` to `SEVERITY_COLORS` from `@repo/schemas/ui`

**Before:**
```typescript
const [selectedIndex, setSelectedIndex] = useState(0);
const [issueStatuses, setIssueStatuses] = useState(
  () => new Map<string, IssueStatus>()
);
```

**After:**
```typescript
const [selectedIndex, setSelectedIndex] = useScreenState<number>("selectedIndex", 0);
const [issueStatuses, setIssueStatuses] = useScreenState<Map<string, IssueStatus>>(
  "issueStatuses",
  new Map<string, IssueStatus>()
);
```

## State Keys and Scoping

The `useScreenState` hook automatically scopes state to the current screen. Key naming convention:

### ReviewSplitScreen State
- `"activeTab"` → Details/Explain/Trace/Patch tab selection
- `"focus"` → Keyboard focus routing (list/details/filters)
- `"filterFocusedIndex"` → Focused severity filter button
- `"activeFilter"` → Active severity filter selection

### ReviewScreen State
- `"selectedIndex"` → Current issue selection position
- `"issueStatuses"` → Map of issue ID → {ignored, applied} status

## Hook Implementation Reference

The `useScreenState` hook from `/Users/voitz/Projects/stargazer/apps/cli/src/hooks/use-screen-state.ts`:

```typescript
export function useScreenState<T>(
  key: string,
  defaultValue: T
): [T, SetState<T>] {
  const screenName = useScreenContext();
  return useRouteState(key, defaultValue, { scope: screenName });
}
```

**Key Features:**
- Automatic screen/view scoping prevents state pollution between screens
- Full TypeScript generic typing for type safety
- Compatible with React's `useState` API
- Persists to localStorage (web) or file storage (CLI)

## Testing Checklist

- [x] Type checking passes for modified components
- [x] State changes don't affect unrelated hooks
- [x] Default values are appropriate
- [x] Both components can be used independently
- [x] State keys don't conflict with other features

## Backward Compatibility

- No breaking changes to component APIs
- No new dependencies introduced
- Default values remain unchanged
- Setter function signatures identical to `useState`

## Storage Details

The underlying `useRouteState` hook manages storage:
- **Web:** localStorage with JSON serialization
- **CLI:** File-based storage in app data directory
- **Complex types:** Automatically handled (Map, objects, arrays)
- **Scope prefix:** Each view gets isolated state storage

## Performance Notes

- No additional renders compared to `useState`
- State retrieval is O(1) lookup from storage cache
- Serialization happens only on state changes
- No impact on component re-render performance
