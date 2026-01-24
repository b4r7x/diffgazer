# Master UI Implementation Orchestrator

## Overview

This orchestrator implements the complete UI system for Stargazer CLI based on the GPT conversation specifications. It is **self-contained** for empty AI context execution.

---

## Project Context

### What is Stargazer
Local-only CLI tool for AI-powered code review. Server binds to `127.0.0.1` only.

### Tech Stack
- TypeScript, React 19 (Ink for CLI), Chalk, Hono (server), Zod, Vitest
- Vercel AI SDK for multi-provider support

### Monorepo Structure
```
packages/
├── core/       # Shared business logic, Result type, utilities
├── schemas/    # Zod schemas (canonical types) - LEAF PACKAGE
├── api/        # API client - LEAF PACKAGE
apps/
├── server/     # Hono backend (localhost only)
├── cli/        # React Ink CLI (primary interface)
```

### Key Patterns (DO NOT REMOVE)
1. **Result<T, E>** - Use for errors, not exceptions
2. **Provider Abstraction** - AI providers are swappable
3. **CORS Localhost Only** - Security requirement (CVE-2024-28224)
4. **XML Escaping** - Escape user content in prompts (CVE-2025-53773)
5. **Zod responseSchema** - For AI JSON output
6. **No Manual Memoization** - React 19 Compiler handles it

### Architecture Rules
- Import flow: apps → packages, packages/core → schemas
- ALL files use kebab-case naming
- CLI: screens/, features/, components/, hooks/
- Tests co-located with source files

---

## What We're Building

### UI Screens
1. **Trust Wizard** (Step 0) - Directory trust confirmation
2. **Onboarding Wizard** (Steps 1-5) - Theme, Provider, Credentials, Controls, Summary
3. **Settings Screen** - Reuses wizard components in edit mode
4. **Home Menu** - Main navigation hub
5. **Review Screen** - Split-pane with issue list + details
6. **History Screen** - Reviews & Sessions tabs

### Data Models
- `TrustConfig` - Directory trust settings
- `SettingsConfig` - Theme, controls preferences
- `ReviewRun` - Full review snapshot with issues
- `Issue` - Enhanced with evidence, trace, fixPlan
- `Session` & `SessionEvent` - JSONL event tracking

### Key Features
- Split-pane layout in Ink (left: list, right: details)
- Focus routing (list vs details)
- Theme system (Auto/Dark/Light/Terminal)
- Menu mode vs Key mode navigation
- FIGlet banner with stargazer branding

---

## Execution Instructions

Run phases sequentially. Within each phase, agents can run in parallel where noted.

---

## PHASE 1: Data Models & Schemas (PARALLEL)

### Agent 1.1: Settings & Trust Schemas
```
subagent_type: "backend-development:backend-architect"

Task: Create settings and trust schemas in packages/schemas/src/

Files to create:
1. packages/schemas/src/settings.ts

Schemas to implement:

// Trust configuration
TrustCapabilities = { readFiles: boolean, readGit: boolean, runCommands: boolean }
TrustMode = "persistent" | "session"
TrustConfig = {
  projectId: string
  repoRoot: string
  trustedAt: string (ISO 8601)
  capabilities: TrustCapabilities
  trustMode: TrustMode
}

// Theme settings
Theme = "auto" | "dark" | "light" | "terminal"

// Controls mode
ControlsMode = "menu" | "keys"

// Full settings
SettingsConfig = {
  theme: Theme
  controlsMode: ControlsMode
  defaultLenses: string[]
  defaultProfile: string
  severityThreshold: Severity
}

2. Update packages/schemas/src/index.ts to export new types

Steps:
1. Read existing schemas in packages/schemas/src/
2. Create settings.ts with Zod schemas
3. Export from index.ts
4. Run: npm run type-check

Output: Settings schemas created
```

### Agent 1.2: Enhanced Issue Schema
```
subagent_type: "backend-development:backend-architect"

Task: Enhance Issue schema with evidence, trace, and fix plan fields.

Location: packages/schemas/src/triage.ts (or create issue.ts)

Add/update types:

EvidenceRef = {
  type: "diffHunk" | "fileSnippet" | "repoSearch" | "commandOutput"
  title: string
  sourceId: string
  file?: string
  range?: { startLine: number, endLine: number }
  excerpt: string
  sha?: string
}

TraceRef = {
  step: number
  tool: string
  inputSummary: string
  outputSummary: string
  timestamp: string
  artifacts?: string[]
}

FixPlanStep = {
  step: number
  action: string
  files?: string[]
  risk?: "low" | "med" | "high"
}

// Enhance TriageIssue with:
- symptom: string (required)
- whyItMatters: string (required)
- fixPlan?: FixPlanStep[]
- betterOptions?: string[]
- testsToAdd?: string[]
- evidence: EvidenceRef[]
- trace?: TraceRef[]

Steps:
1. Read packages/schemas/src/triage.ts
2. Add new types
3. Ensure backward compatibility
4. Run: npm run type-check

Output: Enhanced issue schema
```

