# UI Implementation Workflows

## Overview

This directory contains workflows for implementing the complete UI system for Stargazer CLI based on the GPT conversation specifications.

## How to Use

1. **Start with the Master Orchestrator**
   - Load `master-ui-orchestrator.md` into an empty Claude Code session
   - Execute phases sequentially
   - Use specified agents for each task

2. **Or Run Individual Workflows**
   - Each workflow is self-contained
   - Can be run independently for specific features

## Workflow Files

| File | Description | Phase |
|------|-------------|-------|
| `master-ui-orchestrator.md` | **Main entry point** - Full orchestration | All |
| `01-schemas-data-models.md` | Settings, Trust, Issue, Session schemas | 1 |
| `02-storage-api-layer.md` | Storage functions and API routes | 2 |
| `03-ui-components.md` | Shared UI and wizard components | 3 |
| `04-screens-navigation.md` | Screen updates and navigation | 4 |
| `05-agentic-pipeline.md` | Evidence, trace, fingerprinting | 5 |
| `06-theme-system.md` | Theme provider and tokens | 6 |

## Execution Order

```
Phase 1: Schemas (Parallel)
├── 01-schemas-data-models.md
│
Phase 2: Storage/API (Sequential)
├── 02-storage-api-layer.md
│
Phase 3: UI Components (Parallel)
├── 03-ui-components.md
│
Phase 4: Screens (Sequential)
├── 04-screens-navigation.md
│
Phase 5: Agentic Pipeline (Sequential)
├── 05-agentic-pipeline.md
│
Phase 6: Theme (Parallel with 4/5)
└── 06-theme-system.md
```

## Agents Used

| Agent | Purpose |
|-------|---------|
| `backend-development:backend-architect` | Schemas, storage, API routes |
| `react-component-architect` | UI components, screens, hooks |
| `llm-application-dev:ai-engineer` | AI pipeline enhancements |
| `code-reviewer` | Validation |

## What Gets Built

### Data Layer
- `packages/schemas/src/settings.ts` - Trust, Theme, Controls schemas
- `packages/schemas/src/triage.ts` - Enhanced Issue with evidence/trace
- `packages/schemas/src/session.ts` - Session event schemas
- `packages/core/src/storage/settings-storage.ts` - Settings persistence
- `packages/core/src/storage/session-events.ts` - JSONL event storage
- `apps/server/src/api/routes/settings.ts` - Settings API

### UI Components
- `apps/cli/src/components/ui/` - SplitPane, SelectList, Card, Badge, etc.
- `apps/cli/src/components/wizard/` - Trust, Theme, Provider, Credentials steps
- `apps/cli/src/features/review/components/` - Split-pane review UI

### Screens
- Updated onboarding with Trust step
- Multi-section Settings screen
- Split-pane Review screen
- Unified History screen with tabs

### Pipeline
- Evidence extraction in triage
- Trace recording in drilldown
- Fingerprinting for deduplication
- Session event recording

### Theme System
- Theme tokens (Auto/Dark/Light/Terminal)
- ThemeProvider context
- Themed components

## Related Workflows

- `../documentation-workflow.md` - Generate /docs/ after implementation
- `../master-orchestrator.md` - Original project setup workflow
