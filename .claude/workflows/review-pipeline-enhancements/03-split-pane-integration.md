# Phase 3: Split-Pane Integration

## Overview

Upgrade review UI to show issue list and details simultaneously in a split-pane layout.

**Priority:** HIGH
**Dependencies:** Can run parallel with Phase 2

---

## Context

### What is Split-Pane?

Current flow: List → Click → Detail screen (separate view)
New flow: List (left) + Details (right) visible simultaneously

```
┌─────────────────────────┬────────────────────────────────────┐
│ Issues          [3]     │ ## SQL Injection Risk              │
├─────────────────────────┤ src/auth.ts:42-55     [HIGH][SEC]  │
│ > SQL Injection    HIGH │                                    │
│   Missing null     MED  │ ### Symptom                        │
│   N+1 query        LOW  │ User input passed directly to      │
│                         │ SQL query without sanitization.    │
│                         │                                    │
│                         │ ### Why It Matters                 │
│                         │ Attackers could extract or modify  │
│                         │ database contents.                 │
│                         │                                    │
│                         │ ### Fix Plan                       │
│                         │ 1. Use parameterized queries       │
│                         │ 2. Add input validation            │
└─────────────────────────┴────────────────────────────────────┘
 [j/k Move] [o Open] [a Apply] [i Ignore]     Gemini Flash 2.0
```

### Why Split-Pane?

- See context while navigating
- No screen transitions (faster)
- Professional feel (like IDE panels)
- Focus routing gives keyboard-only UX

---

## Existing Code References

Read these files first:
- `apps/cli/src/components/ui/split-pane.tsx` - If exists, use it
- `apps/cli/src/features/review/components/` - Existing review components
- `apps/cli/src/features/review/components/issue-item.tsx` - Issue list item
- `apps/cli/src/features/review/components/issue-details-pane.tsx` - If exists

---

## Agent 3.1: Review Split Screen Component

