# Implement Web UI from Mockups

> Workflow for implementing Stargazer web UI from `/ui-mocks/portfolio + stargazer/` mockups.

## Overview

**Source:** 26 HTML/PNG mockup variants in `ui-mocks/portfolio + stargazer/`
**Target:** `apps/web/src/` following bulletproof-react patterns
**Goal:** Reusable component library + complete screens

---

## Phase 1: Design System Extraction

### Task 1.1: Analyze All Mockups

Use multiple agents to categorize the 26 variants:

```
/Users/voitz/Projects/stargazer/ui-mocks/portfolio + stargazer/
├── stargazer_issue_review_dashboard_1-9/   → Web UI style (Space Grotesk + Inter)
├── stargazer_issue_review_dashboard_10-26/ → TUI style (JetBrains Mono only)
```

**Identified Screen Types:**
1. **Issue Review Dashboard** (web style) - variants 1-9
2. **Trust & Permissions Modal** (TUI style) - variant 10
3. **Agent Inspector Modal** (TUI style) - variant 20
4. **Other variants** - need visual inspection

### Task 1.2: Extract Design Tokens

#### Color Palette

**Web UI Theme (variants 1-9):**
```css
/* Primary accent */
--starlight-blue: #79C0FF;
--aurora-violet: #BC8CFF;

/* Backgrounds */
--background-dark: #0A0E14;
--surface-dark: #161B22;
--surface-darker: #0d1117;

/* Borders */
--border-dark: #30363d;
--accent-border: #30363d;

/* Severity */
--severity-blocker: #ef4444; /* red-500 */
--severity-high: #f97316;    /* orange-500 */
--severity-medium: #eab308;  /* yellow-500 */
--severity-low: #3b82f6;     /* blue-500 */

/* Status */
--status-active: #22c55e;    /* green-500 */
```

**TUI Theme (variants 10-26):**
```css
--tui-bg: #0D1117;
--tui-fg: #C9D1D9;
--tui-blue: #58A6FF;
--tui-violet: #BC8CFF;
--tui-green: #3FB950;
--tui-red: #FF7B72;
--tui-yellow: #D29922;
--tui-border: #30363D;
--tui-selection: #1F2428;
```

#### Typography

```css
/* Web UI */
--font-display: 'Space Grotesk', sans-serif;
--font-body: 'Inter', sans-serif;
--font-mono: 'JetBrains Mono', monospace;

/* TUI */
--font-tui: 'JetBrains Mono', monospace;
```

#### Effects

```css
/* Glow effects */
--shadow-glow: 0 0 20px -5px rgba(121, 192, 255, 0.15);
--shadow-glow-primary: 0 0 10px -2px rgba(121, 192, 255, 0.3);

/* Grid pattern */
--bg-grid: linear-gradient(to right, rgba(48, 54, 61, 0.3) 1px, transparent 1px),
           linear-gradient(to bottom, rgba(48, 54, 61, 0.3) 1px, transparent 1px);

/* TUI shadow */
--shadow-tui-modal: 0 0 0 1px #30363D, 0 30px 60px -12px rgba(0, 0, 0, 0.9);
```

---

## Phase 2: Component Inventory

### Base UI Components (`components/ui/`)

| Component | Source Variant | Priority |
|-----------|---------------|----------|
| `StatusBadge` | 1 (ACTIVE badge) | High |
| `SeverityBadge` | 1 (BLOCKER, HIGH, etc.) | High |
| `SeverityFilter` | 1 (filter buttons) | High |
| `IssueBadge` | 1 (SEC-01, PERF-01) | High |
| `NavTab` | 1 (./REVIEW, ./HISTORY) | High |
| `DetailTab` | 1 (Details, Explain, Trace) | High |
| `ActionButton` | 1 (Ignore, Apply Patch) | High |
| `Checkbox` | 1 (Fix Plan checkboxes) | Medium |
| `CodeBlock` | 1 (recommendation diff) | High |
| `Breadcrumb` | 1 (src / auth / login.ts) | Medium |
| `TimelineItem` | 1 (Symptom, Why it Matters) | High |
| `WarningBox` | 1, 10 (CWE badges, security warning) | High |
| `TuiCheckbox` | 10 ([x], [ ]) | Medium |
| `TuiButton` | 10 (Save Changes, Revoke Trust) | Medium |
| `TuiModal` | 20 (double border modal) | Medium |
| `CodeViewer` | 20 (syntax highlighted code) | High |
| `AsciiLogo` | 10, 20 (STARGAZER text art) | Low |

### Layout Components (`components/layout/`)

| Component | Source | Purpose |
|-----------|--------|---------|
| `AppHeader` | 1 | Logo + nav + user |
| `Sidebar` | 1 | Issue list panel |
| `MainPanel` | 1 | Detail view area |
| `SplitLayout` | 1 | Sidebar + main composition |
| `TuiFooter` | 10, 20 | Keyboard shortcuts bar |

### Feature Components (`features/review/components/`)

| Component | Source | Purpose |
|-----------|--------|---------|
| `RunInfoCard` | 1 | Current run metadata |
| `IssueListItem` | 1 | Issue in sidebar |
| `IssueDetailHeader` | 1 | Issue title + actions |
| `IssueDetailContent` | 1 | Symptom, Why it Matters, Fix Plan |
| `DiffRecommendation` | 1 | Code diff with +/- lines |
| `EvidencePanel` | 20 | Collapsible code evidence |

