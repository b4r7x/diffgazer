# Sync All Views

Synchronize ALL CLI views/screens to match web app pages. Complete structural alignment following bulletproof-react patterns.

---

## Scope

### Web Pages (Target)
```
apps/web/src/app/pages/
├── home.tsx              → MainMenuView
├── review.tsx            → ReviewView
├── history.tsx           → HistoryScreen (runs + sessions tabs)
├── settings-hub.tsx      → SettingsScreen (hub)
├── settings.tsx          → SettingsScreen (legacy)
├── settings-theme.tsx    → SettingsScreen (theme step)
├── trust-permissions.tsx → SettingsScreen (trust step)
├── provider-selector.tsx → SettingsScreen (provider step)
└── settings-about.tsx    → SettingsScreen (diagnostics step)
```

### CLI Views (Current)
```
apps/cli/src/app/views/
├── main-menu-view.tsx       ✓ Keep, align with HomePage
├── review-view.tsx          ✓ Keep, align with ReviewPage
├── review-history-view.tsx  ✗ Remove, merge into HistoryView
├── sessions-view.tsx        ✗ Remove, merge into HistoryView
├── git-status-view.tsx      ✓ Keep (CLI-only)
├── git-diff-view.tsx        ✓ Keep (CLI-only)
├── settings-view.tsx        ✓ Keep, align with SettingsHub
└── loading-view.tsx         ✓ Keep (CLI-only startup)
```

### CLI Screens (Current)
```
apps/cli/src/app/screens/
├── review-history-screen.tsx  ✗ Remove, replace with HistoryScreen
├── sessions-screen.tsx        ✗ Remove, merge into HistoryScreen
└── settings-screen.tsx        ✓ Keep, align with web settings pages
```

---

## Execution Flow

```
╔═══════════════════════════════════════════════════════════════╗
║  PHASE 1: FULL AUDIT                                          ║
╠═══════════════════════════════════════════════════════════════╣
║  1.1 Web Pages Inventory      → All pages + features used     ║
║  1.2 CLI Views Inventory      → All views + screens           ║
║  1.3 Feature Comparison       → features/* web vs cli         ║
║  1.4 Component Gap Analysis   → UI components needed          ║
║  1.5 Hook/API Gap Analysis    → Data fetching alignment       ║
╠═══════════════════════════════════════════════════════════════╣
║  ⏸️  CHECKPOINT - Full gap report                              ║
╠═══════════════════════════════════════════════════════════════╣
║  PHASE 2: ARCHITECTURE DESIGN                                 ║
╠═══════════════════════════════════════════════════════════════╣
║  2.1 Target CLI Structure     → Final folder layout           ║
║  2.2 View-by-View Design      → Each view's components        ║
║  2.3 Shared Components        → New UI components needed      ║
║  2.4 State Management         → Per-view state design         ║
║  2.5 Navigation Flow          → Menu → Views → Back           ║
╠═══════════════════════════════════════════════════════════════╣
║  ⏸️  CHECKPOINT - Architecture approval                        ║
╠═══════════════════════════════════════════════════════════════╣
║  PHASE 3: IMPLEMENT BY VIEW                                   ║
╠═══════════════════════════════════════════════════════════════╣
║  3.1 HomePage → MainMenuView  → Align layout + status         ║
║  3.2 ReviewPage → ReviewView  → Align 3-phase flow            ║
║  3.3 HistoryPage → HistoryView → NEW unified history          ║
║  3.4 Settings* → SettingsView → Align with web settings       ║
║  3.5 Feature Modules          → Create missing features/*     ║
║  3.6 Cleanup                  → Remove deprecated files       ║
╠═══════════════════════════════════════════════════════════════╣
║  PHASE 4: VALIDATE                                            ║
╠═══════════════════════════════════════════════════════════════╣
║  4.1 Type Check + Build                                       ║
║  4.2 Test Suite                                               ║
║  4.3 Bulletproof Structure                                    ║
║  4.4 Manual Smoke Test                                        ║
╚═══════════════════════════════════════════════════════════════╝
```

---

## PHASE 1: FULL AUDIT

### 1.1 Web Pages Inventory

