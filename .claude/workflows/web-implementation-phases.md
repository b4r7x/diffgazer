# Web App Implementation – Phased Workflow

## Overview

**Objective:** Implement React 19 web interface for Stargazer from 26 Tailwind CSS mockups.

**Stack:** React 19 + TypeScript + Tailwind CSS 4 + TanStack Router
**Screens:** Home Menu, Review Screen, History, Settings, Modals
**Status:** Feature/review-bounding branch

---

## Phase 1: Foundation & Design System

### Goals
- Establish Tailwind configuration with design tokens
- Create primitive UI components (Button, Input, Badge, etc.)
- Set up theme provider for dark/light mode
- Document component API patterns

### Files to Create

| File | Purpose |
|------|---------|
| `apps/web/tailwind.config.ts` | Extend with custom colors, typography, spacing |
| `apps/web/src/styles/globals.css` | Reset, base layer, scrollbar styles |
| `apps/web/src/components/ui/button.tsx` | Base button with variants (primary, secondary, outline, ghost) |
| `apps/web/src/components/ui/input.tsx` | Text input with error states |
| `apps/web/src/components/ui/badge.tsx` | Status/severity badges |
| `apps/web/src/components/ui/card.tsx` | Container component |
| `apps/web/src/components/ui/tabs.tsx` | Tab navigation (Settings uses this) |
| `apps/web/src/components/ui/popover.tsx` | Dropdown/tooltip container |
| `apps/web/src/components/ui/tooltip.tsx` | Hover tooltips |
| `apps/web/src/components/ui/modal.tsx` | Base dialog/modal wrapper |
| `apps/web/src/components/ui/index.ts` | Export all primitives |

### Design Tokens (Tailwind config)

```typescript
// Color palette (from mockups)
colors: {
  "primary": "#79C0FF",           // Starlight blue
  "secondary": "#BC8CFF",         // Aurora violet
  "background": "#0A0E14",        // Inky navy
  "surface": "#161B22",           // Dark graphite
  "surface-secondary": "#0d1117", // Deeper graphite
  "border": "#30363d",            // Subtle border
  "success": "#3FB950",           // Green
  "warning": "#D29922",           // Yellow
  "destructive": "#FF7B72",       // Red
}

// Typography (from mockups)
fontFamily: {
  "display": ["Space Grotesk", "sans-serif"],
  "body": ["Inter", "sans-serif"],
  "mono": ["JetBrains Mono", "monospace"],
}
```

### Dependencies

None (primitives are self-contained)

### Testing Approach

- **Unit tests** for each primitive: Button variants, Input states, Badge rendering
- Use Vitest + React Testing Library
- Test visual and accessibility properties (aria-labels, roles)

**Test file locations:**
- `apps/web/src/components/ui/__tests__/button.test.tsx`
- `apps/web/src/components/ui/__tests__/input.test.tsx`
- etc.

### Acceptance Criteria

- [ ] Tailwind extends with custom colors, fonts, and shadow utilities
- [ ] All 10 UI primitives created with ≥2 variants each
- [ ] Responsive breakpoints work (mobile, tablet, desktop)
- [ ] Dark mode toggle functional
- [ ] 100% of primitives have TypeScript prop types
- [ ] Each primitive tested with ≥3 test cases

### Estimated Effort

**2–3 days** for one developer

---

## Phase 2: Layout Components

### Goals
- Build header, footer, navigation, sidebar
- Establish layout hierarchy
- Create spacing and alignment patterns
- Prepare for screen content

### Files to Create

| File | Purpose |
|------|---------|
| `apps/web/src/components/layout/header.tsx` | Top nav bar with branding and tab nav (REVIEW / HISTORY / SETTINGS) |
| `apps/web/src/components/layout/footer-bar.tsx` | Bottom status bar (connected status, user info) |
| `apps/web/src/components/layout/main-layout.tsx` | Wrapper for pages with Header + Footer |
| `apps/web/src/components/layout/split-pane.tsx` | Two-column layout with resizable divider (used in Review) |
| `apps/web/src/components/layout/sidebar.tsx` | Left panel for issue list (Review screen) |
| `apps/web/src/components/layout/content-panel.tsx` | Right panel for issue details (Review screen) |
| `apps/web/src/components/navigation/breadcrumb.tsx` | Breadcrumb nav (Settings tabs) |
| `apps/web/src/components/navigation/tab-nav.tsx` | Horizontal tab switcher |
| `apps/web/src/components/common/empty-state.tsx` | Empty result placeholder |
| `apps/web/src/components/common/loading-skeleton.tsx` | Content placeholder while loading |