```
subagent_type: "react-component-architect"

Task: Create main split-pane review screen component.

Create: apps/cli/src/features/review/components/review-split-screen.tsx

IMPORTANT:
- Use SplitPane from components/ui if exists, otherwise create inline
- Handle focus state for styling (dim inactive panel)
- Support both menu and key mode navigation

Implementation:

import { Box, Text, useStdout } from 'ink';
import { useState, useCallback } from 'react';
import { IssueListPane } from './issue-list-pane';
import { IssueDetailsPane } from './issue-details-pane';
import { FooterBar } from '@/components/ui';
import { useReviewKeyboard } from '../hooks';
import { useSessionRecorder } from '@/hooks';
import type { TriageIssue, DrilldownResult } from '@repo/schemas';

type Focus = 'list' | 'details';
type Tab = 'details' | 'explain' | 'trace' | 'patch';

interface ReviewSplitScreenProps {
  issues: TriageIssue[];
  reviewId: string;
  onApplyPatch: (issueId: string) => Promise<void>;
  onIgnoreIssue: (issueId: string) => void;
  onDrilldown: (issueId: string) => Promise<DrilldownResult>;
  onBack: () => void;
  drilldownCache?: Map<string, DrilldownResult>;
}

export function ReviewSplitScreen({
  issues,
  reviewId,
  onApplyPatch,
  onIgnoreIssue,
  onDrilldown,
  onBack,
  drilldownCache = new Map(),
}: ReviewSplitScreenProps) {
  const { stdout } = useStdout();
  const terminalHeight = stdout?.rows ?? 24;
  const terminalWidth = stdout?.columns ?? 80;

  // State
  const [focus, setFocus] = useState<Focus>('list');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [activeTab, setActiveTab] = useState<Tab>('details');
  const [listScrollOffset, setListScrollOffset] = useState(0);
  const [detailsScrollOffset, setDetailsScrollOffset] = useState(0);

  // Session recording
  const { recordEvent } = useSessionRecorder();

  // Derived
  const selectedIssue = issues[selectedIndex] ?? null;
  const selectedDrilldown = selectedIssue
    ? drilldownCache.get(selectedIssue.id)
    : null;

  // Handlers
  const handleNavigate = useCallback((direction: 'up' | 'down') => {
    setSelectedIndex(prev => {
      const next = direction === 'up'
        ? Math.max(0, prev - 1)
        : Math.min(issues.length - 1, prev + 1);

      // Record event
      if (next !== prev && issues[next]) {
        recordEvent('OPEN_ISSUE', { reviewId, issueId: issues[next].id });
      }
      return next;
    });
  }, [issues, reviewId, recordEvent]);

  const handleOpen = useCallback(async () => {
    if (!selectedIssue) return;
    // Trigger drilldown if not cached
    if (!drilldownCache.has(selectedIssue.id)) {
      await onDrilldown(selectedIssue.id);
    }
    setFocus('details');
  }, [selectedIssue, drilldownCache, onDrilldown]);

  const handleApply = useCallback(async () => {
    if (!selectedIssue) return;
    await onApplyPatch(selectedIssue.id);
    recordEvent('APPLY_PATCH', { reviewId, issueId: selectedIssue.id });
  }, [selectedIssue, onApplyPatch, reviewId, recordEvent]);

  const handleIgnore = useCallback(() => {
    if (!selectedIssue) return;
    onIgnoreIssue(selectedIssue.id);
    recordEvent('IGNORE_ISSUE', { reviewId, issueId: selectedIssue.id });
  }, [selectedIssue, onIgnoreIssue, reviewId, recordEvent]);

  const handleToggleFocus = useCallback(() => {
    setFocus(prev => prev === 'list' ? 'details' : 'list');
  }, []);

  const handleCycleTab = useCallback(() => {
    const tabs: Tab[] = ['details', 'explain', 'trace', 'patch'];
    setActiveTab(prev => {
      const idx = tabs.indexOf(prev);
      const next = tabs[(idx + 1) % tabs.length];
      recordEvent('TOGGLE_VIEW', { tab: next });
      return next;
    });
  }, [recordEvent]);

  const handleShowTab = useCallback((tab: Tab) => {
    setActiveTab(tab);
    recordEvent('TOGGLE_VIEW', { tab });
  }, [recordEvent]);

  // Keyboard handling
  useReviewKeyboard({
    focus,
    onNavigate: handleNavigate,
    onOpen: handleOpen,
    onApply: handleApply,
    onIgnore: handleIgnore,
    onShowTab: handleShowTab,
    onCycleTab: handleCycleTab,
    onToggleFocus: handleToggleFocus,
    onBack,
    onScroll: (dir) => setDetailsScrollOffset(prev =>
      dir === 'down' ? prev + 1 : Math.max(0, prev - 1)
    ),
  });

  // Layout
  const headerHeight = 3;
  const footerHeight = 2;
  const contentHeight = terminalHeight - headerHeight - footerHeight;
  const listWidth = Math.floor(terminalWidth * 0.4);
  const detailsWidth = terminalWidth - listWidth - 1; // -1 for border

  return (
    <Box flexDirection="column" height={terminalHeight}>
      {/* Header */}
      <Box borderStyle="round" paddingX={1}>
        <Text bold>Review</Text>
        <Text> - {issues.length} issues</Text>
      </Box>

      {/* Content: Split Pane */}
      <Box flexDirection="row" height={contentHeight}>
        {/* Left: Issue List */}
        <Box
          width={listWidth}
          borderStyle="single"
          borderColor={focus === 'list' ? 'cyan' : 'gray'}
        >
          <IssueListPane
            issues={issues}
            selectedIndex={selectedIndex}
            scrollOffset={listScrollOffset}
            onScrollOffsetChange={setListScrollOffset}
            height={contentHeight - 2}
            focused={focus === 'list'}
          />
        </Box>

        {/* Right: Details */}
        <Box
          flexGrow={1}
          borderStyle="single"
          borderColor={focus === 'details' ? 'cyan' : 'gray'}
        >
          <IssueDetailsPane
            issue={selectedIssue}
            drilldown={selectedDrilldown}
            activeTab={activeTab}
            onTabChange={setActiveTab}
            scrollOffset={detailsScrollOffset}
            height={contentHeight - 2}
            focused={focus === 'details'}
          />
        </Box>
      </Box>

      {/* Footer */}
      <FooterBar
        menuShortcuts={[
          { key: '↑/↓', label: 'Move' },
          { key: 'Enter', label: 'Details' },
          { key: 'Tab', label: 'Switch' },
          { key: 'Esc', label: 'Back' },
        ]}
        keyShortcuts={[
          { key: 'j/k', label: 'Move' },
          { key: 'o', label: 'Open' },
          { key: 'a', label: 'Apply' },
          { key: 'i', label: 'Ignore' },
          { key: 'e/t', label: 'Explain/Trace' },
        ]}
      />
    </Box>
  );
}

Steps:
1. Read existing components
2. Create review-split-screen.tsx
3. Export from index.ts
4. Run: npm run type-check

Output: Split-pane review screen
```

---

## Agent 3.2: Issue List Pane

