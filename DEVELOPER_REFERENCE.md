# Developer Reference: useScreenState in Review Components

## Quick Reference

### What Was Added
Screen-scoped state persistence to 2 review components using the existing `useScreenState` hook.

### Where to Find It
- **Hook:** `/Users/voitz/Projects/stargazer/apps/cli/src/hooks/use-screen-state.ts`
- **Components Modified:**
  - `/Users/voitz/Projects/stargazer/apps/cli/src/features/review/components/review-split-screen.tsx`
  - `/Users/voitz/Projects/stargazer/apps/cli/src/features/review/components/review-screen.tsx`

## Component State Map

### ReviewSplitScreen
The main dual-pane review interface. Persists all UI state related to the split-screen layout.

```typescript
// State keys and their purposes
{
  "activeTab": "details" | "explain" | "trace" | "patch",
    // Which issue detail tab is currently shown
    // Allows users to compare multiple views of same issue

  "focus": "list" | "details" | "filters",
    // Which pane has keyboard focus
    // Controls where user input is routed

  "filterFocusedIndex": 0-4,
    // Which severity filter button has focus
    // Enables keyboard-only navigation of filters

  "activeFilter": "all" | "blocker" | "high" | "medium" | "low" | "nit"
    // Which severity filter is active
    // Enables focused review workflows
}
```

**Usage Context:**
- Used in interactive review workflows
- Supports power-user navigation patterns
- Essential for long review sessions

### ReviewScreen
The sequential issue list interface. Persists selection and status tracking.

```typescript
// State keys and their purposes
{
  "selectedIndex": number,
    // Index of currently selected issue in list
    // Allows resume from same position

  "issueStatuses": Map<string, { ignored: boolean, applied: boolean }>,
    // Tracks status of each issue by ID
    // Provides visual feedback on work completed
}
```

**Usage Context:**
- Used in simpler review flows
- Good for initial triage workflows
- Lightweight alternative to split-screen

## Adding More Persisted State

### Pattern: Adding a New Persisted State Variable

```typescript
// Step 1: Identify the component
// Step 2: Change this:
const [myState, setMyState] = useState<MyType>(defaultValue);

// To this:
const [myState, setMyState] = useScreenState<MyType>("myState", defaultValue);

// Step 3: Add import if not present:
import { useScreenState } from "../../../hooks/use-screen-state.js";

// That's it! State is now persisted
```

### Guidelines for State Keys

1. **Keep keys descriptive:** `"activeTab"` not `"tab"`
2. **Use camelCase:** `"filterFocusedIndex"` not `"filter_focused_index"`
3. **No special characters:** Just alphanumeric + camelCase
4. **Unique per component:** Keys are scoped by screen automatically
5. **Document the values:** Add TSDoc if enum-like

### When to Use useScreenState

✓ **Do use for:**
- Navigation selection (which item is selected)
- UI preferences (active tab, pane focus)
- Filters and view settings
- Visibility states (expanded/collapsed)
- Any state that should survive screen navigation

✗ **Don't use for:**
- Temporary feedback messages
- Loading spinners
- Form validation states
- Data that comes from props
- Synchronous status updates

## Testing Persisted State

### Manual Testing
```bash
# 1. Start CLI review
npm run dev -w @repo/cli

# 2. Test ReviewSplitScreen persistence
# - Navigate to issue 3
# - Switch to "trace" tab
# - Focus on details pane
# - Navigate to another screen
# - Return to review
# - Verify: Same issue, trace tab, details focus

# 3. Test ReviewScreen persistence
# - Select issue 5
# - Mark issues as ignored
# - Navigate away
# - Return to review
# - Verify: Same issue, [IGNORED] badges visible
```

### Automated Testing

To test state persistence in unit tests:

```typescript
// Test that state persists
test("activeTab persists across renders", () => {
  const { rerender } = render(<ReviewSplitScreen {...props} />);

  // Change tab
  fireEvent.click(screen.getByText("Trace"));

  // Force re-render
  rerender(<ReviewSplitScreen {...props} />);

  // Verify tab still selected
  expect(screen.getByText("Trace")).toHaveClass("active");
});
```

## Debugging State Issues

### Check Storage
```typescript
// In browser console (web app)
localStorage.getItem("review:activeTab")

// In CLI, check the state hook directly
const [state] = useScreenState("activeTab", "details");
console.log("Current tab:", state);
```

### Common Issues

**Issue:** State not persisting
- **Check:** Is the state scoped correctly? Look at screen name in useScreenContext()
- **Solution:** Verify useScreenState is being used, not useState

**Issue:** State persisting between different reviews
- **Check:** State is being used in same screen
- **Solution:** This is correct behavior - state is scoped by screen, not by data

**Issue:** Map state not persisting
- **Check:** Make sure to use new Map() for default
- **Solution:** useRouteState can serialize Maps automatically

## TypeScript Tips

### Generic Type Parameters

```typescript
// Correct: Specify all type parameters
const [state, setState] = useScreenState<IssueTab>("key", "details");

// Also correct: Type inference from default value
const [state, setState] = useScreenState("key", "details" as const);

// Less clear: No type hint
const [state, setState] = useScreenState("key", "details");
```

### With Enums

```typescript
enum MyTab {
  Details = "details",
  Trace = "trace",
}

// Good: Explicit enum type
const [activeTab, setActiveTab] = useScreenState<MyTab>("activeTab", MyTab.Details);

// Also works: Inferred from default
const [activeTab, setActiveTab] = useScreenState("activeTab", MyTab.Details);
```

### With Union Types

```typescript
type FocusArea = "list" | "details" | "filters";

const [focus, setFocus] = useScreenState<FocusArea>("focus", "list");
```

## Performance Considerations

- **No additional renders:** useScreenState doesn't cause extra renders
- **Lazy loading:** State is loaded on first use, not on component mount
- **Memory efficient:** Uses existing storage infrastructure
- **Serialization:** Only happens on state change, cached otherwise

## Related Code

### Hook Implementation
File: `apps/cli/src/hooks/use-screen-state.ts`
- Wraps useRouteState with automatic screen scoping
- Full TypeScript generics support

### Storage Backend
Package: `@repo/hooks`
- Provides useRouteState hook
- Handles localStorage/file persistence
- Manages serialization

### Review Components
Directory: `apps/cli/src/features/review/`
- Interactive review app uses both ReviewSplitScreen and ReviewScreen
- Each maintains independent state spaces
- No cross-component state conflicts

## Checklist: Adding useScreenState to New Component

- [ ] Identify state variables to persist
- [ ] Add import: `import { useScreenState } from "..."`
- [ ] Replace useState with useScreenState
- [ ] Provide descriptive key name (camelCase)
- [ ] Ensure default value matches type
- [ ] Test state persists across navigation
- [ ] Verify no type errors with `npm run type-check`
- [ ] Add comment explaining why state is persisted
- [ ] Update this reference if pattern differs

## References

- **Feature Branch:** `feature/review-bounding`
- **Related Task:** Add useRouteState persistence to CLI views
- **Documentation:** See SCREEN_STATE_PERSISTENCE_SUMMARY.md
- **User Experience:** See USER_EXPERIENCE_IMPROVEMENTS.md
