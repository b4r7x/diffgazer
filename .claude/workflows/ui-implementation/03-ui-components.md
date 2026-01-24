# Workflow 03: UI Components

## Overview

Create all shared UI components and wizard step components for Ink CLI.

---

## Context for Empty AI Session

### Project: Stargazer
Local-only CLI for AI-powered code review using React 19 + Ink.

### UI Patterns
- Ink is "React for terminal" - flexbox layout
- Use `<Box>` for layout, `<Text>` for text
- `useInput()` hook for keyboard handling
- Chalk for colors (via Text color prop)
- No manual memoization (React 19 Compiler)
- All files use kebab-case naming

### Component Structure
```
apps/cli/src/components/
├── ui/           # Shared UI primitives
├── wizard/       # Onboarding/settings step components
└── settings/     # Settings-specific components (existing)
```

---

## Task 1: Shared UI Primitives

**Agent:** `react-component-architect`

**Directory:** `apps/cli/src/components/ui/`

### 1.1 split-pane.tsx
```typescript
import { Box } from "ink";
import { useStdout } from "ink";

interface SplitPaneProps {
  leftWidth?: string | number; // e.g., "40%" or 40
  children: [React.ReactNode, React.ReactNode];
  direction?: "horizontal" | "vertical";
}

// Horizontal split by default
// If terminal width < 90, switch to vertical stack
// Uses flexbox with flexGrow for right pane
```

### 1.2 select-list.tsx
```typescript
import SelectInput from "ink-select-input";

interface SelectListItem {
  label: string;
  value: string;
  badge?: string; // Optional badge like "✓ configured"
}

interface SelectListProps {
  items: SelectListItem[];
  onSelect: (item: SelectListItem) => void;
  initialIndex?: number;
}

// Wrapper around ink-select-input with badge support
// Renders: label + badge (if present)
```

### 1.3 toggle-list.tsx
```typescript
import { Box, Text, useInput } from "ink";

interface ToggleItem {
  id: string;
  label: string;
  description?: string;
}

interface ToggleListProps {
  items: ToggleItem[];
  selected: Set<string>;
  onToggle: (id: string) => void;
  focusedIndex: number;
  onFocusChange: (index: number) => void;
}

// Multi-select checkbox list
// [x] Label - Description
// [ ] Label - Description
// Space to toggle, j/k to navigate
```

### 1.4 card.tsx
```typescript
import { Box, Text } from "ink";

interface CardProps {
  title?: string;
  borderStyle?: "single" | "double" | "round" | "bold";
  borderColor?: string;
  children: React.ReactNode;
  padding?: number;
}

// Box with border and optional title
// Title rendered at top of border
```

### 1.5 badge.tsx
```typescript
import { Text } from "ink";

type BadgeType = "severity" | "status" | "info";

interface BadgeProps {
  type: BadgeType;
  value: string;
}

// Inline badge with color based on type
// severity: blocker=red, high=red, medium=yellow, low=blue, nit=gray
// status: configured=green, needs-key=yellow
// info: neutral color
```

### 1.6 header-brand.tsx
```typescript
import { Box, Text } from "ink";
import figlet from "figlet";

interface HeaderBrandProps {
  subtitle?: string;
}

// FIGlet banner "STARGAZER"
// Add star ornaments: ✦ ✧ * .
// Responsive: wide/compact/tiny based on columns
// Wide (>=60): Full figlet
// Compact (40-60): Smaller font
// Tiny (<40): Plain text + stars
```

### 1.7 footer-bar.tsx
```typescript
import { Box, Text } from "ink";

interface Shortcut {
  key: string;
  label: string;
}

interface FooterBarProps {
  shortcuts: Shortcut[];
  status?: string; // e.g., "Gemini • gemini-pro"
}

// Horizontal bar at bottom
// Left: shortcuts (key label pairs)
// Right: status (if provided)
```

### 1.8 progress-indicator.tsx
```typescript
import { Box, Text } from "ink";

interface ProgressIndicatorProps {
  current: number;
  total: number;
  label?: string;
}

// Step X/Y indicator for wizard
// Optional label like "Theme"
```

