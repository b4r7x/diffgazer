# Phase 4: Split-Pane Review UI

## Problem

Per gpt-convo.md (lines 1893-1924), review should have two-column layout:
- Left: Issue list with filters
- Right: Issue details with tabs

Current implementation is basic single-column display.

---

## Target Component Structure

```
<ReviewScreen/>
├─ <ReviewSplitScreen/>
│    ├─ <SplitPane/>
│    │    ├─ Left: <IssueListPane/>
│    │    │    ├─ <IssueListHeader/> (filtry, search, counts)
│    │    │    └─ <IssueList/> (virtual slice + selection)
│    │    └─ Right: <IssueDetailsPane/>
│    │         ├─ <IssueHeader/> (title + badges + location)
│    │         ├─ <IssueTabs/> (Details/Explain/Trace/Patch)
│    │         └─ <IssueBody/>
│    └─ <FooterBar/>
```

---

## Task 4.1: Create SplitPane Component

**File:** `apps/cli/src/components/ui/split-pane.tsx`

```typescript
interface SplitPaneProps {
  left: ReactNode;
  right: ReactNode;
  leftWidth?: number | string; // e.g., "40%" or 40
  gap?: number;
  minWidth?: number; // collapse to stack below this
}

export function SplitPane({
  left,
  right,
  leftWidth = "40%",
  gap = 1,
  minWidth = 80,
}: SplitPaneProps) {
  const { stdout } = useStdout();
  const columns = stdout?.columns ?? 120;

  const isNarrow = columns < minWidth;

  if (isNarrow) {
    // Stack layout for narrow terminals
    return (
      <Box flexDirection="column" gap={gap}>
        {left}
        {right}
      </Box>
    );
  }

  return (
    <Box flexDirection="row" gap={gap}>
      <Box width={leftWidth} flexShrink={0}>
        {left}
      </Box>
      <Box flexGrow={1}>
        {right}
      </Box>
    </Box>
  );
}
```

---

## Task 4.2: Create IssueListPane

**File:** `apps/cli/src/features/review/components/issue-list-pane.tsx`

```typescript
interface IssueListPaneProps {
  issues: Issue[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  filters: FilterState;
  onFilterChange: (filters: FilterState) => void;
  focus: "list" | "details";
  scrollOffset: number;
  onScrollChange: (offset: number) => void;
}

interface FilterState {
  severity: Severity | "all";
  lens: string | "all";
  status: IssueStatus | "all";
  search: string;
}

export function IssueListPane({...}: IssueListPaneProps) {
  const visibleRows = 15; // Calculate from terminal height

  const filteredIssues = filterIssues(issues, filters);
  const visibleIssues = filteredIssues.slice(
    scrollOffset,
    scrollOffset + visibleRows
  );

  return (
    <Box flexDirection="column" borderStyle="single" height="100%">
      <IssueListHeader
        totalCount={issues.length}
        filteredCount={filteredIssues.length}
        filters={filters}
        onFilterChange={onFilterChange}
      />

      <Box flexDirection="column" paddingX={1}>
        {visibleIssues.map((issue, idx) => (
          <IssueListItem
            key={issue.id}
            issue={issue}
            isSelected={issue.id === selectedId}
            index={scrollOffset + idx + 1}
          />
        ))}
      </Box>

      {filteredIssues.length > visibleRows && (
        <Text dimColor>
          {scrollOffset + 1}-{Math.min(scrollOffset + visibleRows, filteredIssues.length)}
          of {filteredIssues.length}
        </Text>
      )}
    </Box>
  );
}
```

---

## Task 4.3: Create IssueListHeader

**File:** `apps/cli/src/features/review/components/issue-list-header.tsx`

```typescript
interface IssueListHeaderProps {
  totalCount: number;
  filteredCount: number;
  filters: FilterState;
  onFilterChange: (filters: FilterState) => void;
}

export function IssueListHeader({...}: IssueListHeaderProps) {
  return (
    <Box
      flexDirection="row"
      justifyContent="space-between"
      borderStyle="single"
      borderBottom
      paddingX={1}
    >
      <Text bold>Issues ({filteredCount}/{totalCount})</Text>
      <Box gap={1}>
        {filters.severity !== "all" && (
          <Badge text={filters.severity} variant="warning" />
        )}
        {filters.lens !== "all" && (
          <Badge text={filters.lens} variant="info" />
        )}
      </Box>
    </Box>
  );
}
```

