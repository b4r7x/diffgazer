# Screen State Persistence Implementation for Review Feature

## Overview

Added `useScreenState` hook to CLI review components to persist user navigation state, selection indices, and UI preferences across screen transitions.

## Components Modified

### 1. ReviewSplitScreen
**File:** `/Users/voitz/Projects/stargazer/apps/cli/src/features/review/components/review-split-screen.tsx`

**State persisted:**
- `activeTab` (IssueTab) - Currently selected issue detail tab (details/explain/trace/patch)
- `focus` (FocusArea) - Which pane has keyboard focus (list/details/filters)
- `filterFocusedIndex` (number) - Which severity filter button is focused
- `activeFilter` (SeverityFilter) - Currently active severity filter (all/blocker/high/medium/low/nit)

**Impact:** Users can navigate between panes and filters, switch tabs, and when returning to the review screen, all their UI state is preserved.

**Changes:**
```typescript
// Before
const [activeTab, setActiveTab] = useState<IssueTab>("details");
const [focus, setFocus] = useState<FocusArea>("list");
const [filterFocusedIndex, setFilterFocusedIndex] = useState(0);
const [activeFilter, setActiveFilter] = useState<SeverityFilter>("all");

// After
const [activeTab, setActiveTab] = useScreenState<IssueTab>("activeTab", "details");
const [focus, setFocus] = useScreenState<FocusArea>("focus", "list");
const [filterFocusedIndex, setFilterFocusedIndex] = useScreenState<number>("filterFocusedIndex", 0);
const [activeFilter, setActiveFilter] = useScreenState<SeverityFilter>("activeFilter", "all");
```

### 2. ReviewScreen
**File:** `/Users/voitz/Projects/stargazer/apps/cli/src/features/review/components/review-screen.tsx`

**State persisted:**
- `selectedIndex` (number) - Currently selected issue in the list
- `issueStatuses` (Map<string, IssueStatus>) - Tracking ignored/applied states for each issue

**Impact:** When users navigate through the issue list, their selection is preserved. If they mark issues as ignored or applied, those states are remembered when returning to the screen.

**Changes:**
```typescript
// Before
const [selectedIndex, setSelectedIndex] = useState(0);
const [issueStatuses, setIssueStatuses] = useState(
  () => new Map<string, IssueStatus>()
);

// After
const [selectedIndex, setSelectedIndex] = useScreenState<number>("selectedIndex", 0);
const [issueStatuses, setIssueStatuses] = useScreenState<Map<string, IssueStatus>>(
  "issueStatuses",
  new Map<string, IssueStatus>()
);
```

### 3. ReviewDetailScreen
**File:** `/Users/voitz/Projects/stargazer/apps/cli/src/features/review/components/review-detail-screen.tsx`

**No changes:** This component only contains temporary UI state (feedback messages, loading indicators) that shouldn't persist beyond the current view session.

### 4. IssueDetailsPane
**File:** `/Users/voitz/Projects/stargazer/apps/cli/src/features/review/components/issue-details-pane.tsx`

**No changes needed:** The `activeTab` prop is managed by ReviewSplitScreen, which already persists it.

## How useScreenState Works

The `useScreenState` hook (from `/Users/voitz/Projects/stargazer/apps/cli/src/hooks/use-screen-state.ts`) automatically:

1. Scopes state to the current screen/view to prevent cross-screen pollution
2. Uses `useRouteState` internally to persist state in browser-like storage (localStorage equivalent in CLI)
3. Returns a setter function compatible with React's `useState` API

### Type Safety
All persisted state maintains full TypeScript typing:
- Generic type parameter ensures type safety
- Default values are properly typed
- Setter functions work with updater functions

## Testing Scenarios

### Scenario 1: Navigation Preservation
1. User navigates to issue 5 in the split-screen view
2. User switches to details pane (focus = "details")
3. User selects "trace" tab
4. User goes to a different screen
5. **Expected:** Returning to review shows issue 5 selected, focus on details, trace tab active

### Scenario 2: Filter State
1. User filters to show only "high" severity issues
2. User focuses on the filter buttons
3. User navigates to another screen
4. **Expected:** Returning to review shows high severity filter active with focus on filters

### Scenario 3: Issue Status Tracking
1. User marks an issue as ignored (press 'i')
2. User applies a fix to another issue (press 'a')
3. User navigates away and returns
4. **Expected:** Both issue status indicators [IGNORED] and [APPLIED] are still visible

## Benefits

1. **User Experience:** Users don't lose their place when navigating between screens
2. **Workflow Efficiency:** Complex review sessions maintain their state without manual restoration
3. **Consistency:** Same pattern applied across CLI views for predictable behavior
4. **Type Safety:** Full TypeScript typing prevents runtime errors

## Code Quality Notes

- **No new dependencies:** Uses existing `useScreenState` hook infrastructure
- **Minimal changes:** Only replaced `useState` with `useScreenState`, no logic changes
- **Backward compatible:** Default values remain the same
- **Consistent with codebase:** Follows pattern used in other CLI features (history, settings)