```
Agent: feature-dev:code-explorer (opus)

For EACH page in apps/web/src/app/pages/:

home.tsx:
- Layout structure (sidebar + main content)
- Components used (StatusCard, Menu, ContextPane)
- Keyboard shortcuts
- Navigation actions

review.tsx:
- 3-phase flow (progress → summary → results)
- Split pane layout (issues list | issue details)
- Components (IssueListItem, IssueDetailsPane, SeverityFilter)
- Streaming state management

history.tsx:
- 3-column layout (timeline | runs | insights)
- Tab system (runs | sessions)
- Components (TimelineList, RunAccordionItem, HistoryInsightsPane)
- Focus zone management

settings-hub.tsx:
- Menu navigation to sub-settings
- Layout structure

settings-theme.tsx:
- Theme selector with preview
- Components used

trust-permissions.tsx:
- Trust capabilities UI
- Toggle controls

provider-selector.tsx:
- Provider list with status
- API key management
- Model selector

settings-about.tsx:
- Diagnostics display
- System info

Output: Page-by-page component tree + state requirements
```

### 1.2 CLI Views Inventory

```
Agent: feature-dev:code-explorer (opus)

For EACH view in apps/cli/src/app/views/ and screens/:

main-menu-view.tsx:
- Current layout
- Components used
- Gap vs web HomePage

review-view.tsx:
- Current layout (split pane?)
- Issue display
- Gap vs web ReviewPage

review-history-view.tsx + review-history-screen.tsx:
- Current structure
- What's missing vs web HistoryPage

sessions-view.tsx + sessions-screen.tsx:
- Current structure
- Should merge into HistoryView

settings-view.tsx + settings-screen.tsx:
- Current wizard steps
- Gap vs web settings pages

git-status-view.tsx:
- Keep as CLI-only

git-diff-view.tsx:
- Keep as CLI-only

loading-view.tsx:
- Keep as CLI-only

Output: View-by-view gap analysis
```

### 1.3 Feature Comparison

```
Agent: feature-dev:code-explorer (opus)

Compare features/* between web and cli:

| Feature | Web Structure | CLI Structure | Gap |
|---------|---------------|---------------|-----|
| review | components/, hooks/, api/, constants/ | components/, hooks/, api/, utils/ | ? |
| history | components/ | - | Missing |
| home | components/ | - | Missing? |
| providers | components/, hooks/, api/ | - | Missing |
| sessions | hooks/, api/ | components/, hooks/, api/ | Check |
| settings | hooks/, api/ | hooks/, api/ | Check |

Output: Feature-by-feature comparison table
```

### 1.4 Component Gap Analysis

```
Agent: react-component-architect (opus)

Compare components/ui/ between web and cli.

Already synced (from 02-component-mirror):
- All base UI components ✓

Feature-specific components needed:
| Web Component | Location | CLI Equivalent | Status |
|---------------|----------|----------------|--------|
| TimelineList | features/history/components | - | Create |
| RunAccordionItem | features/history/components | - | Create |
| HistoryInsightsPane | features/history/components | - | Create |
| ContextSidebar | features/home/components | - | Create |
| ReviewProgressPane | features/review/components | ? | Check |
| ReviewSummaryPane | features/review/components | ? | Check |
| ProviderCard | features/providers/components | - | Create |
| ThemePreviewCard | components/theme | - | Create |

Output: Component creation list with priorities
```

### 1.5 Hook/API Gap Analysis

```
Agent: feature-dev:code-explorer (opus)

Compare hooks between web and cli:

| Hook | Web | CLI | Gap |
|------|-----|-----|-----|
| useGitStatus | ✓ | ✓ | - |
| useGitDiff | ✓ | ✓ | - |
| useTriageStream | ✓ | ✓ | Check API |
| useTriageReviews | ✓ | ✓ | Check API |
| useProviders | ✓ | ? | Check |
| useSettings | ✓ | ✓ | Check |
| useTrust | ✓ | ✓ | Check |
| useSessions | ✓ | ✓ | Check |
| useConfig | ✓ | ✓ | Check |

Output: Hook alignment table
```

### 1.6 CHECKPOINT

```
╔═══════════════════════════════════════════════════════════════╗
║  ⏸️  FULL AUDIT COMPLETE                                       ║
║                                                               ║
║  Show:                                                        ║
║  - All web pages with component trees                         ║
║  - All CLI views with current structure                       ║
║  - Feature-by-feature comparison                              ║
║  - Component gap list (what to create)                        ║
║  - Hook/API alignment status                                  ║
║                                                               ║
║  Ask: "Review full audit. Type 'ok' to proceed to DESIGN"     ║
╚═══════════════════════════════════════════════════════════════╝
```

