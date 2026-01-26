# Web UI Creation - Master Orchestrator

Create the Stargazer Web UI application following Bulletproof React architecture.

**Recommended Model**: Gemini 3 Pro (best for UI/frontend work)
**Alternative**: Can be executed in Claude Code with frontend-developer agent

## Context

Stargazer is a local-only CLI tool for AI-powered code review. This workflow creates a web UI that works alongside the CLI, consuming the same backend API.

### Tech Decisions
- **Framework**: Vite + React (SPA, no SSR needed)
- **Routing**: TanStack Router (type-safe)
- **UI Base**: Base UI (headless, actively maintained)
- **Styling**: Tailwind CSS + shadcn pattern
- **State**: React hooks + Zustand for global

### Architecture
- Follow Bulletproof React structure
- Reuse `@repo/schemas`, `@repo/api`, `@repo/core`
- Create `@repo/ui` for shared components (later workflow)

---

## Phase 1: Project Setup

### Agent 1.1: Initialize Project

```
subagent_type: "frontend-developer"

Task: Initialize Vite React project with dependencies.

Steps:
1. Create apps/web with Vite React TypeScript template
2. Install dependencies:
   - @base-ui-components/react
   - @tanstack/react-router
   - class-variance-authority clsx tailwind-merge
   - @repo/api @repo/schemas @repo/core
3. Configure Tailwind CSS
4. Configure path aliases (@/ -> src/)
5. Create directory structure per Bulletproof React

Directory structure:
```
apps/web/src/
├── app/
│   ├── routes/
│   ├── providers.tsx
│   └── router.tsx
├── components/
│   └── ui/
├── features/
│   ├── review/
│   ├── settings/
│   └── agents/
├── hooks/
├── lib/
├── stores/
├── types/
└── main.tsx
```

Validation: pnpm type-check && pnpm build

Output: Project initialized with structure
```

---

## Phase 2: UI Components

### Agent 2.1: Core UI Primitives

```
subagent_type: "frontend-developer"

Task: Create core UI components using Base UI + Tailwind.

Create in apps/web/src/components/ui/:

1. lib/utils.ts - cn() helper
2. button.tsx - variants: default, destructive, outline, ghost; sizes: sm, md, lg
3. card.tsx - CardRoot, CardHeader, CardTitle, CardContent, CardFooter
4. badge.tsx - variants + severity colors (blocker, high, medium, low, nit)
5. dialog.tsx - using @base-ui-components/react/dialog
6. tabs.tsx - using @base-ui-components/react/tabs
7. select.tsx - using @base-ui-components/react/select
8. input.tsx + textarea.tsx
9. skeleton.tsx - pulse animation
10. progress.tsx - with label support

Design guidelines:
- 8px spacing grid
- Border radius: 6-8px
- Use CSS variables for theming
- Dark mode support via .dark class

Validation: Components render correctly in Storybook or test page

Output: Core UI components created
```

### Agent 2.2: Domain Components

```
subagent_type: "frontend-developer"

Task: Create Stargazer-specific components.

Create in apps/web/src/features/:

1. review/components/severity-badge.tsx
   - Props: severity: 'blocker' | 'high' | 'medium' | 'low' | 'nit'
   - Show emoji + colored badge

2. agents/components/agent-status.tsx
   - Props: status, agent, currentAction, issueCount
   - Animated spinner for running
   - Checkmark for complete

3. review/components/issue-card.tsx
   - Display title, severity, file:line
   - Click to expand
   - Hover state

4. review/components/diff-view.tsx
   - Show git diff with highlighting
   - Line numbers
   - Highlight issue location

5. components/ui/code-block.tsx
   - Syntax highlighting
   - Copy button
   - Line numbers

Validation: Components render with mock data

Output: Domain components created
```

---

## Phase 3: Review Feature

### Agent 3.1: Review API Layer

```
subagent_type: "backend-developer"

Task: Create API layer for review feature.

Create apps/web/src/features/review/api/review-api.ts:

Functions:
- streamTriage(options, onEvent) - SSE stream for triage
- getReviews() - fetch review history
- getReview(id) - fetch single review

Use @repo/api client.
Handle SSE parsing for AgentStreamEvent.

Types from @repo/schemas:
- TriageOptions
- TriageResult
- AgentStreamEvent
- ReviewHistoryEntry

Validation: pnpm type-check

Output: Review API layer created
```

### Agent 3.2: Review Hooks

```
subagent_type: "react-component-architect"

Task: Create hooks for review feature.

Create in apps/web/src/features/review/hooks/:

1. use-triage-stream.ts
   - Manage SSE connection
   - Parse events
   - Return { events, issues, isRunning, error, start, stop }

2. use-agent-activity.ts
   - Derive agent states from events
   - Calculate progress
   - Return { agents, currentAction, progress }

3. use-review-history.ts
   - Fetch and cache review history
   - Return { reviews, isLoading, error, refetch }

Validation: pnpm type-check

Output: Review hooks created
```