### Agent 1.3: Session Event Schema
```
subagent_type: "backend-development:backend-architect"

Task: Create session event types for JSONL tracking.

Location: packages/schemas/src/session.ts (extend existing)

Add types:

SessionEventType =
  | "NAVIGATE"
  | "OPEN_ISSUE"
  | "TOGGLE_VIEW"
  | "APPLY_PATCH"
  | "IGNORE_ISSUE"
  | "FILTER_CHANGED"
  | "RUN_CREATED"
  | "RUN_RESUMED"
  | "SETTINGS_CHANGED"

SessionEvent = {
  ts: string (ISO 8601)
  type: SessionEventType
  payload: Record<string, unknown>
}

// Navigation payload examples
NavigatePayload = { from: string, to: string }
OpenIssuePayload = { reviewId: string, issueId: string }
ToggleViewPayload = { tab: "details" | "explain" | "trace" | "patch" }
FilterChangedPayload = { severity?: string, lens?: string, status?: string }

Steps:
1. Read packages/schemas/src/session.ts
2. Add event types
3. Export from index.ts
4. Run: npm run type-check

Output: Session event schema
```

Wait for all Phase 1 agents to complete.

---

## PHASE 2: Storage & API Layer (SEQUENTIAL)

### Agent 2.1: Settings Storage
```
subagent_type: "backend-development:backend-architect"

Task: Implement settings and trust storage.

Create files:
1. packages/core/src/storage/settings-storage.ts
   - saveTrust(config: TrustConfig): Result<void, Error>
   - loadTrust(projectId: string): Result<TrustConfig | null, Error>
   - listTrustedProjects(): Result<TrustConfig[], Error>
   - removeTrust(projectId: string): Result<void, Error>
   - saveSettings(settings: SettingsConfig): Result<void, Error>
   - loadSettings(): Result<SettingsConfig, Error>

2. packages/core/src/storage/index.ts - export new functions

Storage locations:
- Trust: ~/.config/stargazer/trusted.json
- Settings: ~/.config/stargazer/config.json

Use existing patterns from packages/core/src/storage/
Return Result<T, E> for all operations.

Steps:
1. Read existing storage code in packages/core/src/storage/
2. Create settings-storage.ts
3. Follow existing patterns (Result type, file operations)
4. Export from index.ts
5. Run: npm run type-check

Output: Settings storage implemented
```

### Agent 2.2: Settings API Routes
```
subagent_type: "backend-development:backend-architect"

Task: Create API routes for settings and trust.

Create/update:
1. apps/server/src/api/routes/settings.ts

Routes:
- GET /settings - Load current settings
- POST /settings - Save settings
- GET /trust - Check trust status for current directory
- POST /trust - Save trust config
- DELETE /trust - Remove trust for current project

2. Update apps/server/src/app.ts to mount routes

Use existing patterns from apps/server/src/api/routes/
Return proper HTTP status codes, use Result type.

Steps:
1. Read existing routes in apps/server/src/api/routes/
2. Create settings.ts
3. Mount in app.ts
4. Run: npm run type-check

Output: Settings API routes created
```

Wait for Phase 2 to complete.

---

## PHASE 3: UI Components (PARALLEL)

### Agent 3.1: Shared UI Components
```
subagent_type: "react-component-architect"

Task: Create shared UI components for wizard/settings.

Create in apps/cli/src/components/ui/:

1. split-pane.tsx
   - Props: { leftWidth: string | number, children: [ReactNode, ReactNode] }
   - Horizontal flex layout
   - Responsive: stack vertically if columns < 90

2. select-list.tsx
   - Wrapper around ink-select-input
   - Props: { items, selectedIndex, onSelect, renderItem? }

3. toggle-list.tsx
   - Multi-select checkbox list
   - Props: { items, selected: Set<string>, onToggle }

4. card.tsx
   - Box with border and optional title
   - Props: { title?, borderStyle?, children }

5. badge.tsx
   - Inline status/severity badge
   - Props: { type: "severity" | "status", value: string }

6. header-brand.tsx
   - FIGlet banner "STARGAZER"
   - Uses figlet package with "Small" or "Standard" font
   - Adds star ornaments: ✦ ✧ * .
   - Responsive sizing based on columns

7. footer-bar.tsx
   - Keyboard shortcuts display
   - Props: { shortcuts: { key: string, label: string }[], status?: string }

Follow React 19 patterns. No manual memoization unless needed.
Export from apps/cli/src/components/ui/index.ts

Steps:
1. Read existing components in apps/cli/src/components/
2. Create each component
3. Export from index.ts
4. Run: npm run type-check

Output: Shared UI components created
```

