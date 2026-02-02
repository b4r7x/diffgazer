# Ink Component Specifications for CLI Review Mirror

Design specifications for mirroring web review components to Ink CLI.

## Color Mapping Reference

| Web Class | Ink Property |
|-----------|--------------|
| `text-tui-cyan` | `color="cyan"` or `colors.ui.accent` |
| `text-tui-violet` | `color="magenta"` or `colors.severity.high` |
| `text-tui-green` | `color="green"` or `colors.ui.success` |
| `text-tui-red` | `color="red"` or `colors.ui.error` |
| `text-muted` / `gray-400` | `dimColor` or `colors.ui.textMuted` |
| `bg-*` with text | `inverse={true}` |

---

## 1. ReviewSummaryView

Summary screen displayed between loading and results.

### Props Interface

```typescript
import type { ReactElement } from "react";

export type SeverityLevel = "blocker" | "high" | "medium" | "low" | "nit";

export interface ReviewSummaryStats {
  runId: string;
  totalIssues: number;
  filesAnalyzed: number;
  criticalCount: number;
}

export interface SeverityCounts {
  blocker: number;
  high: number;
  medium: number;
  low: number;
  nit: number;
}

export interface IssuePreview {
  id: string;
  title: string;
  file: string;
  line: number;
  severity: SeverityLevel;
  category: string;
}

export interface ReviewSummaryViewProps {
  stats: ReviewSummaryStats;
  severityCounts: SeverityCounts;
  topIssues: IssuePreview[];
  focusedButton: "start" | "back";
  onStart: () => void;
  onBack: () => void;
}
```

### JSX Structure

```tsx
import { Box, Text, useInput } from "ink";
import { useTheme } from "../../hooks/use-theme.js";
import { Card, CardSection } from "../ui/card.js";
import { SeverityBar } from "../ui/severity-bar.js";
import { IssuePreviewItem } from "../ui/issue-preview-item.js";
import { Button } from "../ui/button.js";
import { KeyboardHint } from "../ui/keyboard-hint.js";

export function ReviewSummaryView({
  stats,
  severityCounts,
  topIssues,
  focusedButton,
  onStart,
  onBack,
}: ReviewSummaryViewProps): ReactElement {
  const { colors } = useTheme();

  useInput((input, key) => {
    if (key.return) {
      if (focusedButton === "start") onStart();
      else onBack();
    }
    if (key.escape) {
      onBack();
    }
  });

  const maxCount = Math.max(
    severityCounts.blocker,
    severityCounts.high,
    severityCounts.medium,
    severityCounts.low,
    severityCounts.nit,
    1
  );

  return (
    <Box flexDirection="column" padding={1}>
      {/* Header */}
      <Box marginBottom={1}>
        <Text bold color={colors.ui.accent}>
          Review Summary
        </Text>
      </Box>

      {/* Stats Row */}
      <Card title="Overview">
        <Box flexDirection="row" gap={4}>
          <Box flexDirection="column">
            <Text dimColor>Run ID</Text>
            <Text color={colors.ui.text}>{stats.runId.slice(0, 8)}</Text>
          </Box>
          <Box flexDirection="column">
            <Text dimColor>Total Issues</Text>
            <Text color={colors.ui.accent} bold>
              {stats.totalIssues}
            </Text>
          </Box>
          <Box flexDirection="column">
            <Text dimColor>Files Analyzed</Text>
            <Text>{stats.filesAnalyzed}</Text>
          </Box>
          <Box flexDirection="column">
            <Text dimColor>Critical</Text>
            <Text color={colors.ui.error} bold>
              {stats.criticalCount}
            </Text>
          </Box>
        </Box>
      </Card>

      {/* Severity Breakdown */}
      <Box marginTop={1}>
        <Card title="Severity Breakdown">
          <Box flexDirection="column" gap={0}>
            <SeverityBar label="Blocker" count={severityCounts.blocker} max={maxCount} severity="blocker" />
            <SeverityBar label="High" count={severityCounts.high} max={maxCount} severity="high" />
            <SeverityBar label="Medium" count={severityCounts.medium} max={maxCount} severity="medium" />
            <SeverityBar label="Low" count={severityCounts.low} max={maxCount} severity="low" />
            <SeverityBar label="Nit" count={severityCounts.nit} max={maxCount} severity="nit" />
          </Box>
        </Card>
      </Box>

      {/* Top Issues Preview */}
      {topIssues.length > 0 && (
        <Box marginTop={1}>
          <Card title="Top Issues">
            <Box flexDirection="column">
              {topIssues.slice(0, 3).map((issue) => (
                <IssuePreviewItem
                  key={issue.id}
                  title={issue.title}
                  file={issue.file}
                  line={issue.line}
                  category={issue.category}
                  severity={issue.severity}
                />
              ))}
            </Box>
          </Card>
        </Box>
      )}

      {/* Action Buttons */}
      <Box marginTop={1} gap={2}>
        <Button variant="primary" focused={focusedButton === "start"}>
          Start Review
        </Button>
        <Button variant="secondary" focused={focusedButton === "back"}>
          Back
        </Button>
      </Box>

      {/* Keyboard Hints */}
      <Box marginTop={1} gap={2}>
        <KeyboardHint keys="Enter" description="Select" />
        <KeyboardHint keys="Esc" description="Back" />
      </Box>
    </Box>
  );
}
```