---

## PHASE 2: ARCHITECTURE DESIGN

### 2.1 Target CLI Structure

```
Agent: feature-dev:code-architect (opus)

Design final CLI structure matching web:

apps/cli/src/
├── app/
│   ├── views/
│   │   ├── index.ts
│   │   ├── main-menu-view.tsx    # ← HomePage
│   │   ├── review-view.tsx       # ← ReviewPage
│   │   ├── history-view.tsx      # ← HistoryPage (NEW)
│   │   ├── settings-view.tsx     # ← SettingsHub
│   │   ├── git-status-view.tsx   # CLI-only
│   │   ├── git-diff-view.tsx     # CLI-only
│   │   └── loading-view.tsx      # CLI-only
│   ├── screens/
│   │   ├── index.ts
│   │   ├── history-screen.tsx    # NEW: 3-pane history
│   │   └── settings-screen.tsx   # Existing, enhance
│   └── app.tsx                   # Updated navigation
├── features/
│   ├── review/                   # Existing, enhance
│   ├── history/                  # NEW feature
│   │   ├── index.ts
│   │   ├── types.ts
│   │   ├── components/
│   │   └── hooks/
│   ├── home/                     # NEW feature (if needed)
│   │   ├── index.ts
│   │   └── components/
│   ├── providers/                # NEW feature
│   │   ├── index.ts
│   │   ├── components/
│   │   └── hooks/
│   ├── sessions/                 # Existing
│   ├── settings/                 # Existing
│   └── chat/                     # Existing
└── components/ui/                # Already synced
```

### 2.2 View-by-View Design

```
Agent: react-component-architect (opus)

Design each view's internal structure:

MainMenuView (← HomePage):
┌─────────────────────────────────────────┐
│ HeaderBrand                             │
├─────────────────┬───────────────────────┤
│ StatusCard      │ Menu                  │
│ - Provider      │ - [R] Review Code     │
│ - Model         │ - [H] History         │
│ - Trust status  │ - [S] Settings        │
│                 │ - [Q] Quit            │
├─────────────────┴───────────────────────┤
│ FooterBar                               │
└─────────────────────────────────────────┘

ReviewView (← ReviewPage):
┌─────────────────────────────────────────┐
│ Phase: [Progress] → [Summary] → [Results]│
├─────────────────┬───────────────────────┤
│ IssueList       │ IssueDetails          │
│ - Severity      │ - Title + severity    │
│ - Filters       │ - Location            │
│ - Navigation    │ - Rationale           │
│                 │ - Recommendation      │
│                 │ - Code snippet        │
├─────────────────┴───────────────────────┤
│ FooterBar (actions per phase)           │
└─────────────────────────────────────────┘

HistoryView (← HistoryPage):
┌─────────────────────────────────────────┐
│ Tabs: [Runs] [Sessions]                 │
├────────┬────────────────┬───────────────┤
│Timeline│ RunList        │ Insights      │
│ Today  │ #8821 Staged   │ Severity      │
│ Yest.  │ #8820 Main     │ Top Lenses    │
│ Jan 29 │ #8819 feat/x   │ Top Issues    │
├────────┴────────────────┴───────────────┤
│ FooterBar                               │
└─────────────────────────────────────────┘

SettingsView (← SettingsHub + sub-pages):
┌─────────────────────────────────────────┐
│ Settings Menu / Active Section          │
├─────────────────────────────────────────┤
│ [P] Provider & Model                    │
│ [T] Theme                               │
│ [R] Trust & Permissions                 │
│ [D] Diagnostics                         │
├─────────────────────────────────────────┤
│ FooterBar                               │
└─────────────────────────────────────────┘
```

### 2.3 Shared Components Needed

```
Agent: react-component-architect (opus)

New components to create in features/:

features/history/components/:
- timeline-list.tsx         # Date list with counts
- run-list-item.tsx        # Expandable run entry
- run-accordion.tsx        # Accordion container
- history-insights.tsx     # Right pane summary
- session-list-item.tsx    # Session entry

features/home/components/:
- context-sidebar.tsx      # Left status panel
- action-menu.tsx          # Right action list

features/providers/components/:
- provider-card.tsx        # Provider with status
- provider-list.tsx        # List of providers
- model-selector.tsx       # Model dropdown
- api-key-input.tsx        # Masked key input

features/review/components/ (check existing):
- review-progress.tsx      # Progress phase
- review-summary.tsx       # Summary phase
- issue-details-pane.tsx   # Detail view
```