```
subagent_type: "react-component-architect"

Task: Create issue list pane with virtual scrolling.

Create: apps/cli/src/features/review/components/issue-list-pane.tsx

IMPORTANT:
- Virtual scrolling: Only render visible items
- Auto-scroll to keep selection visible
- Show severity counts in header

Implementation:

import { Box, Text } from 'ink';
import { useMemo } from 'react';
import { Badge } from '@/components/ui';
import type { TriageIssue } from '@repo/schemas';

interface IssueListPaneProps {
  issues: TriageIssue[];
  selectedIndex: number;
  scrollOffset: number;
  onScrollOffsetChange: (offset: number) => void;
  height: number;
  focused: boolean;
}

export function IssueListPane({
  issues,
  selectedIndex,
  scrollOffset,
  onScrollOffsetChange,
  height,
  focused,
}: IssueListPaneProps) {
  // Calculate visible window
  const visibleCount = height - 2; // -2 for header

  // Auto-scroll to keep selection visible
  useMemo(() => {
    if (selectedIndex < scrollOffset) {
      onScrollOffsetChange(selectedIndex);
    } else if (selectedIndex >= scrollOffset + visibleCount) {
      onScrollOffsetChange(selectedIndex - visibleCount + 1);
    }
  }, [selectedIndex, scrollOffset, visibleCount, onScrollOffsetChange]);

  // Visible slice
  const visibleIssues = issues.slice(scrollOffset, scrollOffset + visibleCount);

  // Severity counts
  const counts = useMemo(() => {
    const c = { blocker: 0, high: 0, medium: 0, low: 0, nit: 0 };
    issues.forEach(i => c[i.severity]++);
    return c;
  }, [issues]);

  return (
    <Box flexDirection="column" paddingX={1}>
      {/* Header */}
      <Box>
        <Text bold>{issues.length} issues </Text>
        {counts.blocker > 0 && <Text color="red">{counts.blocker}B </Text>}
        {counts.high > 0 && <Text color="yellow">{counts.high}H </Text>}
        {counts.medium > 0 && <Text color="blue">{counts.medium}M </Text>}
      </Box>
      <Box marginBottom={1}><Text dimColor>────────────────────</Text></Box>

      {/* Issue list */}
      {visibleIssues.map((issue, i) => {
        const actualIndex = scrollOffset + i;
        const isSelected = actualIndex === selectedIndex;

        return (
          <Box key={issue.id}>
            <Text
              inverse={isSelected && focused}
              bold={isSelected}
              dimColor={!focused && !isSelected}
            >
              {isSelected ? '>' : ' '}
              <Badge type="severity" value={issue.severity} />
              {' '}
              {truncate(issue.title, 25)}
            </Text>
          </Box>
        );
      })}

      {/* Scroll indicator */}
      {issues.length > visibleCount && (
        <Box marginTop={1}>
          <Text dimColor>
            {scrollOffset + 1}-{Math.min(scrollOffset + visibleCount, issues.length)}/{issues.length}
          </Text>
        </Box>
      )}
    </Box>
  );
}

function truncate(str: string, len: number): string {
  return str.length > len ? str.slice(0, len - 1) + '…' : str;
}

Steps:
1. Create issue-list-pane.tsx
2. Export from index.ts
3. Run: npm run type-check

Output: Issue list pane with virtual scrolling
```

---

## Agent 3.3: Issue Details Pane

```
subagent_type: "react-component-architect"

Task: Create issue details pane with tabbed content.

Create: apps/cli/src/features/review/components/issue-details-pane.tsx

Implementation:

import { Box, Text } from 'ink';
import { Badge } from '@/components/ui';
import { IssueBodyDetails } from './issue-body-details';
import { IssueBodyExplain } from './issue-body-explain';
import { IssueBodyTrace } from './issue-body-trace';
import { IssueBodyPatch } from './issue-body-patch';
import type { TriageIssue, DrilldownResult } from '@repo/schemas';

type Tab = 'details' | 'explain' | 'trace' | 'patch';

interface IssueDetailsPaneProps {
  issue: TriageIssue | null;
  drilldown: DrilldownResult | null;
  activeTab: Tab;
  onTabChange: (tab: Tab) => void;
  scrollOffset: number;
  height: number;
  focused: boolean;
}

export function IssueDetailsPane({
  issue,
  drilldown,
  activeTab,
  onTabChange,
  scrollOffset,
  height,
  focused,
}: IssueDetailsPaneProps) {
  if (!issue) {
    return (
      <Box flexDirection="column" paddingX={1} justifyContent="center" alignItems="center" height={height}>
        <Text dimColor>Select an issue from the list</Text>
        <Text dimColor>Use j/k or arrows to navigate</Text>
      </Box>
    );
  }

  const tabs: Tab[] = ['details', 'explain', 'trace', 'patch'];
  const contentHeight = height - 6; // Header + tabs + padding

  return (
    <Box flexDirection="column" paddingX={1}>
      {/* Header */}
      <Box>
        <Text bold>{issue.title}</Text>
      </Box>
      <Box>
        <Badge type="severity" value={issue.severity} />
        <Text> </Text>
        <Badge type="category" value={issue.category} />
        <Text dimColor> {issue.location?.file}:{issue.location?.lineStart}</Text>
      </Box>

      {/* Tab bar */}
      <Box marginY={1}>
        {tabs.map((tab, i) => (
          <Text key={tab}>
            {i > 0 && <Text dimColor> | </Text>}
            <Text
              bold={activeTab === tab}
              underline={activeTab === tab}
              dimColor={!focused && activeTab !== tab}
            >
              {tab.charAt(0).toUpperCase() + tab.slice(1)}
            </Text>
          </Text>
        ))}
      </Box>

      {/* Tab content */}
      <Box flexDirection="column" height={contentHeight}>
        {activeTab === 'details' && (
          <IssueBodyDetails
            issue={issue}
            drilldown={drilldown}
            scrollOffset={scrollOffset}
            height={contentHeight}
          />
        )}
        {activeTab === 'explain' && (
          <IssueBodyExplain
            evidence={issue.evidence}
            scrollOffset={scrollOffset}
            height={contentHeight}
          />
        )}
        {activeTab === 'trace' && (
          <IssueBodyTrace
            trace={drilldown?.trace}
            scrollOffset={scrollOffset}
            height={contentHeight}
          />
        )}
        {activeTab === 'patch' && (
          <IssueBodyPatch
            patch={drilldown?.patch ?? issue.suggestedPatch}
            scrollOffset={scrollOffset}
            height={contentHeight}
          />
        )}
      </Box>
    </Box>
  );
}

Steps:
1. Create issue-details-pane.tsx
2. Create or update body components (details, explain, trace, patch)
3. Export from index.ts
4. Run: npm run type-check

Output: Issue details pane with tabs
```

