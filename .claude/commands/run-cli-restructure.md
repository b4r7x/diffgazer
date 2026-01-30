# CLI Restructure

Restructure CLI to match web app structure, consolidating separate views into unified screens following bulletproof-react patterns.

---

## Execution Flow

```
╔═══════════════════════════════════════════════════════════════╗
║  PHASE 1: AUDIT (Read-only analysis)                          ║
╠═══════════════════════════════════════════════════════════════╣
║  1.1 Web Structure Analysis   → Target patterns               ║
║  1.2 CLI Structure Analysis   → Current state                 ║
║  1.3 Gap Mapping              → What needs to change          ║
║  1.4 Dependency Analysis      → What depends on what          ║
╠═══════════════════════════════════════════════════════════════╣
║  ⏸️  CHECKPOINT - Show findings, wait for "ok"                 ║
╠═══════════════════════════════════════════════════════════════╣
║  PHASE 2: DESIGN (Architecture planning)                      ║
╠═══════════════════════════════════════════════════════════════╣
║  2.1 New Feature Structure    → features/history/             ║
║  2.2 Component Design         → Ink equivalents               ║
║  2.3 State Management         → Unified state                 ║
║  2.4 Navigation Design        → Updated routing               ║
╠═══════════════════════════════════════════════════════════════╣
║  ⏸️  CHECKPOINT - Show design, wait for "ok"                   ║
╠═══════════════════════════════════════════════════════════════╣
║  PHASE 3: IMPLEMENT (Code changes)                            ║
╠═══════════════════════════════════════════════════════════════╣
║  3.1 Create features/history/ → New feature module            ║
║  3.2 Build HistoryScreen      → 3-pane layout                 ║
║  3.3 Build Components         → Timeline, RunList, Insights   ║
║  3.4 Update Navigation        → Consolidate views             ║
║  3.5 Remove Deprecated        → Delete old views              ║
╠═══════════════════════════════════════════════════════════════╣
║  PHASE 4: VALIDATE                                            ║
╠═══════════════════════════════════════════════════════════════╣
║  4.1 Type Check               → npm run type-check            ║
║  4.2 Test Run                 → npx vitest run                ║
║  4.3 Bulletproof Check        → Structure validation          ║
╚═══════════════════════════════════════════════════════════════╝
```

---

## PHASE 1: AUDIT

### 1.1 Web Structure Analysis

```
Agent: feature-dev:code-explorer (opus)

Analyze web app history feature structure.

Target: apps/web/src/

1. Map HistoryPage (apps/web/src/app/pages/history.tsx):
   - Layout structure (3-column: timeline | runs | insights)
   - Tab system (runs vs sessions)
   - Focus zone management
   - Keyboard navigation

2. Map history feature components:
   - features/history/components/

3. Identify shared components used:
   - Panel, FocusablePane, Tabs, NavigationList, SeverityBar

Output: Component hierarchy + data flow
```

### 1.2 CLI Structure Analysis

```
Agent: feature-dev:code-explorer (opus)

Analyze current CLI structure for refactoring.

Target: apps/cli/src/

1. Map current views:
   - app/views/review-history-view.tsx
   - app/views/sessions-view.tsx
   - app/views/git-status-view.tsx
   - app/views/git-diff-view.tsx

2. Map current screens:
   - app/screens/review-history-screen.tsx
   - app/screens/sessions-screen.tsx

3. Map features structure:
   - features/review/ (hooks, api, components)
   - features/sessions/ (hooks, api, components)

Output: Dependency graph + usage counts
```

### 1.3 Gap Mapping

```
Agent: react-component-architect (opus)

Compare web vs CLI and create migration plan.

| Web Component | CLI Equivalent | Gap | Action |
|---------------|----------------|-----|--------|
| HistoryPage | review-history-view + sessions-view | Separate | Consolidate |
| TimelineList | - | Missing | Create |
| RunAccordionItem | - | Missing | Create |
| HistoryInsightsPane | - | Missing | Create |
| Tabs (runs/sessions) | Separate views | Separate | Unify |

Output: Migration plan with file changes
```

### 1.4 Dependency Analysis

```
Agent: code-archaeologist (opus)

Analyze dependencies on deprecated views.

Check imports of:
- review-history-view.tsx
- sessions-view.tsx
- git-status-view.tsx
- git-diff-view.tsx

Output: Safe removal order + migration steps
```

### 1.5 CHECKPOINT

```
⏸️  AUDIT COMPLETE

Show:
- Web structure (target)
- CLI structure (current)
- Gap analysis
- Dependencies to update

Ask: "Review audit. Type 'ok' to proceed to DESIGN"
```

---

## PHASE 2: DESIGN

### 2.1 New Feature Structure

