# Run UI Implementation Orchestrator

## Instructions

Paste this entire prompt into an **empty Claude Code session**. It will orchestrate multiple specialized agents to implement the complete UI system for Stargazer.

---

## Project Context

**Stargazer** is a local-only CLI tool for AI-powered code review.

### Tech Stack
- TypeScript, React 19 (Ink for CLI), Chalk
- Hono (server), Zod (schemas), Vitest (tests)
- Vercel AI SDK for AI providers

### Monorepo Structure
```
packages/
├── core/       # Business logic, Result type, utilities
├── schemas/    # Zod schemas (canonical types) - LEAF
├── api/        # API client - LEAF
apps/
├── server/     # Hono backend (localhost only)
├── cli/        # React Ink CLI
```

### Key Patterns (DO NOT CHANGE)
1. `Result<T, E>` for errors, not exceptions
2. All files use kebab-case naming
3. CORS localhost only (security)
4. XML escaping in AI prompts (security)
5. No manual memoization (React 19 Compiler)

---

## Execution Plan

Execute the following phases. Use the `Task` tool with the specified `subagent_type` for each agent. Run parallel agents in a single message with multiple Task calls.

---

## PHASE 1: Schemas (Run 3 agents in PARALLEL)

### Agent 1.1: Settings & Trust Schemas
```
Use Task tool with:
- subagent_type: "backend-development:backend-architect"
- description: "Create settings and trust schemas"
- prompt: |
    Create settings and trust schemas in packages/schemas/src/settings.ts

    Schemas to implement:
    - TrustCapabilities: { readFiles, readGit, runCommands: boolean }
    - TrustMode: "persistent" | "session"
    - TrustConfig: { projectId, repoRoot, trustedAt, capabilities, trustMode }
    - Theme: "auto" | "dark" | "light" | "terminal"
    - ControlsMode: "menu" | "keys"
    - SettingsConfig: { theme, controlsMode, defaultLenses, defaultProfile, severityThreshold }

    Use Zod. Export from packages/schemas/src/index.ts.
    Run: npm run type-check
```

### Agent 1.2: Enhanced Issue Schema
```
Use Task tool with:
- subagent_type: "backend-development:backend-architect"
- description: "Enhance issue schema with evidence/trace"
- prompt: |
    Update packages/schemas/src/triage.ts with enhanced issue fields.

    Add types:
    - EvidenceRef: { type, title, sourceId, file?, range?, excerpt, sha? }
    - TraceRef: { step, tool, inputSummary, outputSummary, timestamp, artifacts? }
    - FixPlanStep: { step, action, files?, risk? }

    Add to TriageIssue:
    - symptom: string (required)
    - whyItMatters: string (required)
    - fixPlan?: FixPlanStep[]
    - betterOptions?: string[]
    - testsToAdd?: string[]
    - evidence: EvidenceRef[]
    - trace?: TraceRef[]

    Run: npm run type-check
```

### Agent 1.3: Session Event Schema
```
Use Task tool with:
- subagent_type: "backend-development:backend-architect"
- description: "Create session event schemas"
- prompt: |
    Update packages/schemas/src/session.ts with event types.

    Add:
    - SessionEventType: enum of NAVIGATE, OPEN_ISSUE, TOGGLE_VIEW, APPLY_PATCH, IGNORE_ISSUE, FILTER_CHANGED, RUN_CREATED, RUN_RESUMED, SETTINGS_CHANGED
    - SessionEvent: { ts, type, payload }

    Export from index.ts.
    Run: npm run type-check
```

**WAIT for all Phase 1 agents to complete before Phase 2.**

---

## PHASE 2: Storage & API (Run SEQUENTIALLY)

### Agent 2.1: Settings Storage
```
Use Task tool with:
- subagent_type: "backend-development:backend-architect"
- description: "Implement settings storage"
- prompt: |
    Create packages/core/src/storage/settings-storage.ts

    Functions (all return Result<T, E>):
    - saveTrust(config: TrustConfig)
    - loadTrust(projectId: string)
    - listTrustedProjects()
    - removeTrust(projectId: string)
    - saveSettings(settings: SettingsConfig)
    - loadSettings()

    Storage locations:
    - Trust: ~/.config/stargazer/trusted.json
    - Settings: ~/.config/stargazer/config.json

    Export from packages/core/src/storage/index.ts
    Run: npm run type-check
```

### Agent 2.2: Session Events Storage
```
Use Task tool with:
- subagent_type: "backend-development:backend-architect"
- description: "Implement session event storage"
- prompt: |
    Create packages/core/src/storage/session-events.ts

    Functions (all return Result<T, E>):
    - createSession(projectId: string)
    - appendEvent(projectId, sessionId, event) - JSONL append
    - loadEvents(projectId, sessionId)
    - listSessions(projectId)

    Storage: ~/.local/share/stargazer/projects/<projectId>/sessions/<sessionId>.jsonl

    Run: npm run type-check
```

