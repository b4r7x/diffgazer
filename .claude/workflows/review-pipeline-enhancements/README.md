# Review Pipeline Enhancements Workflow

## Overview

This workflow implements critical improvements to the Stargazer review pipeline based on gap analysis. It focuses on:

1. **Session Event Recording** - JSONL event tracking for history/replay
2. **Key Mode Navigation** - Vim-style keyboard shortcuts
3. **Split-Pane Integration** - Simultaneous list + details view
4. **Trace Recording** - Audit trail of AI tool calls
5. **GitHub Actions** - PR review bot integration

## How to Use

1. **Start with Master Orchestrator**
   - Load `master-orchestrator.md` into empty Claude Code session
   - Execute phases sequentially
   - Agents run in parallel where noted

2. **Or Run Individual Phases**
   - Each phase file is self-contained
   - Can be run independently

## Workflow Files

| File | Description | Priority |
|------|-------------|----------|
| `master-orchestrator.md` | **Main entry point** | - |
| `01-session-events.md` | Session event recording (JSONL) | CRITICAL |
| `02-key-mode.md` | Vim-style keyboard navigation | CRITICAL |
| `03-split-pane-integration.md` | Review UI split-pane upgrade | HIGH |
| `04-trace-recording.md` | AI tool call audit trail | HIGH |
| `05-github-actions.md` | PR review bot | MEDIUM |

## Execution Order

```
Phase 1: Session Events (CRITICAL)
├── 01-session-events.md
│   ├── Core storage: session-events.ts
│   ├── Hook: use-session-recorder.ts
│   └── Integration: app navigation

Phase 2: Key Mode (CRITICAL)
├── 02-key-mode.md
│   ├── Hook: use-keyboard-mode.ts
│   ├── Review keyboard: use-review-keyboard.ts
│   └── Settings integration

Phase 3: Split-Pane (HIGH) - can run parallel with Phase 2
├── 03-split-pane-integration.md
│   ├── Components: review-split-screen.tsx
│   ├── Focus routing
│   └── Scroll management

Phase 4: Trace Recording (HIGH)
├── 04-trace-recording.md
│   ├── TraceRecorder utility
│   ├── Drilldown integration
│   └── UI: trace-view.tsx

Phase 5: GitHub Actions (MEDIUM)
└── 05-github-actions.md
    ├── Workflow: ai-review.yml
    ├── Annotations format
    └── PR comments
```

## Agents Used

| Agent | Purpose |
|-------|---------|
| `backend-development:backend-architect` | Storage, core logic |
| `react-component-architect` | UI components, hooks |
| `llm-application-dev:ai-engineer` | AI pipeline |
| `code-reviewer` | Validation |

## What Gets Built

### Phase 1: Session Events
- `packages/core/src/storage/session-events.ts` - JSONL append/read
- `apps/cli/src/hooks/use-session-recorder.ts` - Recording hook
- Integration into app navigation

### Phase 2: Key Mode
- `apps/cli/src/hooks/use-keyboard-mode.ts` - Global mode switching
- `apps/cli/src/features/review/hooks/use-review-keyboard.ts` - Review-specific keys
- Settings: `controlsMode` integration

### Phase 3: Split-Pane
- `apps/cli/src/features/review/components/review-split-screen.tsx`
- Focus routing (list vs details)
- Virtual scrolling for issue list

### Phase 4: Trace Recording
- `packages/core/src/review/trace-recorder.ts` - Tool call wrapper
- Updated drilldown with trace output
- `apps/cli/src/features/review/components/issue-body-trace.tsx`

### Phase 5: GitHub Actions
- `.github/workflows/ai-review.yml`
- Server endpoint for PR diff review
- Annotation output format

## Dependencies

This workflow assumes `ui-implementation` workflow is complete (schemas exist).

If not, run these first:
- Phase 1 from ui-implementation (Settings/Trust schemas)
- Phase 3.3 from ui-implementation (Review components base)

## Validation

After each phase:
```bash
npm run type-check
npx vitest run
```