---

## Phase 3: Implementation Plan

### Step 3.1: Update Design Tokens

**File:** `apps/web/src/index.css`

Add Stargazer theme tokens alongside existing Catppuccin:

```css
@theme {
  /* Stargazer Web Theme */
  --color-starlight: #79C0FF;
  --color-aurora: #BC8CFF;
  --color-bg-dark: #0A0E14;
  --color-surface-dark: #161B22;
  --color-surface-darker: #0d1117;
  --color-border-dark: #30363d;

  /* Severity */
  --color-severity-blocker: #ef4444;
  --color-severity-high: #f97316;
  --color-severity-medium: #eab308;
  --color-severity-low: #3b82f6;

  /* Fonts */
  --font-display: 'Space Grotesk', sans-serif;
  --font-body: 'Inter', sans-serif;
  --font-mono: 'JetBrains Mono', monospace;
}
```

### Step 3.2: Implement Base Components

**Order of implementation:**

1. **Primitives** (no dependencies)
   - `StatusBadge`
   - `SeverityBadge`
   - `IssueBadge`
   - `NavTab`
   - `ActionButton`

2. **Composites** (use primitives)
   - `SeverityFilter`
   - `DetailTabs`
   - `Breadcrumb`
   - `TimelineItem`
   - `WarningBox`

3. **Complex** (use composites)
   - `CodeBlock` (diff view)
   - `CodeViewer` (syntax highlighting)
   - `RunInfoCard`
   - `IssueListItem`

### Step 3.3: Implement Layouts

1. `AppHeader` - fixed header with nav
2. `Sidebar` - scrollable issue list
3. `MainPanel` - scrollable detail area
4. `SplitLayout` - combines Sidebar + MainPanel

### Step 3.4: Implement Screens

**Route:** `/review/:reviewId`

Compose:
- `AppHeader`
- `SplitLayout`
  - `Sidebar`
    - `RunInfoCard`
    - `SeverityFilter`
    - `IssueListItem[]`
  - `MainPanel`
    - `IssueDetailHeader`
    - `DetailTabs`
    - `IssueDetailContent`

---

## Phase 4: File Structure

Following bulletproof-react:

```
apps/web/src/
├── components/
│   ├── ui/
│   │   ├── status-badge.tsx
│   │   ├── severity-badge.tsx
│   │   ├── issue-badge.tsx
│   │   ├── nav-tab.tsx
│   │   ├── action-button.tsx
│   │   ├── severity-filter.tsx
│   │   ├── detail-tabs.tsx
│   │   ├── breadcrumb.tsx
│   │   ├── timeline-item.tsx
│   │   ├── warning-box.tsx
│   │   ├── code-block.tsx
│   │   ├── code-viewer.tsx
│   │   └── index.ts
│   └── layout/
│       ├── app-header.tsx
│       ├── sidebar.tsx
│       ├── main-panel.tsx
│       ├── split-layout.tsx
│       └── index.ts
├── features/
│   └── review/
│       └── components/
│           ├── run-info-card.tsx
│           ├── issue-list-item.tsx
│           ├── issue-detail-header.tsx
│           ├── issue-detail-content.tsx
│           ├── diff-recommendation.tsx
│           └── index.ts
└── styles/
    └── stargazer-theme.css
```

---

## Phase 5: Agent Assignment

### For each component, use:

| Task | Agent | Model |
|------|-------|-------|
| Component design | `ui-designer` | sonnet |
| React implementation | `react-component-architect` | sonnet |
| Structure validation | `bulletproof-react` skill | - |
| Style extraction | `Explore` | haiku |

### Parallel Execution

**Batch 1 (primitives):**
- StatusBadge
- SeverityBadge
- IssueBadge
- NavTab
- ActionButton

**Batch 2 (composites):**
- SeverityFilter
- DetailTabs
- Breadcrumb

**Batch 3 (complex):**
- CodeBlock
- CodeViewer
- RunInfoCard

**Batch 4 (layouts):**
- AppHeader
- Sidebar
- MainPanel
- SplitLayout

**Batch 5 (screens):**
- ReviewScreen composition

---

## Execution Commands

### Start Implementation

```
# Analyze specific mockup
Read: ui-mocks/portfolio + stargazer/stargazer_issue_review_dashboard_1/code.html

# Extract component patterns
Use: Task(ui-designer) to analyze and document component specs

# Implement component
Use: Task(react-component-architect) to implement following specs

# Validate structure
Use: /bulletproof-react skill to verify
```

### Validate Final Output

```bash
npm run type-check
npm run build
npm run dev # Visual inspection
```

---

## Quality Checklist

- [ ] All colors from design tokens (no hardcoded hex)
- [ ] All fonts from theme (Space Grotesk, Inter, JetBrains Mono)
- [ ] Components use CVA for variants
- [ ] Components are pure (no side effects)
- [ ] File names are kebab-case
- [ ] No cross-feature imports
- [ ] Tests colocated with components
- [ ] Barrel exports in index.ts