### 2.4 State Management Design

```
Agent: react-state-manager (opus)

Design state for each view:

MainMenuState:
- selectedAction: string
- providerStatus: ProviderStatus
- trustStatus: TrustStatus

ReviewState (existing, verify):
- phase: 'progress' | 'summary' | 'results'
- issues: TriageIssue[]
- selectedIssueId: string | null
- filterSeverity: SeverityLevel[]

HistoryState:
- activeTab: 'runs' | 'sessions'
- focusZone: 'timeline' | 'list' | 'insights'
- selectedDate: string
- selectedRunId: string | null
- expandedRunId: string | null
- runs: TriageReview[]
- sessions: Session[]

SettingsState (existing, verify):
- activeSection: 'provider' | 'theme' | 'trust' | 'diagnostics'
- (section-specific state)
```

### 2.5 Navigation Flow Design

```
Agent: react-component-architect (opus)

Design navigation in app.tsx:

type View =
  | 'loading'
  | 'main-menu'
  | 'review'
  | 'history'        # NEW (replaces review-history + sessions)
  | 'settings'
  | 'git-status'     # CLI-only
  | 'git-diff';      # CLI-only

Navigation actions:
MainMenu:
  - 'r' → review
  - 'h' → history    # Changed from separate views
  - 's' → settings
  - 'g' → git-status
  - 'd' → git-diff

All views:
  - Esc → main-menu (or previous)

History:
  - Tab → switch tabs (runs/sessions)
  - Enter → open run in review

Settings:
  - Number keys → jump to section
  - Esc → back to menu
```

### 2.6 CHECKPOINT

```
╔═══════════════════════════════════════════════════════════════╗
║  ⏸️  ARCHITECTURE DESIGN COMPLETE                              ║
║                                                               ║
║  Show:                                                        ║
║  - Target folder structure                                    ║
║  - View wireframes (ASCII)                                    ║
║  - New components list                                        ║
║  - State shapes                                               ║
║  - Navigation flow                                            ║
║                                                               ║
║  Ask: "Review architecture. Type 'ok' to IMPLEMENT"           ║
╚═══════════════════════════════════════════════════════════════╝
```

---

## PHASE 3: IMPLEMENT BY VIEW

### 3.1 MainMenuView Alignment

```
Agent: react-component-architect (opus)

Align MainMenuView with web HomePage:

Current: Basic menu
Target: StatusCard + Menu layout

Changes:
1. Add left panel with StatusCard showing:
   - Provider name + status
   - Selected model
   - Trust status for current project
2. Update Menu styling to match web
3. Add keyboard hints in footer

Files:
- Modify: app/views/main-menu-view.tsx
- Create: features/home/components/context-sidebar.tsx (if needed)
```

### 3.2 ReviewView Alignment

```
Agent: react-component-architect (opus)

Align ReviewView with web ReviewPage:

Current: Split pane with issues
Target: 3-phase flow (progress → summary → results)

Check existing implementation matches:
1. Progress phase with streaming
2. Summary phase with overview
3. Results phase with issue browser

Files:
- Review: app/views/review-view.tsx
- Check: features/review/components/*
- Align any gaps with web
```

### 3.3 HistoryView (NEW)

```
Agent: react-component-architect (opus)

Create unified HistoryView matching web HistoryPage:

Structure:
- 3-pane layout (timeline | list | insights)
- Tab system (runs | sessions)
- Keyboard navigation between zones
- j/k for list navigation
- Enter to expand/open

Files to create:
- app/views/history-view.tsx (wrapper)
- app/screens/history-screen.tsx (implementation)
- features/history/index.ts
- features/history/types.ts
- features/history/components/index.ts
- features/history/components/timeline-list.tsx
- features/history/components/run-list-item.tsx
- features/history/components/history-insights.tsx
- features/history/components/session-list-item.tsx
- features/history/hooks/index.ts
- features/history/hooks/use-history-state.ts
```

### 3.4 SettingsView Alignment

