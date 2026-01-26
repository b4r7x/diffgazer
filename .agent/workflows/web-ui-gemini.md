# Stargazer Web UI - Gemini 3 Pro Workflow

**Model:** Gemini 3 Pro
**Purpose:** Create terminal-style web UI using WebTUI

## Context

Stargazer is a local-only AI code review CLI. Create a web UI that:
- Mirrors CLI functionality (main menu, review, history, settings)
- Uses WebTUI CSS library for terminal aesthetic (already installed)
- Uses Catppuccin Mocha colors with cyan accent
- Follows Bulletproof React architecture

## Prerequisites (Already Done)

- WebTUI installed: `@webtui/css`, `@webtui/theme-catppuccin`
- Theme CSS configured: `apps/web/src/styles/theme.css`
- Tailwind configured with CSS variables
- TanStack Router set up

## Reference

- CLI structure: `apps/cli/src/` (replicate this flow)
- CLI main menu: `apps/cli/src/app/views/main-menu-view.tsx`
- CLI review screen: `apps/cli/src/features/review/components/review-split-screen.tsx`
- CLI agent panel: `apps/cli/src/features/review/components/agent-activity-panel.tsx`
- Schemas: `packages/schemas/src/`
- Existing web scaffold: `apps/web/src/`

## Theme Colors (CSS Variables)

```css
--background: #1e1e2e    /* Main bg */
--secondary: #313244     /* Cards/surfaces */
--muted: #45475a         /* Borders */
--foreground: #cdd6f4    /* Primary text */
--muted-foreground: #a6adc8  /* Secondary text */
--primary: #89dceb       /* Cyan accent */

/* Severity */
--severity-blocker: #f38ba8  /* Red */
--severity-high: #fab387     /* Peach */
--severity-medium: #f9e2af   /* Yellow */
--severity-low: #89b4fa      /* Blue */

/* Status */
--status-running: #89dceb    /* Cyan */
--status-complete: #a6e3a1   /* Green */
--status-pending: #6c7086    /* Gray */
```

---

## Task 1: UI Primitives

Create in `apps/web/src/components/ui/`:

### `button.tsx`
- Variants: default, primary, destructive, outline, ghost
- Sizes: sm, md, lg
- Use `bg-primary text-primary-foreground` for primary
- Hover states with opacity

### `badge.tsx`
- Default + severity variants (blocker, high, medium, low)
- Use `bg-severity-blocker`, `bg-severity-high`, etc.
- Small, rounded, inline

### `card.tsx`
- Card, CardHeader, CardTitle, CardContent
- `bg-secondary border border-border rounded`
- Consistent padding

### `input.tsx` & `textarea.tsx`
- `bg-input border border-border rounded`
- Focus ring with `ring-primary`

### `select.tsx`
- Styled native select
- Same styling as input

### `progress.tsx`
- Background track + filled bar
- Use `bg-primary` for fill

### `spinner.tsx`
- Animated spinning icon
- Use `text-primary` color

### `separator.tsx`
- Horizontal line `bg-border h-px`

### `tabs.tsx`
- Tabs, TabsList, TabsTrigger, TabsContent
- Use Base UI for accessibility
- Underline style indicator

### `code-block.tsx`
- Monospace font
- Line numbers
- Diff highlighting (+ green bg, - red bg)
- Dark background `bg-muted`

### `skeleton.tsx`
- Pulse animation
- `bg-muted animate-pulse rounded`

Create barrel export `apps/web/src/components/ui/index.ts`.

---

## Task 2: Layout Components

Create in `apps/web/src/components/layout/`:

### `header.tsx`
```
┌───────────────────────────────────────────────────────────────────┐
│ ⭐ stargazer    Menu  Review  History  Sessions  Settings    [provider/model] │
└───────────────────────────────────────────────────────────────────┘
```
- Logo with star emoji, "stargazer" in cyan
- Navigation links (use TanStack Link): Menu, Review, History, Sessions, Settings
- Active link highlighted
- Provider status badge on right

### `footer-bar.tsx`
```
┌─────────────────────────────────────────────────────────┐
│ [r] review   [h] history   [s] settings   [?] help      │
└─────────────────────────────────────────────────────────┘
```
- Keyboard shortcut hints
- `kbd` styled keys
- Muted text for labels

### `split-pane.tsx`
- Two-column layout
- Configurable left width (default 40%)
- Border between panes
- Full height

---

## Task 3: Main Menu

Create `apps/web/src/features/menu/components/main-menu.tsx`:

```
        ⭐ stargazer
    AI-powered code review

┌─────────────────────────────┐
│ Provider: anthropic / sonnet │
│ Last review: 2 hours ago     │
└─────────────────────────────┘

Actions:
  [r] Review unstaged changes
  [R] Review staged changes
  [f] Review specific files...
  [l] Resume last review
  [h] History
  [s] Settings
```

Props:
- `provider?: string`
- `model?: string`
- `lastReviewAt?: string`
- `hasLastReview?: boolean`
- `onAction: (action: string) => void`

Features:
- Centered layout, max-width container
- Status card with provider info
- Action list with hover states
- Keyboard shortcut badges

---

## Task 4: Agent Activity Panel

Create `apps/web/src/features/agents/components/agent-activity-panel.tsx`:

```
┌─ Agent Activity ─────────────┐
│ ✓ 🔍 Detective      3 issues │
│ ◐ 🛡️ Guardian                │
│   └─ Analyzing auth...       │
│ ○ ⚡ Optimizer               │
├──────────────────────────────┤
│ Review complete              │
│ 3 agents • 5 issues          │
└──────────────────────────────┘
```

Props:
- `agents: AgentState[]` (id, name, emoji, status, currentAction, issueCount)
- `currentAction?: string`

Features:
- Status icons: ○ pending, ◐ running (or spinner), ✓ complete
- Running agent shows current action indented
- Complete agents show issue count
- Summary when all done

---

## Task 5: Issue List

Create `apps/web/src/features/review/components/issue-list.tsx`:

```
┌──────────────────────────────────────┐
│ ▶ Potential null reference    [high] │
│   src/utils/parser.ts:42             │
├──────────────────────────────────────┤
│   Missing error handling    [medium] │
│   src/api/client.ts:15               │
└──────────────────────────────────────┘
```

Props:
- `issues: TriageIssue[]`
- `selectedId?: string`
- `onSelect: (id: string) => void`

Features:
- Clickable rows
- Selected state with left border accent
- Severity badge
- File:line in muted text
- Empty state when no issues

---

## Task 6: Issue Details

Create `apps/web/src/features/review/components/issue-details.tsx`:

```
┌─────────────────────────────────────────┐
│ Potential null reference          [high]│
│ src/utils/parser.ts:42-42               │
│                                         │
│ [Apply Patch]  [Explain]                │
├─────────────────────────────────────────┤
│ Details | Explain | Patch | Trace       │
├─────────────────────────────────────────┤
│ The variable may be null at this point. │
│                                         │
│ Code Context:                           │
│ ┌─────────────────────────────────────┐ │
│ │ 42 │ const result = data.items.map  │ │
│ └─────────────────────────────────────┘ │
└─────────────────────────────────────────┘
```

Props:
- `issue: TriageIssue | null`
- `onApplyPatch?: (id: string) => void`
- `onExplain?: (id: string) => void`

Features:
- Header with title, file, severity
- Action buttons
- Tabs: Details, Explain, Patch, Trace
- Code block for context
- Diff view for patch tab
- Empty state when no issue selected

---

## Task 7: Review Screen

Create `apps/web/src/features/review/components/review-screen.tsx`:

```
┌────────────┬─────────────────────┬─────────────────────────┐
│ Agents     │ Issues (5)          │ Issue Details           │
│            │                     │                         │
│ ✓ Detective│ ▶ Null reference    │ Potential null ref      │
│ ◐ Guardian │   Missing handler   │ src/parser.ts:42        │
│ ○ Optimizer│   SQL injection     │                         │
│            │   ...               │ [Apply] [Explain]       │
│            │                     │                         │
│ Review done│                     │ Details | Patch | Trace │
│ 3 agents   │                     │                         │
│ 5 issues   │                     │ Description here...     │
└────────────┴─────────────────────┴─────────────────────────┘
```

Props:
- `issues: TriageIssue[]`
- `agents: AgentState[]`
- `isReviewing?: boolean`
- `selectedIssueId?: string`
- `onSelectIssue: (id: string) => void`
- `onApplyPatch?: (id: string) => void`
- `onExplain?: (id: string) => void`

Features:
- Three-column layout (agent panel | issue list | issue details)
- Agent panel hidden when review complete (unless isReviewing)
- Split pane for issues/details
- Responsive: stack on mobile

---

## Task 8: Review History List

Create `apps/web/src/features/review/components/review-history-list.tsx`:

```
┌───────────────────────────────────────────┐
│ Unstaged changes              5 issues    │
│ Jan 25, 2026                  [completed] │
├───────────────────────────────────────────┤
│ 2 files                       2 issues    │
│ Jan 24, 2026                  [completed] │
└───────────────────────────────────────────┘

Empty state:
┌───────────────────────────────────────────┐
│              📜                           │
│      No review history yet                │
│   Start a review to see it here           │
└───────────────────────────────────────────┘
```