---

## Task 4.4: Create IssueDetailsPane

**File:** `apps/cli/src/features/review/components/issue-details-pane.tsx`

```typescript
type TabId = "details" | "explain" | "trace" | "patch";

interface IssueDetailsPaneProps {
  issue: Issue | null;
  activeTab: TabId;
  onTabChange: (tab: TabId) => void;
  focus: "list" | "details";
  scrollOffset: number;
  onScrollChange: (offset: number) => void;
}

export function IssueDetailsPane({...}: IssueDetailsPaneProps) {
  if (!issue) {
    return (
      <Box borderStyle="single" padding={1}>
        <Text dimColor>Select an issue to view details</Text>
      </Box>
    );
  }

  return (
    <Box flexDirection="column" borderStyle="single">
      {/* Header */}
      <Box paddingX={1} paddingY={0}>
        <Text bold>{issue.title}</Text>
        <Box gap={1}>
          <Badge text={issue.severity} variant={severityVariant(issue.severity)} />
          <Badge text={issue.category} variant="info" />
        </Box>
      </Box>

      {/* Location */}
      <Box paddingX={1}>
        <Text dimColor>{issue.location.file}:{issue.location.lineStart}</Text>
      </Box>

      {/* Tabs */}
      <IssueTabs activeTab={activeTab} onTabChange={onTabChange} issue={issue} />

      {/* Content */}
      <Box flexGrow={1} paddingX={1} overflow="hidden">
        {activeTab === "details" && <IssueBodyDetails issue={issue} />}
        {activeTab === "explain" && <IssueBodyExplain issue={issue} />}
        {activeTab === "trace" && <IssueBodyTrace issue={issue} />}
        {activeTab === "patch" && <IssueBodyPatch issue={issue} />}
      </Box>
    </Box>
  );
}
```

---

## Task 4.5: Create IssueTabs

**File:** `apps/cli/src/features/review/components/issue-tabs.tsx`

```typescript
interface IssueTabsProps {
  activeTab: TabId;
  onTabChange: (tab: TabId) => void;
  issue: Issue;
}

const TABS: { id: TabId; label: string; key: string }[] = [
  { id: "details", label: "Details", key: "1" },
  { id: "explain", label: "Explain", key: "2" },
  { id: "trace", label: "Trace", key: "3" },
  { id: "patch", label: "Patch", key: "4" },
];

export function IssueTabs({ activeTab, onTabChange, issue }: IssueTabsProps) {
  return (
    <Box borderStyle="single" borderTop borderBottom paddingX={1}>
      {TABS.map((tab) => {
        const isActive = tab.id === activeTab;
        const isDisabled = tab.id === "patch" && !issue.suggestedPatch;

        return (
          <Box key={tab.id} marginRight={2}>
            <Text
              bold={isActive}
              dimColor={isDisabled}
              inverse={isActive}
            >
              [{tab.key}] {tab.label}
            </Text>
          </Box>
        );
      })}
    </Box>
  );
}
```

---

## Task 4.6: Create ReviewSplitScreen

**File:** `apps/cli/src/features/review/components/review-split-screen.tsx`