```
Agent: react-component-architect (opus)

Align SettingsView with web settings pages:

Current: Wizard steps
Target: Hub menu + sub-sections (like web)

Check existing settings-screen.tsx covers:
1. Provider selection (← provider-selector.tsx)
2. Theme selection (← settings-theme.tsx)
3. Trust permissions (← trust-permissions.tsx)
4. Diagnostics (← settings-about.tsx)

If hub pattern missing, add:
- Menu to select section
- Back navigation from sections

Files:
- Review: app/views/settings-view.tsx
- Review: app/screens/settings-screen.tsx
- Align with web patterns
```

### 3.5 Feature Modules

```
Agent: javascript-typescript:typescript-pro (opus)

Create/update feature modules:

features/history/ (NEW):
- Full structure as designed in 2.1

features/home/ (if needed):
- context-sidebar.tsx
- action-menu.tsx

features/providers/ (if not exists):
- provider-card.tsx
- Check if hooks exist in settings/

Update barrel exports (index.ts) for all features.
```

### 3.6 Cleanup

```
Agent: javascript-typescript:typescript-pro (opus)

Remove deprecated files:

Delete:
- app/views/review-history-view.tsx
- app/views/sessions-view.tsx
- app/screens/review-history-screen.tsx
- app/screens/sessions-screen.tsx

Update:
- app/views/index.ts (remove old exports, add new)
- app/screens/index.ts (remove old exports, add new)
- app/app.tsx (update view type, remove old cases)

Verify no broken imports remain.
```

---

## PHASE 4: VALIDATE

### 4.1 Type Check + Build

```
npm run type-check
npm run build
```

### 4.2 Test Suite

```
npx vitest run
```

### 4.3 Bulletproof Structure

```
Agent: code-reviewer (opus)

Validate:
- All features/ have proper structure (index.ts, components/, hooks/)
- No cross-feature imports
- Barrel exports complete
- kebab-case file names
- Co-located types
```

### 4.4 Manual Smoke Test

```
Run CLI and verify:
- [ ] MainMenu displays with status
- [ ] Review flow works (all 3 phases)
- [ ] History shows runs + sessions tabs
- [ ] History 3-pane navigation works
- [ ] Settings sections all accessible
- [ ] Git views still work
- [ ] All keyboard shortcuts work
- [ ] Esc returns to menu from all views
```

---

## Summary Tables

### Views Transformation

| Web Page | CLI View (Before) | CLI View (After) |
|----------|-------------------|------------------|
| HomePage | main-menu-view | main-menu-view (enhanced) |
| ReviewPage | review-view | review-view (aligned) |
| HistoryPage | review-history-view + sessions-view | history-view (unified) |
| SettingsHub | settings-view | settings-view (hub pattern) |
| settings-theme | settings-screen (step) | settings-screen (section) |
| trust-permissions | settings-screen (step) | settings-screen (section) |
| provider-selector | settings-screen (step) | settings-screen (section) |
| settings-about | settings-screen (step) | settings-screen (section) |
| - | git-status-view | git-status-view (keep) |
| - | git-diff-view | git-diff-view (keep) |
| - | loading-view | loading-view (keep) |

### Files to Create

| Path | Purpose |
|------|---------|
| features/history/index.ts | Barrel export |
| features/history/types.ts | HistoryRun, TimelineItem |
| features/history/components/*.tsx | 5 components |
| features/history/hooks/*.ts | 2 hooks |
| app/views/history-view.tsx | View wrapper |
| app/screens/history-screen.tsx | 3-pane screen |

### Files to Delete

| Path | Reason |
|------|--------|
| app/views/review-history-view.tsx | Merged into history-view |
| app/views/sessions-view.tsx | Merged into history-view |
| app/screens/review-history-screen.tsx | Replaced by history-screen |
| app/screens/sessions-screen.tsx | Merged into history-screen |

### Files to Modify

| Path | Changes |
|------|---------|
| app/app.tsx | Update View type, navigation |
| app/views/index.ts | Export history-view |
| app/views/main-menu-view.tsx | Add status panel |
| app/screens/index.ts | Export history-screen |

---

## Rules

1. **ALL agents use model=opus**
2. **Delegate to subagents** - don't bloat main context
3. **Subagents return**: file:line + one-line summary
4. **Full audit before any implementation**
5. **User approval at each phase checkpoint**
6. **Keep CLI-only features** (git-status, git-diff, loading)
7. **Follow bulletproof-react** in all new code