### Agent 3.2: Wizard Step Components
```
subagent_type: "react-component-architect"

Task: Create wizard step components for onboarding/settings.

Create in apps/cli/src/components/wizard/:

1. wizard-frame.tsx
   - Props: { step: number, totalSteps: number, title: string, children }
   - Shows "Setup • Step X/Y Title"
   - Wraps content in consistent layout

2. trust-step.tsx
   - Shows repo path
   - Explains capabilities (read files, read git, run commands)
   - ToggleList for capabilities
   - Actions: Trust & continue / Trust once / No

3. theme-step.tsx
   - SelectList: Auto (recommended), Dark, Light, Terminal default
   - Mini preview of color scheme

4. provider-step.tsx
   - SelectList: Gemini, OpenAI, Anthropic, Custom
   - Badge showing configured/needs-key status
   - Tab to switch model preset (Fast/Balanced/Best)

5. credentials-step.tsx
   - SelectList: Paste now, Read from env, Read from stdin, Skip
   - Masked text input when "Paste now" selected
   - Confirmation after save

6. controls-step.tsx
   - SelectList: Menu mode, Key mode
   - Cheatsheet preview for selected mode

7. summary-step.tsx
   - Displays all choices
   - Finish button
   - Optional "Test connection" button

Export from apps/cli/src/components/wizard/index.ts

Each step component should support mode="onboarding" | "settings"
- onboarding: Next/Back navigation
- settings: Save/Cancel actions

Steps:
1. Create wizard directory
2. Implement each component
3. Use shared UI components from Phase 3.1
4. Export from index.ts
5. Run: npm run type-check

Output: Wizard step components created
```

### Agent 3.3: Review UI Components
```
subagent_type: "react-component-architect"

Task: Create split-pane review UI components.

Create in apps/cli/src/features/review/components/:

1. review-split-screen.tsx
   - Main review screen with split-pane
   - Left: IssueListPane, Right: IssueDetailsPane
   - Focus routing: "list" | "details"

2. issue-list-pane.tsx
   - IssueListHeader (filters, search, counts)
   - IssueList (virtual scrolling)
   - Uses use-list-navigation hook

3. issue-list-header.tsx
   - Filter dropdowns: severity, lens, status
   - Search input
   - Issue count display

4. issue-details-pane.tsx
   - IssueHeader (title, badges, location)
   - IssueTabs (Details/Explain/Trace/Patch)
   - IssueBody (scrollable content)

5. issue-tabs.tsx
   - Tab bar with keyboard navigation
   - Props: { activeTab, onTabChange }

6. issue-body-details.tsx
   - Symptom, WhyItMatters, FixPlan, Recommendation, Alternatives, Tests

7. issue-body-explain.tsx
   - Evidence list with sources
   - Rule/lens that triggered finding

8. issue-body-trace.tsx
   - Timeline of tool calls
   - Expandable input/output summaries

9. issue-body-patch.tsx
   - Unified diff preview
   - "Applies cleanly" indicator
   - Apply button

Update apps/cli/src/features/review/components/index.ts

Steps:
1. Read existing review components
2. Create new components
3. Use SplitPane from shared UI
4. Export from index.ts
5. Run: npm run type-check

Output: Review UI components created
```

Wait for all Phase 3 agents to complete.

---

## PHASE 4: Screens & Navigation (SEQUENTIAL)

### Agent 4.1: Onboarding Screen Update
```
subagent_type: "react-component-architect"

Task: Update onboarding screen to use wizard steps.

Modify: apps/cli/src/app/screens/onboarding-screen.tsx

Changes:
1. Add Trust step (Step 0) before existing steps
2. Use wizard step components from Phase 3.2
3. Store trust config on completion
4. Update navigation flow:
   - Check trust status first
   - If not trusted, show TrustStep
   - Then proceed to Theme → Provider → Credentials → Controls → Summary

Add hook: apps/cli/src/hooks/use-trust.ts
- loadTrustStatus()
- saveTrust()
- checkCurrentDirectory()

Steps:
1. Read existing onboarding-screen.tsx
2. Create use-trust.ts hook
3. Update onboarding to use wizard components
4. Test flow
5. Run: npm run type-check

Output: Onboarding screen updated
```

