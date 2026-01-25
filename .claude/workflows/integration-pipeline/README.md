# Integration Pipeline Workflow

## Purpose

This workflow **connects all existing pieces** of Stargazer into a fully working agentic code review system. Unlike other workflows that create new features, this one focuses on **wiring** and **integration**.

## Prerequisites

Before running this workflow, ensure:
1. `agentic-workflow` phases 1-3 are complete (agent events, components)
2. `review-pipeline-enhancements` phases 1-4 are complete (session events, split-pane)
3. All packages build successfully: `npm run build`

## How to Use

### Option 1: Full Orchestrator (Recommended)
```
Open master-orchestrator.md in empty AI context and follow the phases.
```

### Option 2: Individual Phases
Run specific phase files if you only need certain integrations:
- `01-streaming-integration.md` - Wire triage streaming
- `02-parallel-execution.md` - Enable parallel lenses
- `03-ui-integration.md` - Connect UI to events
- `04-settings-onboarding.md` - Complete settings flow
- `05-github-actions.md` - Improve CI integration
- `06-final-testing.md` - Validation checklist

## Phase Overview

| Phase | What It Does | Files Changed |
|-------|--------------|---------------|
| 1 | Wire streaming triage to SSE | `services/triage.ts`, `routes/triage.ts` |
| 2 | Enable parallel lens execution | `review/triage.ts` |
| 3 | Connect UI to agent events | `use-triage.ts`, `review-view.tsx` |
| 4 | Wire settings and onboarding | `settings-view.tsx`, `onboarding-screen.tsx` |
| 5 | Improve GitHub Actions | `ai-review.yml`, `pr-review.ts` |
| 6 | Final testing and validation | Tests, scripts |

## Expected Outcome

After completing all phases:

### Agent Visibility
```
User: stargazer review
UI:   🔍 Detective started scanning...
      └─ Reading auth.ts:42-55
      └─ Found: SQL Injection Risk
🔒 Guardian analyzing security...
      └─ Checking OWASP patterns...
⚡ Optimizer checking performance...
[3 agents complete] [7 issues found]
```

### Settings Working
- Provider status shows correctly
- Theme changes apply immediately
- Controls mode switches properly

### GitHub Actions
- Inline comments on PR lines
- `/ai-review` comment trigger
- Severity-based review events

## Validation

Run the integration test:
```bash
./scripts/test-integration.sh
```

Check the manual testing checklist:
```bash
cat docs/testing-checklist.md
```

## Troubleshooting

### Agent events not appearing
1. Check server logs for SSE output
2. Verify `triageReviewStream` is being called
3. Check browser/curl can connect to SSE endpoint

### Settings showing placeholders
1. Check `/config/providers` endpoint works
2. Verify hooks are using the API
3. Check network tab for errors

### GitHub Actions failing
1. Check secrets are configured
2. Verify server starts in CI
3. Check diff size limits