```
Agent: feature-dev:code-architect (opus)

Design features/history/ following bulletproof-react.

apps/cli/src/features/history/
├── index.ts                    # Barrel export
├── types.ts                    # Feature types
├── components/
│   ├── index.ts
│   ├── timeline-list.tsx      # Date navigation
│   ├── run-accordion-item.tsx # Expandable run entry
│   ├── history-insights.tsx   # Right pane insights
│   └── session-list-item.tsx  # Session entry (tab 2)
└── hooks/
    ├── index.ts
    ├── use-history-state.ts   # Unified state
    └── use-history-navigation.ts # Keyboard nav
```

### 2.2 Component Design

```
Agent: react-component-architect (opus)

Design Ink component APIs matching web:
- TimelineList (vertical date list with counts)
- RunAccordionItem (expandable review entry)
- HistoryInsightsPane (severity counts, top lenses, top issues)
- SessionListItem (session entry for tab 2)

Use existing: Panel, FocusablePane, NavigationList, SplitPane
```

### 2.3 State Management

```
Agent: react-state-manager (opus)

interface HistoryState {
  activeTab: 'runs' | 'sessions';
  focusZone: 'timeline' | 'runs' | 'insights';
  selectedDateId: string;
  selectedRunId: string | null;
  expandedRunId: string | null;
  runs: HistoryRun[];
  sessions: Session[];
  isLoading: boolean;
}
```

### 2.4 Navigation Design

```
Agent: react-component-architect (opus)

Current:
MainMenu → ReviewHistory (separate)
MainMenu → Sessions (separate)

New:
MainMenu → History (unified with tabs)
  └── Tab: Runs (review history)
  └── Tab: Sessions

Keep separate: GitStatus, GitDiff (CLI-specific)
```

### 2.5 CHECKPOINT

```
⏸️  DESIGN COMPLETE

Show:
- New folder structure
- Component interfaces
- State management approach
- Navigation changes

Ask: "Review design. Type 'ok' to proceed to IMPLEMENT"
```

---

## PHASE 3: IMPLEMENT

### 3.1 Create features/history/

```
Agent: javascript-typescript:typescript-pro (opus)

Create:
- features/history/index.ts
- features/history/types.ts
- features/history/hooks/index.ts
- features/history/hooks/use-history-state.ts
- features/history/components/index.ts
```

### 3.2 Build HistoryScreen

```
Agent: react-component-architect (opus)

File: apps/cli/src/app/screens/history-screen.tsx

- 3-pane layout using SplitPane
- Tab system for runs/sessions
- Focus zone management
- Keyboard navigation (Tab, arrows, j/k, Enter, Esc)
```

### 3.3 Build Components (parallel)

```
Agent: react-component-architect (opus)

- timeline-list.tsx
- run-accordion-item.tsx
- history-insights.tsx
- session-list-item.tsx
```

### 3.4 Update Navigation

```
Agent: react-component-architect (opus)

Modify:
- apps/cli/src/app/app.tsx
- apps/cli/src/app/views/main-menu-view.tsx
- apps/cli/src/app/views/index.ts

Create:
- apps/cli/src/app/views/history-view.tsx
```

### 3.5 Remove Deprecated

```
Agent: javascript-typescript:typescript-pro (opus)

Delete:
- app/views/review-history-view.tsx
- app/views/sessions-view.tsx
- app/screens/review-history-screen.tsx
- app/screens/sessions-screen.tsx

Keep:
- app/views/git-status-view.tsx (CLI-specific)
- app/views/git-diff-view.tsx (CLI-specific)
```

---

## PHASE 4: VALIDATE

### 4.1 Type Check

```
npm run type-check
```

### 4.2 Test Run

```
npx vitest run
```

### 4.3 Bulletproof Check

```
Agent: code-reviewer (opus)

Validate:
- features/history/ has proper structure
- No cross-feature imports
- Barrel exports in place
- Components use correct patterns
```

---

## File Changes Summary

| Action | Files |
|--------|-------|
| **Create** | features/history/* (8-10 files) |
| **Create** | app/screens/history-screen.tsx |
| **Create** | app/views/history-view.tsx |
| **Modify** | app/app.tsx |
| **Modify** | app/views/main-menu-view.tsx |
| **Modify** | app/views/index.ts |
| **Delete** | app/views/review-history-view.tsx |
| **Delete** | app/views/sessions-view.tsx |
| **Delete** | app/screens/review-history-screen.tsx |
| **Delete** | app/screens/sessions-screen.tsx |

---

## Rules

1. **ALL agents use model=opus**
2. **Delegate to subagents** - don't bloat main context
3. **Subagents return**: file:line + one-line summary
4. **AUDIT before DESIGN before IMPLEMENT**
5. **User approval required** between phases
6. **Keep git views** - they're CLI-specific features