### Agent 4.2: Settings Screen Update
```
subagent_type: "react-component-architect"

Task: Update settings screen to show all sections.

Modify: apps/cli/src/app/screens/settings-screen.tsx

Changes:
1. Show section list:
   - Trust & Permissions
   - Theme
   - Provider & Model
   - Credentials
   - Controls
   - About / Diagnostics

2. Each section opens wizard step component in mode="settings"

3. Add actions:
   - Save (calls settings API)
   - Cancel (returns to list)
   - Reset to defaults (optional)

4. Credentials section: Add "Replace key" / "Remove key" options

Add hook: apps/cli/src/hooks/use-settings.ts
- loadSettings()
- saveSettings()
- loadProviderStatus()

Steps:
1. Read existing settings-screen.tsx
2. Create use-settings.ts hook
3. Update screen to show sections
4. Integrate wizard components
5. Run: npm run type-check

Output: Settings screen updated
```

### Agent 4.3: Review Screen Integration
```
subagent_type: "react-component-architect"

Task: Integrate split-pane review into main app.

Modify: apps/cli/src/app/views/review-view.tsx

Changes:
1. Replace simple ReviewDisplay with ReviewSplitScreen
2. Add state management for:
   - selectedIssueId
   - viewTab (details/explain/trace/patch)
   - focus (list/details)
   - filters
   - scrollOffsets

3. Add keyboard handler hook:
   apps/cli/src/features/review/hooks/use-review-keyboard.ts
   - Handles j/k, n/p, o, a, i, e, t, Tab, Esc
   - Routes based on current focus

4. Connect to existing use-triage hook for data

Steps:
1. Read existing review-view.tsx
2. Create use-review-keyboard.ts
3. Update view to use split-screen
4. Wire up keyboard navigation
5. Test all key bindings
6. Run: npm run type-check

Output: Review screen integrated
```

### Agent 4.4: History Screen Update
```
subagent_type: "react-component-architect"

Task: Update history screen with tabs and actions.

Modify: apps/cli/src/app/screens/review-history-screen.tsx
Create: apps/cli/src/app/screens/history-screen.tsx (unified)

Changes:
1. Create unified HistoryScreen with tabs:
   - Reviews tab (existing functionality)
   - Sessions tab (from sessions-screen.tsx)

2. Add TabBar component for switching

3. Add actions per item:
   - Reviews: Resume, Export (markdown), Delete
   - Sessions: View timeline, Delete

4. Add ReviewRunDetails view:
   - Summary, stats, issue list
   - Resume button to go to ReviewScreen

5. Add SessionDetails view:
   - Event timeline display

Add hook: apps/cli/src/hooks/use-session-events.ts
- loadSessionEvents(sessionId)
- Returns parsed JSONL events

Steps:
1. Read existing history screens
2. Create unified history-screen.tsx
3. Add tab navigation
4. Implement detail views
5. Create use-session-events hook
6. Run: npm run type-check

Output: History screen updated
```

Wait for Phase 4 to complete.

---

## PHASE 5: Agentic Review Pipeline (SEQUENTIAL)

### Agent 5.1: Enhanced Triage with Evidence
```
subagent_type: "llm-application-dev:ai-engineer"

Task: Update triage to generate evidence and fix plans.

Modify: packages/core/src/review/triage.ts

Changes:
1. Update triage prompt to require:
   - symptom (what is observed)
   - whyItMatters (risk/impact)
   - fixPlan (numbered steps)
   - evidence (diff hunks referenced)

2. Update Zod schema for AI output to match enhanced Issue type

3. Add evidence extraction:
   - Parse diff to identify specific hunks
   - Create EvidenceRef objects linking to hunks

4. Ensure all required fields are present before returning issue

Steps:
1. Read existing triage.ts
2. Update system prompt
3. Update Zod response schema
4. Add evidence extraction logic
5. Test with sample diff
6. Run: npm run type-check && npx vitest run

Output: Triage enhanced with evidence
```

### Agent 5.2: Drilldown with Trace
```
subagent_type: "llm-application-dev:ai-engineer"

Task: Update drilldown to record trace of tool calls.

Modify: packages/core/src/review/drilldown.ts

Changes:
1. Create trace recording:
   - Wrap each tool call to record input/output
   - Generate TraceRef objects

2. Update drilldown output to include:
   - Updated evidence (from file reads)
   - trace array
   - Refined fixPlan
   - Concrete patch

3. Tool wrappers:
   - wrapReadFileRange(fn) - records file reads
   - wrapRepoSearch(fn) - records searches
   - wrapGetTypeDefs(fn) - records type lookups

Steps:
1. Read existing drilldown.ts
2. Create tool wrappers with trace recording
3. Update drilldown function to use wrappers
4. Include trace in output
5. Test drilldown flow
6. Run: npm run type-check && npx vitest run

Output: Drilldown with trace recording
```