### Agent 2.3: Settings API Routes
```
Use Task tool with:
- subagent_type: "backend-development:backend-architect"
- description: "Create settings API routes"
- prompt: |
    Create apps/server/src/api/routes/settings.ts

    Routes:
    - GET /settings - Load settings
    - POST /settings - Save settings
    - GET /trust?projectId= - Check trust
    - GET /trust/list - List trusted projects
    - POST /trust - Save trust
    - DELETE /trust?projectId= - Remove trust

    Mount in apps/server/src/app.ts
    Run: npm run type-check
```

**WAIT for Phase 2 to complete before Phase 3.**

---

## PHASE 3: UI Components (Run 3 agents in PARALLEL)

### Agent 3.1: Shared UI Components
```
Use Task tool with:
- subagent_type: "react-component-architect"
- description: "Create shared UI components"
- prompt: |
    Create components in apps/cli/src/components/ui/:

    1. split-pane.tsx - Horizontal split, responsive (stack if <90 cols)
    2. select-list.tsx - Wrapper for ink-select-input with badge support
    3. toggle-list.tsx - Multi-select checkbox list
    4. card.tsx - Box with border and optional title
    5. badge.tsx - Severity/status inline badge
    6. header-brand.tsx - FIGlet "STARGAZER" banner with stars
    7. footer-bar.tsx - Keyboard shortcuts display

    Export from apps/cli/src/components/ui/index.ts
    Run: npm run type-check
```

### Agent 3.2: Wizard Step Components
```
Use Task tool with:
- subagent_type: "react-component-architect"
- description: "Create wizard step components"
- prompt: |
    Create components in apps/cli/src/components/wizard/:

    1. wizard-frame.tsx - "Setup • Step X/Y" layout
    2. trust-step.tsx - Directory trust with capability toggles
    3. theme-step.tsx - Theme selection with preview
    4. provider-step.tsx - Provider list with configured badges
    5. credentials-step.tsx - API key input methods
    6. controls-step.tsx - Menu vs Key mode selection
    7. summary-step.tsx - Final summary with test button

    Each supports mode="onboarding" | "settings"
    Export from apps/cli/src/components/wizard/index.ts
    Run: npm run type-check
```

### Agent 3.3: Review UI Components
```
Use Task tool with:
- subagent_type: "react-component-architect"
- description: "Create review split-pane components"
- prompt: |
    Create/update in apps/cli/src/features/review/components/:

    1. review-split-screen.tsx - Main split-pane layout
    2. issue-list-pane.tsx - Left panel with filters
    3. issue-list-header.tsx - Filter dropdowns and search
    4. issue-details-pane.tsx - Right panel with tabs
    5. issue-tabs.tsx - Details/Explain/Trace/Patch tabs
    6. issue-body-details.tsx - Symptom, WhyItMatters, FixPlan
    7. issue-body-explain.tsx - Evidence list
    8. issue-body-trace.tsx - Tool call timeline
    9. issue-body-patch.tsx - Diff preview with apply button

    Update index.ts exports.
    Run: npm run type-check
```

**WAIT for Phase 3 to complete before Phase 4.**

---

## PHASE 4: Screens & Navigation (Run SEQUENTIALLY)

### Agent 4.1: Onboarding Screen Update
```
Use Task tool with:
- subagent_type: "react-component-architect"
- description: "Update onboarding with trust step"
- prompt: |
    Update apps/cli/src/app/screens/onboarding-screen.tsx:

    1. Add Trust step (Step 0) before existing steps
    2. Use wizard step components
    3. Create apps/cli/src/hooks/use-trust.ts hook
    4. Flow: Trust → Theme → Provider → Credentials → Controls → Summary

    Run: npm run type-check
```

### Agent 4.2: Settings Screen Update
```
Use Task tool with:
- subagent_type: "react-component-architect"
- description: "Update settings with sections"
- prompt: |
    Update apps/cli/src/app/screens/settings-screen.tsx:

    1. Show section list: Trust, Theme, Provider, Credentials, Controls, Diagnostics
    2. Each section opens wizard step in mode="settings"
    3. Create apps/cli/src/hooks/use-settings.ts hook

    Run: npm run type-check
```

### Agent 4.3: Review Screen Integration
```
Use Task tool with:
- subagent_type: "react-component-architect"
- description: "Integrate split-pane review"
- prompt: |
    Update apps/cli/src/app/views/review-view.tsx:

    1. Use ReviewSplitScreen instead of simple display
    2. Add state: selectedIssueId, viewTab, focus, filters, scrollOffsets
    3. Create apps/cli/src/features/review/hooks/use-review-keyboard.ts
    4. Keyboard: j/k navigate, o open, a apply, i ignore, e/t/p tabs

    Run: npm run type-check
```