### Text Styling

| Element | Color | Bold | Dim |
|---------|-------|------|-----|
| Title | `colors.ui.accent` | yes | no |
| Stat labels | - | no | yes |
| Total issues value | `colors.ui.accent` | yes | no |
| Critical count | `colors.ui.error` | yes | no |
| Run ID | `colors.ui.text` | no | no |
| Severity bars | `colors.severity[level]` | yes | no |

### Keyboard Handling

```typescript
useInput((input, key) => {
  // Tab or arrow keys to switch focus between buttons
  if (key.tab || key.leftArrow || key.rightArrow) {
    toggleFocusedButton();
  }
  // Enter to confirm action
  if (key.return) {
    if (focusedButton === "start") onStart();
    else onBack();
  }
  // Escape always goes back
  if (key.escape) {
    onBack();
  }
});
```

---

## 2. InteractiveSeverityFilterGroup

Filter chips with arrow-key navigation and toggle selection.

### Props Interface

```typescript
import type { ReactElement } from "react";

export type SeverityLevel = "blocker" | "high" | "medium" | "low" | "nit";
export type SeverityFilter = SeverityLevel | "all";

export interface FilterItem {
  value: SeverityFilter;
  label: string;
  count: number;
}

export interface InteractiveSeverityFilterGroupProps {
  filters: FilterItem[];
  activeFilters: Set<SeverityFilter>;
  focusedIndex: number;
  isFocused: boolean;
  onFilterToggle: (filter: SeverityFilter) => void;
  onFocusChange: (index: number) => void;
}
```

### JSX Structure

```tsx
import { Box, Text, useInput } from "ink";
import { useTheme } from "../../hooks/use-theme.js";

const FILTER_ORDER: readonly FilterItem[] = [
  { value: "all", label: "ALL", count: 0 },
  { value: "blocker", label: "BLOCKER", count: 0 },
  { value: "high", label: "HIGH", count: 0 },
  { value: "medium", label: "MED", count: 0 },
  { value: "low", label: "LOW", count: 0 },
  { value: "nit", label: "NIT", count: 0 },
];

export function InteractiveSeverityFilterGroup({
  filters,
  activeFilters,
  focusedIndex,
  isFocused,
  onFilterToggle,
  onFocusChange,
}: InteractiveSeverityFilterGroupProps): ReactElement {
  const { colors } = useTheme();

  useInput(
    (input, key) => {
      if (!isFocused) return;

      // Arrow navigation
      if (key.leftArrow) {
        const newIndex = Math.max(0, focusedIndex - 1);
        onFocusChange(newIndex);
      }
      if (key.rightArrow) {
        const newIndex = Math.min(filters.length - 1, focusedIndex + 1);
        onFocusChange(newIndex);
      }

      // Toggle selection
      if (key.return || input === " ") {
        const filter = filters[focusedIndex];
        if (filter) {
          onFilterToggle(filter.value);
        }
      }
    },
    { isActive: isFocused }
  );

  return (
    <Box gap={1} flexWrap="wrap">
      {filters.map((filter, index) => {
        const isActive = activeFilters.has(filter.value);
        const isFilterFocused = isFocused && focusedIndex === index;
        const severityColor =
          filter.value === "all"
            ? colors.ui.accent
            : colors.severity[filter.value as SeverityLevel];

        return (
          <Text
            key={filter.value}
            color={isActive ? undefined : severityColor}
            backgroundColor={isActive ? severityColor : undefined}
            inverse={isFilterFocused && !isActive}
            bold={isActive}
          >
            [{filter.label} {filter.count}]
          </Text>
        );
      })}
    </Box>
  );
}
```

### Visual States

| State | Color | Background | Bold | Inverse |
|-------|-------|------------|------|---------|
| Default | `colors.severity[level]` | none | no | no |
| Active | none | `colors.severity[level]` | yes | no |
| Focused (not active) | `colors.severity[level]` | none | no | yes |
| Focused + Active | none | `colors.severity[level]` | yes | no |

### Keyboard Handling

```typescript
useInput(
  (input, key) => {
    if (!isFocused) return;

    // Left arrow: move focus left
    if (key.leftArrow) {
      onFocusChange(Math.max(0, focusedIndex - 1));
    }

    // Right arrow: move focus right
    if (key.rightArrow) {
      onFocusChange(Math.min(filters.length - 1, focusedIndex + 1));
    }

    // Enter or Space: toggle current filter
    if (key.return || input === " ") {
      onFilterToggle(filters[focusedIndex].value);
    }
  },
  { isActive: isFocused }
);
```

---

## 3. FocusablePane

Wrapper component with visual focus indicator via border color.

### Props Interface