### Agent 5.3: Session Event Recording
```
subagent_type: "backend-development:backend-architect"

Task: Implement JSONL session event recording.

Create: packages/core/src/storage/session-events.ts

Functions:
- appendEvent(sessionId: string, event: SessionEvent): Result<void, Error>
- loadEvents(sessionId: string): Result<SessionEvent[], Error>
- createSession(projectId: string): Result<Session, Error>

Storage: ~/.local/share/stargazer/projects/<projectId>/sessions/<sessionId>.jsonl

Each event is one JSON line appended to file.

Create: apps/cli/src/hooks/use-session-recorder.ts
- Hook that provides recordEvent() function
- Auto-records navigation, issue opens, applies, etc.

Steps:
1. Create session-events.ts in core
2. Implement JSONL append/read
3. Create use-session-recorder hook
4. Integrate into app navigation
5. Run: npm run type-check

Output: Session event recording implemented
```

Wait for Phase 5 to complete.

---

## PHASE 6: Theme System (PARALLEL)

### Agent 6.1: Theme Provider
```
subagent_type: "react-component-architect"

Task: Create theme system for CLI.

Create: apps/cli/src/lib/theme.ts

Exports:
- ThemeTokens interface
- createTheme(name: Theme): ThemeTokens
- themes: Record<Theme, ThemeTokens>

Token structure:
- text: { normal, muted, accent }
- status: { warning, error, success }
- selection: ChalkStyle
- border: ChalkStyle
- severity: Record<Severity, ChalkStyle>

Auto theme uses:
- No background colors
- Bold, underline, reverse for emphasis
- Works on any terminal background

Create: apps/cli/src/hooks/use-theme.ts
- Loads theme from settings
- Returns current ThemeTokens

Steps:
1. Create theme.ts with token definitions
2. Implement 4 theme variants
3. Create use-theme hook
4. Run: npm run type-check

Output: Theme system created
```

### Agent 6.2: Apply Theme to Components
```
subagent_type: "react-component-architect"

Task: Apply theme tokens to all UI components.

Update components to use theme:
1. apps/cli/src/components/ui/badge.tsx - severity colors
2. apps/cli/src/components/ui/card.tsx - border colors
3. apps/cli/src/components/ui/header-brand.tsx - accent colors
4. apps/cli/src/components/ui/footer-bar.tsx - muted text
5. apps/cli/src/features/review/components/ - all components

Pattern:
const theme = useTheme()
<Text color={theme.text.muted}>...</Text>

Steps:
1. Identify all components with hardcoded colors
2. Replace with theme token usage
3. Test with each theme variant
4. Run: npm run type-check

Output: Theme applied to all components
```

Wait for Phase 6 to complete.

---

## PHASE 7: Final Validation (SEQUENTIAL)

### Agent 7.1: Type Check & Tests
```
subagent_type: "code-reviewer"

Task: Validate all changes.

Steps:
1. Run: npm run type-check
2. Run: npx vitest run
3. Fix any failing tests
4. Add missing tests for:
   - Settings storage
   - Session event recording
   - Theme system

Output: All tests passing
```

### Agent 7.2: Integration Test
```
subagent_type: "code-reviewer"

Task: Manual integration test of full flow.

Test scenarios:
1. Fresh start: Trust → Onboarding → Home Menu
2. Settings: Open each section, make changes, save
3. Review: Run triage, navigate issues, view details tabs
4. History: View past reviews, resume one
5. Theme: Switch themes, verify colors

Report any issues found.

Output: Integration test report
```

---

## Summary

After all phases complete, the system should have:

1. ✅ Settings & Trust schemas
2. ✅ Enhanced Issue schema with evidence/trace
3. ✅ Session event schema
4. ✅ Settings storage layer
5. ✅ Settings API routes
6. ✅ Shared UI components (SplitPane, SelectList, etc.)
7. ✅ Wizard step components
8. ✅ Review UI components (split-pane)
9. ✅ Updated Onboarding screen
10. ✅ Updated Settings screen
11. ✅ Integrated Review screen
12. ✅ Updated History screen
13. ✅ Enhanced Triage with evidence
14. ✅ Drilldown with trace recording
15. ✅ Session event recording
16. ✅ Theme system
17. ✅ All tests passing