### Agent 4.4: History Screen Update
```
Use Task tool with:
- subagent_type: "react-component-architect"
- description: "Create unified history screen"
- prompt: |
    Create apps/cli/src/app/screens/history-screen.tsx:

    1. Tabs: Reviews / Sessions
    2. Reviews: list with Resume, Export, Delete actions
    3. Sessions: list with View timeline, Delete
    4. Create apps/cli/src/hooks/use-session-events.ts hook

    Run: npm run type-check
```

**WAIT for Phase 4 to complete before Phase 5.**

---

## PHASE 5: Agentic Pipeline (Run SEQUENTIALLY)

### Agent 5.1: Enhanced Triage
```
Use Task tool with:
- subagent_type: "llm-application-dev:ai-engineer"
- description: "Enhance triage with evidence"
- prompt: |
    Update packages/core/src/review/triage.ts:

    1. Update system prompt to require: symptom, whyItMatters, fixPlan, evidence
    2. Update Zod response schema with new fields
    3. Add evidence extraction from diff hunks
    4. Validate issue completeness

    Run: npm run type-check && npx vitest run packages/core/src/review/
```

### Agent 5.2: Drilldown with Trace
```
Use Task tool with:
- subagent_type: "llm-application-dev:ai-engineer"
- description: "Add trace recording to drilldown"
- prompt: |
    Update packages/core/src/review/drilldown.ts:

    1. Create TraceRecorder with wrap() method
    2. Wrap all tool calls (readFileRange, repoSearch, etc.)
    3. Include trace array in DrilldownResult

    Run: npm run type-check && npx vitest run packages/core/src/review/
```

### Agent 5.3: Fingerprinting
```
Use Task tool with:
- subagent_type: "backend-development:backend-architect"
- description: "Implement issue fingerprinting"
- prompt: |
    Create packages/core/src/review/fingerprint.ts:

    1. generateFingerprint(issue, diffHunk?) - SHA256 of normalized fields
    2. mergeIssues(issues[]) - Dedupe by fingerprint, merge severity/confidence
    3. normalizeTitle() - lowercase, remove stop words
    4. getHunkDigest() - SHA1 of normalized diff

    Run: npm run type-check
```

**WAIT for Phase 5 to complete before Phase 6.**

---

## PHASE 6: Theme System (Run 2 agents in PARALLEL)

### Agent 6.1: Theme Provider
```
Use Task tool with:
- subagent_type: "react-component-architect"
- description: "Create theme system"
- prompt: |
    Create apps/cli/src/lib/theme.ts:
    - ThemeTokens interface (text, status, severity, ui, diff, modifiers)
    - 4 themes: auto, dark, light, terminal
    - getTheme(name), supportsColors(), supportsUnicode()

    Create apps/cli/src/hooks/use-theme.ts:
    - ThemeProvider component
    - useTheme() hook

    Run: npm run type-check
```

### Agent 6.2: Apply Theme
```
Use Task tool with:
- subagent_type: "react-component-architect"
- description: "Apply theme to components"
- prompt: |
    Update components to use theme:
    1. apps/cli/src/components/ui/badge.tsx - severity colors
    2. apps/cli/src/components/ui/card.tsx - border colors
    3. apps/cli/src/components/ui/footer-bar.tsx - text colors
    4. apps/cli/src/features/review/components/issue-item.tsx
    5. apps/cli/src/components/git-diff-display.tsx

    Add ThemeProvider to apps/cli/src/app/app.tsx

    Run: npm run type-check
```

**WAIT for Phase 6 to complete before Phase 7.**

---

## PHASE 7: Final Validation

### Agent 7.1: Type Check & Tests
```
Use Task tool with:
- subagent_type: "code-reviewer"
- description: "Validate all changes"
- prompt: |
    1. Run: npm run type-check
    2. Run: npx vitest run
    3. Fix any failing tests
    4. Verify no security issues
    5. Verify patterns followed (Result type, kebab-case, etc.)

    Report any critical issues.
```

---

## Summary

After all phases complete:

✅ Settings & Trust schemas
✅ Enhanced Issue with evidence/trace
✅ Session event tracking
✅ Settings storage + API
✅ Shared UI components
✅ Wizard step components
✅ Split-pane Review UI
✅ Updated Onboarding with Trust
✅ Multi-section Settings
✅ Unified History screen
✅ Enhanced Triage with evidence
✅ Drilldown with trace
✅ Issue fingerprinting
✅ Theme system
✅ All tests passing

---

## Begin Execution

Start with Phase 1 - launch all 3 agents in parallel using the Task tool.