### Agent 3.3: Review UI Components

```
subagent_type: "frontend-developer"

Task: Create review UI components.

Create in apps/web/src/features/review/components/:

1. review-panel.tsx
   - Main container
   - Layout: agent panel | issue list | issue details
   - Responsive (stack on mobile)

2. issue-list.tsx
   - Virtualized list for performance
   - Filter by severity
   - Search by title/file
   - Sort options

3. issue-details.tsx
   - Tabs: Details | Explain | Patch | Trace
   - Show full issue info
   - Code context with highlighting

4. agent-activity-panel.tsx
   - List of agents with status
   - Progress bar
   - Current action display
   - Collapse when done

5. review-header.tsx
   - Run button
   - Profile/lens selector
   - Filter controls

Validation: Components render with mock data

Output: Review UI components created
```

### Agent 3.4: Review Pages

```
subagent_type: "frontend-developer"

Task: Create review route pages.

Create in apps/web/src/app/routes/:

1. review/index.tsx
   - Start new review page
   - File selection (git status)
   - Lens/profile selection
   - Start button
   - Show agent activity during review
   - Transition to results when done

2. review/$reviewId.tsx
   - Load existing review
   - Full review panel UI
   - Issue navigation

Wire up:
- useTriageStream for new reviews
- useAgentActivity for live display
- useReviewHistory for existing reviews

Validation: Full review flow works

Output: Review pages created
```

---

## Phase 4: Settings Feature

### Agent 4.1: Settings API & Hooks

```
subagent_type: "backend-developer"

Task: Create settings API and hooks.

Create apps/web/src/features/settings/api/settings-api.ts:
- getProviderStatus()
- getConfig()
- saveConfig()
- getSettings()
- saveSettings()

Create apps/web/src/features/settings/hooks/:
- use-config.ts - provider configuration
- use-settings.ts - user settings

Validation: pnpm type-check

Output: Settings API created
```

### Agent 4.2: Settings UI

```
subagent_type: "frontend-developer"

Task: Create settings UI.

Create in apps/web/src/features/settings/components/:
- provider-selector.tsx
- model-selector.tsx
- theme-selector.tsx
- api-key-input.tsx

Create apps/web/src/app/routes/settings.tsx:
- Provider configuration section
- Theme settings section
- About section

Validation: Settings page works

Output: Settings UI created
```

---

## Phase 5: Layout & Navigation

### Agent 5.1: App Layout

```
subagent_type: "frontend-developer"

Task: Create app layout and navigation.

Create:

1. apps/web/src/app/routes/__root.tsx
   - ThemeProvider wrapper
   - Layout with header + main
   - Outlet for child routes

2. apps/web/src/components/layout/header.tsx
   - Logo/brand
   - Nav links: Review, History, Settings
   - Theme toggle
   - Provider status indicator

3. apps/web/src/app/routes/index.tsx (home)
   - Quick actions
   - Recent reviews
   - Git status (if available)

4. apps/web/src/app/router.tsx
   - TanStack Router setup
   - Route definitions

Validation: Navigation works between pages

Output: Layout and navigation created
```

---

## Phase 6: Polish

### Agent 6.1: Loading & Error States

```
subagent_type: "frontend-developer"

Task: Add loading and error states.

For each data-fetching component:
1. Add skeleton loader during loading
2. Add error UI with retry button
3. Add empty state UI

Add global:
1. Error boundary at app root
2. Toast notifications for actions
3. Loading bar for navigation

Validation: All states display correctly

Output: Loading and error states added
```

### Agent 6.2: Accessibility

```
subagent_type: "frontend-developer"

Task: Verify and fix accessibility.

Checklist:
1. Keyboard navigation works everywhere
2. Focus states are visible
3. ARIA labels on interactive elements
4. Semantic HTML structure
5. Color contrast passes WCAG AA
6. Reduced motion respected

Fix any issues found.

Validation: Lighthouse accessibility score > 90

Output: Accessibility verified
```

---

## Validation Checkpoints

After each phase:
```bash
pnpm type-check
pnpm build
pnpm preview  # Manual test
```

## Success Criteria

- [ ] All UI components render correctly
- [ ] Dark/light theme works
- [ ] Review flow works end-to-end
- [ ] Agent activity shows real-time
- [ ] Settings can be changed
- [ ] Responsive on mobile
- [ ] Accessible (keyboard, screen reader)
- [ ] No TypeScript errors
- [ ] Build succeeds
