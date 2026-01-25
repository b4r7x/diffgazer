# Agentic Workflow - Stargazer

## Overview

This workflow transforms Stargazer from a "hidden AI" tool into a **visible agentic system** where users see:

- **Agent activity** - Which agent is running, what it's doing
- **Tool calls** - Real-time visibility into file reads, searches, analysis
- **Multi-agent coordination** - Parallel lens agents working together
- **Feedback loop** - User can refine, focus, ask questions

## Why This Matters (Hackathon)

The key insight from Claude Code and OpenCode: **"Agents are workflows with feedback loops."**

Most AI tools hide the AI's work. Stargazer will show it, making the "agentic" nature visible and controllable.

## What Gets Built

| Phase | What | Why |
|-------|------|-----|
| 1 | Agent Event Schema | Data structure for agent visibility |
| 2 | Agent Stream Events | SSE events for tool_call, thinking, issue_found |
| 3 | Agent Activity Panel | UI showing live agent activity |
| 4 | Parallel Agent Orchestration | Lenses as named agents running in parallel |
| 5 | User Feedback Loop | Focus, refine, ask commands |
| 6 | Proactive Drilldown | Agent-initiated deep analysis |
| 7 | Code Simplifier | Final cleanup pass |

## Visual Result

```
┌─────────────────────────────────────────────────────────────┐
│ ✦ STARGAZER                                    [REVIEWING] │
├──────────────────────┬──────────────────────────────────────┤
│ Agent Activity       │ Issues Found                         │
├──────────────────────┤                                      │
│ ⟳ Guardian (security)│ [1] SQL Injection Risk  [HIGH]       │
│   └─ Reading auth.ts │ [2] Missing Validation  [MED]        │
│   └─ Found 1 issue   │                                      │
│                      │ Currently Analyzing:                 │
│ ✓ Detective Done (3) │ > Checking auth/login.ts:42-55       │
│ ⟳ Optimizer Next     │ > Looking for injection patterns...  │
├──────────────────────┴──────────────────────────────────────┤
│ j/k move  e explain  f focus  r refine  /ask  ? help        │
└─────────────────────────────────────────────────────────────┘
```

## How to Use

### Option A: Full Workflow (Recommended)

1. Load `master-orchestrator.md` into empty Claude Code session
2. Execute phases sequentially
3. Run code-simplifier at the end

### Option B: Individual Phases

Each phase file is self-contained and can be run independently.

## Workflow Files

| File | Description | Priority |
|------|-------------|----------|
| `master-orchestrator.md` | **Main entry point** | - |
| `01-agent-event-schema.md` | Schema for agent events | CRITICAL |
| `02-agent-stream-events.md` | SSE streaming for visibility | CRITICAL |
| `03-agent-activity-panel.md` | UI component | CRITICAL |
| `04-parallel-agent-orchestration.md` | Multi-agent execution | HIGH |
| `05-user-feedback-loop.md` | Refinement commands | HIGH |
| `06-proactive-drilldown.md` | Agent-initiated analysis | MEDIUM |
| `07-code-simplifier.md` | Final cleanup | REQUIRED |

## Execution Order

```
Phase 1: Schema (foundation)
    └─ AgentEvent types in packages/schemas

Phase 2: Stream Events (server)
    └─ Emit tool_call, thinking, issue_found events

Phase 3: Activity Panel (UI) - can run parallel with Phase 2
    └─ AgentActivityPanel component in apps/cli

Phase 4: Parallel Orchestration (core)
    └─ Run lenses as named agents in parallel

Phase 5: Feedback Loop (UI + server)
    └─ Focus, refine, ask commands

Phase 6: Proactive Drilldown (core + UI)
    └─ Agent-initiated deep analysis prompts

Phase 7: Code Simplifier (validation)
    └─ Remove over-engineering, ensure KISS/YAGNI
```

## Agents Used

| Agent | Purpose |
|-------|---------|
| `backend-development:backend-architect` | Schema, core logic, server |
| `react-component-architect` | UI components, hooks |
| `llm-application-dev:ai-engineer` | AI pipeline, streaming |
| `code-simplifier:code-simplifier` | Final cleanup |
| `code-reviewer` | Validation between phases |

## Principles

| Principle | Application |
|-----------|-------------|
| KISS | Simple components, no abstractions until needed |
| YAGNI | Build only what's specified, not "might need" |
| DRY | Reuse existing utilities from @repo/core |
| SRP | Each component does one thing |
| Result<T,E> | All errors return Result, no exceptions |

## Dependencies

This workflow assumes `review-pipeline-enhancements` work is complete:
- Session events storage
- Key mode navigation
- Split-pane UI foundation
- Trace recording

If not complete, run those phases first.

## Validation

After each phase:
```bash
npm run type-check
npx vitest run
```

After Phase 7 (code-simplifier):
- Manual review for over-engineering
- Check all tests pass
- Verify UI renders correctly