Props:
- `reviews: ReviewHistoryEntry[]`
- `onSelect?: (id: string) => void`

---

## Task 9: Sessions List

Create `apps/web/src/features/sessions/components/sessions-list.tsx`:

```
┌───────────────────────────────────────────┐
│ 💬 Chat session                           │
│ Jan 25, 2026 • 5 messages                 │
├───────────────────────────────────────────┤
│ 💬 Review discussion                      │
│ Jan 24, 2026 • 12 messages                │
└───────────────────────────────────────────┘

Empty state:
┌───────────────────────────────────────────┐
│              💬                           │
│      No sessions yet                      │
│   Start a chat to see it here             │
└───────────────────────────────────────────┘
```

Props:
- `sessions: Session[]`
- `onSelect?: (id: string) => void`
- `onDelete?: (id: string) => void`

---

## Task 10: Settings Page

Create/update `apps/web/src/app/routes/settings.tsx`:

```
┌─ AI Provider ────────────────────────────┐
│ Provider:  [Anthropic      ▼]            │
│ Model:     [Claude Sonnet 4 ▼]           │
│ API Key:   [••••••••••••••••]            │
│                                          │
│ [Save]                                   │
└──────────────────────────────────────────┘

┌─ Status ─────────────────────────────────┐
│ Configured: Yes                          │
│ Provider: anthropic                      │
│ Model: claude-sonnet-4                   │
└──────────────────────────────────────────┘
```

Features:
- Form with select dropdowns
- Password input for API key
- Save button
- Status card showing current config

---

## Task 11: Wire Routes

### `apps/web/src/app/routes/__root.tsx`
- Header + Footer layout
- Dark background (`bg-background`)
- Full viewport height

### `apps/web/src/app/routes/index.tsx`
- Render MainMenu
- Mock data for provider/model
- Navigate on action

### `apps/web/src/app/routes/review/index.tsx`
- Render ReviewScreen
- Mock agents and issues data
- Show agent panel (simulating active review)

### `apps/web/src/app/routes/review/$reviewId.tsx`
- Load review by ID (mock for now)
- Render ReviewScreen with loaded data

### `apps/web/src/app/routes/review-history.tsx`
- Render ReviewHistoryList
- Mock review history data
- Navigate to /review/$id on select

### `apps/web/src/app/routes/sessions.tsx`
- Render SessionsList
- Mock sessions data

---

## Task 12: Polish

### Hover States
- Buttons: opacity change
- List items: background highlight
- Links: underline or color change

### Focus States
- Visible focus ring `ring-2 ring-primary`
- All interactive elements

### Animations
- Use existing `animate-fade-in`, `animate-slide-in`
- Spinner rotation
- Skeleton pulse

### Responsive
- Stack columns on mobile
- Collapsible sidebar on tablet
- Touch-friendly tap targets

---

## Validation

```bash
pnpm type-check
pnpm build
pnpm dev  # Visual check all routes
```

## Success Criteria

- [ ] All UI primitives render correctly
- [ ] Main menu matches CLI layout
- [ ] Review screen has 3-column layout
- [ ] Agent activity shows with icons/spinners
- [ ] Issue list and details work with tabs
- [ ] Review history page shows list with empty state
- [ ] Sessions page shows list with empty state
- [ ] Settings page has forms
- [ ] Dark theme applied consistently
- [ ] Hover/focus states work
- [ ] No TypeScript errors
- [ ] Build passes

---

## Mock Data Reference

### Mock Agents
```typescript
const mockAgents = [
  { id: '1', name: 'Detective', emoji: '🔍', status: 'complete', issueCount: 3 },
  { id: '2', name: 'Guardian', emoji: '🛡️', status: 'running', currentAction: 'Analyzing auth patterns...' },
  { id: '3', name: 'Optimizer', emoji: '⚡', status: 'queued', issueCount: 0 },
]
```

### Mock Issues
```typescript
const mockIssues = [
  {
    id: '1',
    title: 'Potential null reference',
    body: 'The variable may be null at this point.',
    severity: 'high',
    file_path: 'src/utils/parser.ts',
    line_start: 42,
    line_end: 42,
    code_context: 'const result = data.items.map(x => x.value)',
    suggested_patch: '- const result = data.items.map(x => x.value)\n+ const result = data?.items?.map(x => x.value) ?? []',
  },
  // ... more
]
```

---

## Notes for Gemini

- Focus on VISUAL implementation
- Use mock/placeholder data throughout
- Follow Tailwind classes with CSS variables
- Reference CLI components for layout inspiration
- Keep components simple and composable
- Use TypeScript with proper prop types