```typescript
interface ReviewSplitScreenProps {
  issues: Issue[];
  onApplyPatch: (issueId: string) => void;
  onIgnore: (issueId: string) => void;
  onBack: () => void;
}

export function ReviewSplitScreen({
  issues,
  onApplyPatch,
  onIgnore,
  onBack,
}: ReviewSplitScreenProps) {
  const [state, dispatch] = useReducer(reviewReducer, initialState);

  // Keyboard handling
  useReviewKeyboard(state, dispatch, issues, {
    onApplyPatch,
    onIgnore,
    onBack,
  });

  const selectedIssue = issues.find(i => i.id === state.selectedIssueId) ?? null;

  return (
    <Box flexDirection="column" height="100%">
      <SplitPane
        left={
          <IssueListPane
            issues={issues}
            selectedId={state.selectedIssueId}
            onSelect={(id) => dispatch({ type: "SELECT_ISSUE", id })}
            filters={state.filters}
            onFilterChange={(f) => dispatch({ type: "SET_FILTERS", filters: f })}
            focus={state.focus}
            scrollOffset={state.scrollOffsets.list}
            onScrollChange={(o) => dispatch({ type: "SET_LIST_SCROLL", offset: o })}
          />
        }
        right={
          <IssueDetailsPane
            issue={selectedIssue}
            activeTab={state.viewTab}
            onTabChange={(t) => dispatch({ type: "SET_TAB", tab: t })}
            focus={state.focus}
            scrollOffset={state.scrollOffsets.details}
            onScrollChange={(o) => dispatch({ type: "SET_DETAILS_SCROLL", offset: o })}
          />
        }
      />

      <FooterBar
        shortcuts={getShortcuts(state.focus, state.viewTab)}
      />
    </Box>
  );
}
```

---

## Task 4.7: Create useReviewKeyboard Hook

**File:** `apps/cli/src/features/review/hooks/use-review-keyboard.ts`

```typescript
export function useReviewKeyboard(
  state: ReviewState,
  dispatch: Dispatch<ReviewAction>,
  issues: Issue[],
  handlers: {
    onApplyPatch: (id: string) => void;
    onIgnore: (id: string) => void;
    onBack: () => void;
  }
) {
  useInput((input, key) => {
    if (state.focus === "list") {
      // Navigation
      if (input === "j" || key.downArrow) {
        dispatch({ type: "MOVE_SELECTION", direction: 1 });
      }
      if (input === "k" || key.upArrow) {
        dispatch({ type: "MOVE_SELECTION", direction: -1 });
      }

      // Actions
      if (key.return || input === "o") {
        dispatch({ type: "OPEN_ISSUE" });
      }
      if (input === "e") {
        dispatch({ type: "SET_TAB", tab: "explain" });
      }
      if (input === "t") {
        dispatch({ type: "SET_TAB", tab: "trace" });
      }
      if (input === "a") {
        if (state.selectedIssueId) {
          handlers.onApplyPatch(state.selectedIssueId);
        }
      }
      if (input === "i") {
        if (state.selectedIssueId) {
          handlers.onIgnore(state.selectedIssueId);
        }
      }

      // Focus
      if (key.tab) {
        dispatch({ type: "SET_FOCUS", focus: "details" });
      }
      if (key.escape) {
        handlers.onBack();
      }
    }

    if (state.focus === "details") {
      // Scroll
      if (input === "j" || key.downArrow) {
        dispatch({ type: "SCROLL_DETAILS", direction: 1 });
      }
      if (input === "k" || key.upArrow) {
        dispatch({ type: "SCROLL_DETAILS", direction: -1 });
      }

      // Tab navigation
      if (key.tab) {
        dispatch({ type: "NEXT_TAB" });
      }
      if (input === "1") dispatch({ type: "SET_TAB", tab: "details" });
      if (input === "2") dispatch({ type: "SET_TAB", tab: "explain" });
      if (input === "3") dispatch({ type: "SET_TAB", tab: "trace" });
      if (input === "4") dispatch({ type: "SET_TAB", tab: "patch" });

      // Back to list
      if (key.escape) {
        dispatch({ type: "SET_FOCUS", focus: "list" });
      }
    }
  });
}
```

---

## Task 4.8: Update review-view.tsx

**File:** `apps/cli/src/app/views/review-view.tsx`

Replace simple display with ReviewSplitScreen:
```typescript
export function ReviewView({ state, staged }: ReviewViewProps) {
  if (state.status === "loading") {
    return <LoadingView message="Running review..." />;
  }

  if (state.status === "error") {
    return <ErrorView error={state.error} />;
  }

  return (
    <ReviewSplitScreen
      issues={state.data?.issues ?? []}
      onApplyPatch={handleApplyPatch}
      onIgnore={handleIgnore}
      onBack={handleBack}
    />
  );
}
```

---

## Validation

Test:
1. Run review with multiple issues
2. Navigate with j/k
3. Tab between list and details
4. Switch tabs with 1/2/3/4
5. Apply patch with 'a'
6. Ignore with 'i'
7. Narrow terminal → should stack vertically