**Export all from:** `apps/cli/src/components/ui/index.ts`

---

## Task 2: Wizard Step Components

**Agent:** `react-component-architect`

**Directory:** `apps/cli/src/components/wizard/`

### 2.1 wizard-frame.tsx
```typescript
interface WizardFrameProps {
  step: number;
  totalSteps: number;
  title: string;
  mode: "onboarding" | "settings";
  children: React.ReactNode;
}

// Layout:
// Setup • Step X/Y  Title (or just Title in settings mode)
// [children content]
// Footer with Next/Back or Save/Cancel based on mode
```

### 2.2 trust-step.tsx
```typescript
interface TrustStepProps {
  mode: "onboarding" | "settings";
  repoPath: string;
  capabilities: TrustCapabilities;
  onCapabilitiesChange: (caps: TrustCapabilities) => void;
  onAction: (action: "trust" | "trust-once" | "cancel") => void;
}

// Content:
// "Do you trust this directory?"
// [repoPath]
//
// Stargazer may:
// • Read repository files
// • Read git metadata
// • Run commands (if enabled)
//
// [x] Allow reading repository files
// [x] Allow reading git metadata
// [ ] Allow running commands
//
// Actions: Trust & continue / Trust once / No
```

### 2.3 theme-step.tsx
```typescript
interface ThemeStepProps {
  mode: "onboarding" | "settings";
  selectedTheme: Theme;
  onThemeChange: (theme: Theme) => void;
  onNext: () => void;
  onBack: () => void;
}

// SelectList with themes:
// Auto (recommended) - Safe palette, works on any background
// Dark - Optimized for dark terminals
// Light - Optimized for light terminals
// Terminal default - Minimal formatting
//
// Preview section showing sample colors
```

### 2.4 provider-step.tsx
```typescript
interface ProviderStepProps {
  mode: "onboarding" | "settings";
  selectedProvider: string;
  configuredProviders: Set<string>;
  onProviderChange: (provider: string) => void;
  onNext: () => void;
  onBack: () => void;
}

// SelectList with providers:
// Google (Gemini) [✓ configured] or [• needs key]
// OpenAI
// Anthropic
// Custom (OpenAI-compatible)
//
// Tab to switch model preset: Fast / Balanced / Best
```

### 2.5 credentials-step.tsx
```typescript
interface CredentialsStepProps {
  mode: "onboarding" | "settings";
  provider: string;
  hasExistingKey: boolean;
  onSave: (method: "paste" | "env" | "stdin", value?: string) => void;
  onSkip: () => void;
  onBack: () => void;
}

// Input method selection:
// Paste now (hidden input)
// Read from env var (shows which var to set)
// Read from stdin
// Skip for now
//
// In settings mode: also show "Remove key" option if hasExistingKey
```

### 2.6 controls-step.tsx
```typescript
interface ControlsStepProps {
  mode: "onboarding" | "settings";
  selectedMode: ControlsMode;
  onModeChange: (mode: ControlsMode) => void;
  onNext: () => void;
  onBack: () => void;
}

// SelectList:
// Menu mode (guided) - Arrow navigation, visible actions
// Key mode (vim-ish) - Single-key actions, command palette
//
// Cheatsheet preview for selected mode:
// Menu: ↑/↓ select, Enter confirm, Esc back
// Key: j/k move, o open, a apply, i ignore, : cmd
```

### 2.7 summary-step.tsx
```typescript
interface SummaryStepProps {
  theme: Theme;
  provider: string;
  hasKey: boolean;
  controlsMode: ControlsMode;
  onFinish: () => void;
  onTestConnection: () => Promise<boolean>;
}

// Summary card:
// Theme: Auto
// Provider: Gemini
// API Key: Stored in keychain
// Controls: Menu mode
// Config path: ~/.config/stargazer/
//
// Actions: Finish / Test connection
```

**Export all from:** `apps/cli/src/components/wizard/index.ts`