---

## Agent 3.4: Integrate into Review View

```
subagent_type: "react-component-architect"

Task: Replace existing review display with split-pane.

Modify: apps/cli/src/app/views/review-view.tsx

Changes:
1. Replace current component with ReviewSplitScreen
2. Wire up all handlers
3. Manage drilldown cache

Example:

import { useState, useCallback } from 'react';
import { ReviewSplitScreen } from '@/features/review/components';
import { useTriage } from '@/features/review/hooks';
import { triggerDrilldown } from '@/features/review/api';
import type { DrilldownResult } from '@repo/schemas';

interface ReviewViewProps {
  onBack: () => void;
  // ... other props
}

export function ReviewView({ onBack }: ReviewViewProps) {
  const { data, status, reviewId } = useTriage({ ... });
  const [drilldownCache, setDrilldownCache] = useState<Map<string, DrilldownResult>>(new Map());

  const handleDrilldown = useCallback(async (issueId: string) => {
    if (drilldownCache.has(issueId)) {
      return drilldownCache.get(issueId)!;
    }

    const result = await triggerDrilldown({ reviewId, issueId });
    if (result.ok) {
      setDrilldownCache(prev => new Map(prev).set(issueId, result.value));
      return result.value;
    }
    throw result.error;
  }, [reviewId, drilldownCache]);

  const handleApplyPatch = useCallback(async (issueId: string) => {
    // Existing patch apply logic
  }, []);

  const handleIgnoreIssue = useCallback((issueId: string) => {
    // Mark as ignored in local state or API
  }, []);

  if (status === 'loading') {
    return <LoadingView />;
  }

  if (status === 'error' || !data) {
    return <ErrorView />;
  }

  return (
    <ReviewSplitScreen
      issues={data.issues}
      reviewId={reviewId}
      onApplyPatch={handleApplyPatch}
      onIgnoreIssue={handleIgnoreIssue}
      onDrilldown={handleDrilldown}
      onBack={onBack}
      drilldownCache={drilldownCache}
    />
  );
}

Steps:
1. Read existing review-view.tsx
2. Integrate ReviewSplitScreen
3. Wire handlers
4. Run: npm run type-check
5. Manual test: Full split-pane experience

Output: Split-pane integrated into app
```

---

## Validation Checklist

After completing all agents:

- [ ] `npm run type-check` passes
- [ ] Split-pane shows list and details simultaneously
- [ ] Selection in list updates details immediately
- [ ] Virtual scrolling works for long issue lists
- [ ] Tab switching works in details pane
- [ ] Focus styling shows active panel
- [ ] Keyboard navigation works in both panels

### Visual Check

```
Expected layout:
┌─────────────────────────┬────────────────────────────────────┐
│ 5 issues  1B 2H 2M      │ ## SQL Injection Risk              │
├─────────────────────────┤ src/auth.ts:42-55     [HIGH][SEC]  │
│ > SQL Injection    HIGH │ ─────────────────────────────────  │
│   Missing null     MED  │ Details | Explain | Trace | Patch  │
│   N+1 query        LOW  │ ─────────────────────────────────  │
│   Dead code        NIT  │ ### Symptom                        │
│   Style issue      NIT  │ User input passed directly...      │
│                         │                                    │
│ 1-5/5                   │ ### Why It Matters                 │
└─────────────────────────┴────────────────────────────────────┘
```