### Dependencies

- Phase 1 primitives (Button, Card, etc.)
- Lucide React (icons)

### Component Hierarchy

```
Layout
├── Header
│   ├── Logo
│   ├── TabNav (REVIEW, HISTORY, SETTINGS)
│   └── UserProfile
├── Main
│   ├── (page content)
│   └── (see Phase 3 for specific layouts)
└── FooterBar
    ├── ConnectionStatus
    └── UserInfo
```

### Testing Approach

- **Integration tests** verify layout structure (sections are in correct order)
- Test responsive collapse/expand behaviors
- Test navigation state reflects current route

**Test locations:**
- `apps/web/src/components/layout/__tests__/header.test.tsx`
- `apps/web/src/components/layout/__tests__/split-pane.test.tsx`

### Acceptance Criteria

- [ ] Header renders with logo, nav tabs, user profile
- [ ] Footer bar shows connection status and user info
- [ ] Split-pane resizes smoothly (drag divider)
- [ ] Layout is sticky (header/footer don't scroll with content)
- [ ] Responsive: footer collapses on mobile
- [ ] All layout components tested (≥2 tests each)

### Estimated Effort

**2–3 days** (depends on split-pane complexity)

---

## Phase 3: Feature Screens

### 3A. Home Menu Screen

**File:** `apps/web/src/features/menu/components/main-menu.tsx`

**Mockup reference:** Mockup #4 (Stargazer TUI Home Menu)

**Layout:**
```
┌─────────────────────────────┐
│  Stargazer Observatory      │
│  AI-Powered Code Review     │
├─────────────────────────────┤
│  Quick Actions:             │
│  [ Review Unstaged ]        │
│  [ Review Staged ]          │
│  [ View History ]           │
│  [ Sessions ]               │
│  [ Settings ]               │
└─────────────────────────────┘
```

**Components:**
- Logo + tagline
- Action buttons (flex column, centered)
- Optional: recent review cards

**Dependencies:** Phase 1 (Button, Card)

**Testing:**
- Each button navigates to correct route
- Keyboard navigation works (Tab through buttons)

---

### 3B. Review Screen (Main Feature)

**File:** `apps/web/src/features/review/components/review-screen.tsx`

**Mockup reference:** Mockup #1, #2 (Observatory Review, TUI Review Workflow)

**Layout:**
```
┌─────────────────────────────────────────────────────┐
│  Header (navigation)                                │
├──────────────────────┬──────────────────────────────┤
│  Sidebar             │  Content Panel               │
│  - Issue List        │  - Issue Details             │
│  - Filters           │  - Code Diff                 │
│  - Sorting           │  - Suggestion Callouts       │
│  (Left Pane)         │  - Action Buttons            │
│                      │  (Right Pane)               │
└──────────────────────┴──────────────────────────────┘
│  Footer                                             │
└─────────────────────────────────────────────────────┘
```

**Child Components:**

| Component | File | Purpose |
|-----------|------|---------|
| Issue List | `apps/web/src/features/review/components/issue-list.tsx` | Scrollable list of issues with filters/sort |
| Issue Item | `apps/web/src/features/review/components/issue-item.tsx` | Single issue row (clickable) |
| Issue Details | `apps/web/src/features/review/components/issue-details.tsx` | Full issue info + diff + actions |
| Code Diff | `apps/web/src/features/review/components/code-diff.tsx` | Syntax-highlighted diff viewer |
| Severity Badge | `apps/web/src/features/review/components/severity-badge.tsx` | Color-coded severity indicator |
| Filter Toolbar | `apps/web/src/features/review/components/filter-toolbar.tsx` | Lens/severity/source filters |
| Actions Panel | `apps/web/src/features/review/components/actions-panel.tsx` | Apply patch, Ignore, Drill down buttons |

**Dependencies:**
- Phase 1 (Button, Badge, Input, Tabs)
- Phase 2 (SplitPane, Header, Footer)
- Lucide React (icons)
- @repo/api (fetch issues, apply patches)
- @repo/schemas (TriageIssue, ReviewRun types)

**Data Flow:**
```
ReviewScreen (router params: scope, reviewId)
├─ fetch reviewRun (API)
├─ fetch issues (API)
├─ manage filters (local state)
├─ manage selected issue (local state)
└─ dispatch actions (apply patch, ignore, etc.)
```

**Testing:**
- Load issues from API mock
- Click issue → detail panel updates
- Filter changes update list
- Action buttons call correct API endpoints
- Diff renders code blocks correctly

**Acceptance Criteria:**
- [ ] Issue list loads and displays ≥5 issues
- [ ] Click issue → sidebar highlights, details panel updates
- [ ] Filters work: by severity, lens, source
- [ ] Code diff renders with syntax highlighting
- [ ] "Apply Patch" button calls API
- [ ] "Ignore" button removes issue from list
- [ ] "Drill Down" button opens inspector modal
- [ ] Responsive: pane switches to vertical layout on mobile

---

### 3C. History Page

**File:** `apps/web/src/features/history/components/history-page.tsx`

**Mockup reference:** Mockup #5 (Stargazer TUI History List)

**Layout:**
```
┌─────────────────────────────────────────┐
│  Header (navigation)                    │
├─────────────────────────────────────────┤
│  Filters: [Lens] [Severity] [Date Range]│
│  ┌───────────────────────────────────┐  │
│  │ Review ID │ Scope │ Date │ Issues │  │
│  ├───────────────────────────────────┤  │
│  │ abc123    │ staged│ 2h ago│ 12   │  │
│  │ def456    │ all   │ 5h ago│ 8    │  │
│  └───────────────────────────────────┘  │
└─────────────────────────────────────────┘
```

**Child Components:**

| Component | File | Purpose |
|-----------|------|---------|
| History Table | `apps/web/src/features/history/components/history-table.tsx` | Table of past reviews |
| Row | `apps/web/src/features/history/components/history-row.tsx` | Clickable row with details |
| Filters | `apps/web/src/features/history/components/history-filters.tsx` | Filter by scope, date, severity |

**Dependencies:**
- Phase 1 (Button, Badge, Input, Card)
- Phase 2 (Header, Footer, TabNav)
- @repo/api (fetch history)
- @repo/schemas (ReviewRun type)

**Testing:**
- Load reviews from API mock
- Click row → navigate to `/review/$reviewId`
- Filters update table
- Sort by date, scope, issue count

---

### 3D. Settings Page

**File:** `apps/web/src/features/settings/components/settings-page.tsx`

**Mockup reference:** Mockup #6–#8 (Settings screens with tabs)

**Layout:**
```
┌─────────────────────────────────────────┐
│  Header (navigation)                    │
├────────────────────────────────────────┤
│  Tabs: [Providers] [Permissions] [Diag] │
├────────────────────────────────────────┤
│  Tab Content (varies by tab):           │
│  - Provider: API key input, model sel   │
│  - Permissions: Trust config matrix     │
│  - Diagnostics: Server status, logs     │
└────────────────────────────────────────┘
```

**Child Components:**

| Component | File | Purpose |
|-----------|------|---------|
| Settings Page | `apps/web/src/features/settings/components/settings-page.tsx` | Tab router |
| Provider Config | `apps/web/src/features/settings/components/provider-config.tsx` | API key, model, endpoint inputs |
| Permissions | `apps/web/src/features/settings/components/permissions-tab.tsx` | Trust matrix for repos |
| Diagnostics | `apps/web/src/features/settings/components/diagnostics-tab.tsx` | Server health, error logs |

**Dependencies:**
- Phase 1 (Button, Input, Card, Tabs, Badge)
- Phase 2 (Header, Footer)
- @repo/api (fetch/update settings)
- @repo/schemas (SettingsConfig, TrustConfig types)

**Testing:**
- Load settings from API
- Update provider config → API call
- Toggle trust settings
- Display server diagnostics

---

## Phase 4: Modals & Polish

### Goals
- Implement modal dialogs
- Add confirmation flows
- Improve error handling and edge cases
- Performance optimizations

### Files to Create

| File | Purpose |
|------|---------|
| `apps/web/src/features/modals/components/trust-prompt-modal.tsx` | Trust confirmation (Mockup #3) |
| `apps/web/src/features/modals/components/setup-wizard-modal.tsx` | First-time setup (onboarding) |
| `apps/web/src/features/modals/components/agent-inspector-modal.tsx` | Drill-down details (Mockup #7) |
| `apps/web/src/features/modals/components/confirm-modal.tsx` | Generic confirmation (delete, apply patch) |
| `apps/web/src/features/modals/hooks/use-modal.ts` | Modal state & open/close logic |
| `apps/web/src/features/modals/provider/modal-provider.tsx` | Context for modal queue |

### Modal Specifications

**Trust Prompt Modal** (Mockup #3)
```
Title: "Trust this repository?"
Body: "Allow Stargazer to review code in <repo>?"
Actions: [Cancel] [Trust Permanently] [Trust This Session]
```

**Setup Wizard** (onboarding)
```
Step 1: "Select AI Provider" → dropdown
Step 2: "API Key" → input
Step 3: "Test Connection" → button + spinner
Step 4: "Success" → next button
```

**Agent Inspector** (Drill-down)
```
Title: "Agent Analysis: <Issue Title>"
Tabs: [Reasoning] [Suggestions] [Related Issues]
Details: Full conversation transcript with AI
```

### Dependencies

- Phase 1 (Button, Input, Modal, Tabs)
- @repo/api (trigger drill-down, test API key)
- @repo/schemas (TriageIssue, AgentEvent types)

### Testing Approach

- Modal opens/closes correctly
- Form submission calls API
- Error messages display
- Keyboard: Escape closes modal, Tab cycles through controls

### Acceptance Criteria

- [ ] Trust modal appears on first repo access
- [ ] Setup wizard guides new users
- [ ] Agent inspector loads and displays reasoning
- [ ] All modals are keyboard-accessible
- [ ] Forms validate and show errors
- [ ] Modal backdrop dismisses on Escape

### Estimated Effort

**2 days**

---

## Phase 5: Accessibility & Performance Audit

### Goals
- Ensure WCAG 2.1 AA compliance
- Optimize bundle size and load time
- Code-split pages with React Router lazy()
- Verify Lighthouse score ≥90

### Tasks

- [ ] Run Axe accessibility audit on each page
- [ ] Test keyboard navigation (Tab, Enter, Escape, Arrow keys)
- [ ] Verify color contrast ratios (4.5:1 for text)
- [ ] Add ARIA labels to interactive elements
- [ ] Code-split page components with `lazy()` in router
- [ ] Implement virtual scroll for long issue lists
- [ ] Profile bundle size (target: <100 kB gzipped JS)
- [ ] Test on mobile devices (iPhone, Android tablet)
- [ ] Run Lighthouse (target: 90+ on all metrics)

### Tools & Commands

```bash
# Type check
npm run type-check

# Build & analyze bundle
npm run build
# (check dist/assets for size)

# Run Lighthouse via CLI
npx lighthouse http://localhost:5173 --view

# Accessibility audit
# (use browser DevTools Lighthouse tab)
```

### Acceptance Criteria

- [ ] Lighthouse Performance ≥90
- [ ] Lighthouse Accessibility ≥95
- [ ] Bundle size ≤100 kB gzipped
- [ ] All interactive elements keyboard-accessible
- [ ] ARIA labels present on custom components
- [ ] Color contrast ≥4.5:1 on all text

### Estimated Effort

**1–2 days**

---

## Testing Summary

### Unit Tests (Phase 1–2)
- UI primitives: Button, Input, Badge, etc.
- Layout: Header, Footer, SplitPane responsiveness

### Integration Tests (Phase 3)
- ReviewScreen: load, filter, select, interact
- HistoryPage: load table, sort, navigate
- SettingsPage: load/save config, validation
- Each page: route loads correctly, layout renders

### E2E Tests (Phase 4–5)
- Full flow: navigate → review → apply patch → confirm
- Modal flow: open → fill form → submit → close
- Error handling: network failure, validation, server error

### Test Command
```bash
npx vitest run --reporter=verbose
```

---

## Dependency Graph

```
Phase 1 (Primitives)
    ↓
Phase 2 (Layout)
    ↓
Phase 3 (Screens)
    ├─ Home Menu (trivial)
    ├─ Review (complex: APIs, filtering, state)
    ├─ History (medium: table, sorting)
    └─ Settings (medium: forms, validation)
    ↓
Phase 4 (Modals)
    └─ Depends on Screens + Primitives
    ↓
Phase 5 (Audit & Polish)
```

**Critical Path:** Phase 1 → Phase 2 → Phase 3B (Review Screen) → Phase 4

---

## Implementation Checklist

### Phase 1: Foundation
- [ ] Tailwind config with design tokens
- [ ] Button component + variants (primary, secondary, outline, ghost)
- [ ] Input component + error states
- [ ] Badge component (severity, status)
- [ ] Card component
- [ ] Tabs component
- [ ] Popover component
- [ ] Tooltip component
- [ ] Modal component
- [ ] Unit tests for all primitives (≥3 tests each)

### Phase 2: Layout
- [ ] Header component (logo, nav tabs, user profile)
- [ ] Footer bar (connection status, user info)
- [ ] Main layout wrapper (Header + Outlet + Footer)
- [ ] Split pane (left/right, resizable)
- [ ] Sidebar component
- [ ] Content panel component
- [ ] Breadcrumb navigation
- [ ] Tab navigation component
- [ ] Empty state component
- [ ] Loading skeleton component
- [ ] Integration tests (≥2 per component)

### Phase 3: Feature Screens
- [ ] Home Menu
  - [ ] Logo + tagline
  - [ ] Quick action buttons
  - [ ] Navigation tests
- [ ] Review Screen (CRITICAL PATH)
  - [ ] SplitPane layout
  - [ ] Issue list with filters
  - [ ] Issue detail panel
  - [ ] Code diff viewer
  - [ ] Severity badges
  - [ ] Filter toolbar
  - [ ] Actions panel (Apply, Ignore, Drill Down)
  - [ ] API integration tests
- [ ] History Page
  - [ ] Table layout
  - [ ] Row components
  - [ ] Filter controls
  - [ ] Sort functionality
  - [ ] Navigation to detail
- [ ] Settings Page
  - [ ] Tab structure
  - [ ] Provider config tab (API key, model, endpoint)
  - [ ] Permissions tab
  - [ ] Diagnostics tab
  - [ ] Form validation
  - [ ] API integration

### Phase 4: Modals
- [ ] Trust prompt modal
- [ ] Setup wizard (multi-step)
- [ ] Agent inspector (with tabs)
- [ ] Confirm modal (generic reusable)
- [ ] Modal context provider
- [ ] Modal hook
- [ ] Keyboard navigation tests

### Phase 5: Audit & Polish
- [ ] Accessibility audit (Axe)
- [ ] Keyboard navigation validation
- [ ] Color contrast check
- [ ] ARIA labels review
- [ ] Code splitting in router
- [ ] Virtual scroll for issue list (if needed)
- [ ] Bundle size analysis
- [ ] Lighthouse audit (all metrics ≥90)
- [ ] Mobile responsiveness testing
- [ ] Performance profiling

---

## File Structure (After All Phases)

```
apps/web/src/
├── app/
│   ├── router.tsx
│   ├── providers/
│   │   ├── index.tsx
│   │   └── config-provider.tsx
│   └── routes/
│       ├── __root.tsx
│       ├── index.tsx (Home Menu)
│       ├── review/
│       │   ├── index.tsx
│       │   └── $reviewId.tsx
│       ├── history.tsx
│       └── settings.tsx
├── components/
│   ├── ui/ (Phase 1)
│   │   ├── button.tsx
│   │   ├── input.tsx
│   │   ├── badge.tsx
│   │   ├── card.tsx
│   │   ├── tabs.tsx
│   │   ├── popover.tsx
│   │   ├── tooltip.tsx
│   │   ├── modal.tsx
│   │   └── index.ts
│   └── layout/ (Phase 2)
│       ├── header.tsx
│       ├── footer-bar.tsx
│       ├── main-layout.tsx
│       ├── split-pane.tsx
│       ├── sidebar.tsx
│       └── content-panel.tsx
├── features/
│   ├── menu/ (Phase 3A)
│   │   └── components/
│   │       └── main-menu.tsx
│   ├── review/ (Phase 3B)
│   │   ├── components/
│   │   │   ├── review-screen.tsx
│   │   │   ├── issue-list.tsx
│   │   │   ├── issue-item.tsx
│   │   │   ├── issue-details.tsx
│   │   │   ├── code-diff.tsx
│   │   │   ├── severity-badge.tsx
│   │   │   ├── filter-toolbar.tsx
│   │   │   └── actions-panel.tsx
│   │   ├── hooks/
│   │   └── api/
│   ├── history/ (Phase 3C)
│   │   ├── components/
│   │   │   ├── history-page.tsx
│   │   │   ├── history-table.tsx
│   │   │   ├── history-row.tsx
│   │   │   └── history-filters.tsx
│   │   └── api/
│   ├── settings/ (Phase 3D)
│   │   ├── components/
│   │   │   ├── settings-page.tsx
│   │   │   ├── provider-config.tsx
│   │   │   ├── permissions-tab.tsx
│   │   │   └── diagnostics-tab.tsx
│   │   ├── hooks/
│   │   └── api/
│   └── modals/ (Phase 4)
│       ├── components/
│       │   ├── trust-prompt-modal.tsx
│       │   ├── setup-wizard-modal.tsx
│       │   ├── agent-inspector-modal.tsx
│       │   └── confirm-modal.tsx
│       ├── hooks/
│       │   └── use-modal.ts
│       └── provider/
│           └── modal-provider.tsx
├── styles/
│   ├── globals.css
│   └── tailwind.config.ts (moved from root)
└── index.css
```

---

## Key Notes

1. **Mockup Mapping:**
   - Mockup #1: Review Screen (Observatory)
   - Mockup #2: Review Screen (TUI)
   - Mockup #3: Trust Prompt Modal
   - Mockup #4: Home Menu
   - Mockup #5: History Page
   - Mockup #6–#8: Settings tabs
   - Mockups #9–#26: Variants, states, edge cases

2. **Existing Dependencies:**
   - `@repo/api` – API client (use for all data fetches)
   - `@repo/schemas` – Zod schemas and types (use for validation)
   - `@repo/core` – Utilities (escapeXml, formatRelativeTime, etc.)
   - TanStack Router – already configured
   - Tailwind CSS 4 – already installed
   - Base UI / Catppuccin theme – already available

3. **Not in Scope (later phases):**
   - Chat/conversation UI (future feature)
   - Provider selection flow (covered in wizard)
   - Session replay UI (sessions page exists but can be minimal)
   - Real-time collaboration features

4. **Time Estimate:**
   - Phase 1: 2–3 days
   - Phase 2: 2–3 days
   - Phase 3: 4–5 days (Review Screen is complex)
   - Phase 4: 1–2 days
   - Phase 5: 1–2 days
   - **Total: 10–15 days for team of 1–2**

5. **Recommended Execution:**
   - Start Phase 1 first (unblocks everything else)
   - Parallelize Phase 2 while finishing Phase 1
   - Phase 3B (Review) is critical path → start immediately after Phase 2
   - Phase 3C & 3D can run in parallel
   - Phase 4 after all screens are functional
   - Phase 5 is final polish/audit

---

## Commands & Resources

### Development
```bash
npm run dev                    # Start Vite dev server
npm run build                  # Build all packages
npm run type-check             # TypeScript validation
```

### Testing
```bash
npx vitest run                 # Run all tests
npx vitest run --ui           # Interactive test runner
npx vitest run --coverage      # Coverage report
```

### Style Reference
- **Colors:** See Phase 1 design tokens
- **Typography:** Space Grotesk (display), Inter (body), JetBrains Mono (code)
- **Spacing:** Tailwind defaults (4px base unit)
- **Shadows:** Custom glow effect for primary elements

### API Reference
- Fetch reviews: `GET /triage`
- Apply patch: `POST /triage/apply-patch`
- Fetch history: `GET /reviews`
- Get settings: `GET /settings`
- Update settings: `POST /settings`

### Component Props Pattern
All components use TypeScript interfaces extending HTMLAttributes for semantic props:

```typescript
interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "outline" | "ghost";
  size?: "sm" | "md" | "lg";
  isLoading?: boolean;
}

export function Button({ variant = "primary", size = "md", ...props }: ButtonProps) {
  // implementation
}
```

---

## Next Actions

1. **Immediate (Start Phase 1):**
   - [ ] Extend tailwind.config.ts with design tokens from mockups
   - [ ] Create UI primitives folder structure
   - [ ] Implement Button component + variants
   - [ ] Write unit tests for Button

2. **After Phase 1 Complete:**
   - [ ] Start Phase 2 (Layout components)
   - [ ] Begin Phase 3B (Review Screen) design

3. **Parallel work (if team >1):**
   - One person: Phase 3B (Review - complex)
   - Another person: Phase 3C & 3D (History, Settings)

4. **Final checks (Phase 5):**
   - Lighthouse audit
   - Accessibility review
   - Mobile testing
   - Performance optimization