---

## Task 3: Review UI Components

**Agent:** `react-component-architect`

**Directory:** `apps/cli/src/features/review/components/`

### 3.1 review-split-screen.tsx
```typescript
interface ReviewSplitScreenProps {
  issues: Issue[];
  issueStates: Record<string, IssueState>;
  onIssueSelect: (issueId: string) => void;
  onIssueAction: (issueId: string, action: "apply" | "ignore") => void;
}

// Uses SplitPane with:
// Left (40%): IssueListPane
// Right (60%): IssueDetailsPane
//
// Manages focus state: "list" | "details"
// Passes focus to children
```

### 3.2 issue-list-pane.tsx
```typescript
interface IssueListPaneProps {
  issues: Issue[];
  issueStates: Record<string, IssueState>;
  selectedIndex: number;
  onSelect: (index: number) => void;
  filters: FilterState;
  onFilterChange: (filters: FilterState) => void;
  isFocused: boolean;
}

// IssueListHeader (filters)
// IssueList (scrollable)
// Selected item highlighted
```

### 3.3 issue-list-header.tsx
```typescript
interface IssueListHeaderProps {
  filters: FilterState;
  onFilterChange: (filters: FilterState) => void;
  totalCount: number;
  filteredCount: number;
}

// Severity: [All ▼]  Lens: [All ▼]  Status: [Open ▼]
// Search: [_____]
// Showing 12 of 24 issues
```

### 3.4 issue-details-pane.tsx
```typescript
interface IssueDetailsPaneProps {
  issue: Issue | null;
  activeTab: "details" | "explain" | "trace" | "patch";
  onTabChange: (tab: string) => void;
  isFocused: boolean;
  scrollOffset: number;
  onScroll: (offset: number) => void;
}

// IssueHeader (title, badges, location)
// IssueTabs
// IssueBody (based on activeTab)
```

### 3.5 issue-tabs.tsx
```typescript
interface IssueTabsProps {
  activeTab: string;
  onTabChange: (tab: string) => void;
}

// Horizontal tab bar:
// [Details] [Explain] [Trace] [Patch]
// Active tab highlighted
```

### 3.6 issue-body-details.tsx
```typescript
interface IssueBodyDetailsProps {
  issue: Issue;
}

// Symptom
// What is observed in the code...
//
// Why it matters
// Risk/impact explanation...
//
// Fix plan
// 1. Do this [low risk]
// 2. Then this [med risk]
//
// Recommendation
// Summary action...
//
// Alternatives (if present)
// • Option 1
// • Option 2
//
// Tests to add (if present)
// • Test case 1
```

### 3.7 issue-body-explain.tsx
```typescript
interface IssueBodyExplainProps {
  issue: Issue;
}

// Evidence
// • [diffHunk] Changed code in auth.ts
//   excerpt...
// • [fileSnippet] Context around line 120
//   excerpt...
//
// Rule triggered
// [security] OWASP: SQL Injection
//
// Assumptions
// For this not to be a problem, X would need to be true...
```

### 3.8 issue-body-trace.tsx
```typescript
interface IssueBodyTraceProps {
  issue: Issue;
}

// Tool call timeline
// 1. readFileRange(auth.ts, 100-150)
//    Input: path=auth.ts, start=100, end=150
//    Output: 50 lines of code
//
// 2. repoSearch("validateInput")
//    Input: query="validateInput"
//    Output: 3 matches found
```

### 3.9 issue-body-patch.tsx
```typescript
interface IssueBodyPatchProps {
  issue: Issue;
  onApply: () => void;
}

// Patch preview
// ✓ Applies cleanly
// Files: auth.ts
//
// --- a/src/auth.ts
// +++ b/src/auth.ts
// @@ -120,5 +120,7 @@
// - oldCode
// + newCode
//
// [Apply patch]
```

**Update:** `apps/cli/src/features/review/components/index.ts`

---

## Validation

After completing all tasks:

```bash
npm run type-check
```

Verify all components render correctly in isolation.