```typescript
import type { ReactElement, ReactNode } from "react";

export interface FocusablePaneProps {
  isFocused?: boolean;
  children: ReactNode;
  width?: number | string;
  height?: number | string;
  borderStyle?: "single" | "double" | "round" | "bold" | "singleDouble" | "doubleSingle" | "classic";
  padding?: number;
  title?: string;
}
```

### JSX Structure

```tsx
import { Box, Text } from "ink";
import { useTheme } from "../../hooks/use-theme.js";

export function FocusablePane({
  isFocused = false,
  children,
  width,
  height,
  borderStyle = "single",
  padding = 1,
  title,
}: FocusablePaneProps): ReactElement {
  const { colors } = useTheme();

  // Border color: cyan when focused, dim when not
  const borderColor = isFocused ? colors.ui.borderFocused : colors.ui.border;

  return (
    <Box
      flexDirection="column"
      borderStyle={borderStyle}
      borderColor={borderColor}
      width={width}
      height={height}
      paddingX={padding}
    >
      {title && (
        <Box marginBottom={1}>
          <Text bold color={isFocused ? colors.ui.accent : colors.ui.textMuted}>
            {title}
          </Text>
        </Box>
      )}
      {children}
    </Box>
  );
}
```

### Visual States

| State | Border Color | Title Color |
|-------|--------------|-------------|
| Focused | `colors.ui.borderFocused` (cyan) | `colors.ui.accent` |
| Not Focused | `colors.ui.border` (gray) | `colors.ui.textMuted` |

### Usage Example

```tsx
<Box flexDirection="row">
  <FocusablePane isFocused={focusArea === "list"} width="50%" title="Issues">
    <IssueList items={issues} selectedIndex={selectedIndex} />
  </FocusablePane>
  <FocusablePane isFocused={focusArea === "details"} width="50%" title="Details">
    <IssueDetails issue={selectedIssue} />
  </FocusablePane>
</Box>
```

---

## Keyboard Handling Patterns

### Standard Navigation Hook

```typescript
import { useInput } from "ink";

export type FocusArea = "list" | "filters" | "details";

export interface UseNavigationOptions {
  focusArea: FocusArea;
  onFocusChange: (area: FocusArea) => void;
  onNavigate: (direction: "up" | "down" | "left" | "right") => void;
  onSelect: () => void;
  onBack: () => void;
  disabled?: boolean;
}

export function useNavigation(options: UseNavigationOptions): void {
  const { focusArea, onFocusChange, onNavigate, onSelect, onBack, disabled } = options;

  useInput((input, key) => {
    if (disabled) return;

    // Tab cycles focus areas
    if (key.tab) {
      const areas: FocusArea[] = ["filters", "list", "details"];
      const currentIndex = areas.indexOf(focusArea);
      const nextIndex = (currentIndex + 1) % areas.length;
      onFocusChange(areas[nextIndex]);
      return;
    }

    // Arrow keys for navigation
    if (key.upArrow || input === "k") {
      onNavigate("up");
      return;
    }
    if (key.downArrow || input === "j") {
      onNavigate("down");
      return;
    }
    if (key.leftArrow || input === "h") {
      onNavigate("left");
      return;
    }
    if (key.rightArrow || input === "l") {
      onNavigate("right");
      return;
    }

    // Enter to select
    if (key.return) {
      onSelect();
      return;
    }

    // Escape to go back
    if (key.escape || input === "q") {
      onBack();
      return;
    }
  });
}
```

### Focus Management State

```typescript
import { useState, useCallback } from "react";

export type FocusArea = "filters" | "list" | "details";

export interface UseFocusManagementReturn {
  focusArea: FocusArea;
  setFocusArea: (area: FocusArea) => void;
  cycleFocus: () => void;
}

export function useFocusManagement(initialArea: FocusArea = "list"): UseFocusManagementReturn {
  const [focusArea, setFocusArea] = useState<FocusArea>(initialArea);

  const cycleFocus = useCallback(() => {
    setFocusArea((current) => {
      const areas: FocusArea[] = ["filters", "list", "details"];
      const currentIndex = areas.indexOf(current);
      return areas[(currentIndex + 1) % areas.length];
    });
  }, []);

  return { focusArea, setFocusArea, cycleFocus };
}
```

---

## Theme Integration

All components use `useTheme()` from `../../hooks/use-theme.js`:

```typescript
import { useTheme } from "../../hooks/use-theme.js";

function MyComponent() {
  const { colors } = useTheme();

  // Access colors
  colors.ui.accent       // cyan
  colors.ui.border       // gray
  colors.ui.borderFocused // cyan
  colors.ui.text         // white
  colors.ui.textMuted    // gray
  colors.ui.success      // green
  colors.ui.error        // red
  colors.ui.warning      // yellow

  colors.severity.blocker // red
  colors.severity.high    // magenta
  colors.severity.medium  // yellow
  colors.severity.low     // blue
  colors.severity.nit     // gray
}
```

---

## File Locations

Place new components at:

```
apps/cli/src/
  components/
    ui/
      focusable-pane.tsx          # Already exists, may need enhancement
      severity-filter-group.tsx   # Already exists, may need interactivity
  features/
    review/
      components/
        review-summary-view.tsx   # New component
```
