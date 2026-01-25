# Integration Pipeline - Quick Start

## TL;DR

Run these phases in order to connect all Stargazer features:

```
Phase 1: Wire streaming triage → SSE
Phase 2: Enable parallel lens execution
Phase 3: Connect UI to agent events
Phase 4: Wire settings and onboarding
Phase 5: Improve GitHub Actions
Phase 6: Final testing
```

## What You'll Get

After completing this pipeline:

### 1. Visible Agentic Workflow
```
User: stargazer review

🔍 Detective started scanning...
   └─ Analyzing diff: 5 files, 12 hunks
   └─ Found: Null pointer risk in auth.ts
🔒 Guardian analyzing security...
   └─ Checking OWASP Top 10 patterns...
   └─ Found: SQL Injection in query.ts
⚡ Optimizer checking performance...

[████████████░░░░░░░░] 60%

3 agents working | 5 issues found
```

### 2. Complete Settings & Onboarding
```
┌─────────────────────────────────────┐
│ Setup • Step 1/6  Trust             │
├─────────────────────────────────────┤
│ Do you trust this directory?        │
│ /Users/dev/my-project               │
│                                     │
│ ● [r] Read repository files         │
│ ● [g] Read git metadata             │
│ ○ [c] Run commands (tests/lint)     │
│                                     │
│ [1] Trust & Continue                │
│ [2] Trust Once                      │
│ [3] Skip                            │
└─────────────────────────────────────┘
```

### 3. GitHub Actions with Inline Comments
```
🔭 Stargazer AI Review

Found 3 issues in this PR.

🟠 HIGH (1)
• SQL Injection Risk `query.ts:42`

🟡 MEDIUM (2)
• Missing null check `auth.ts:15`
• Unused import `utils.ts:1`

See inline comments for details.
```

## Quick Execution

### Option 1: Full Pipeline (Recommended)

Open `master-orchestrator.md` in Claude with empty context:

```
/clear
# Paste content of master-orchestrator.md
# Follow phases 1-6
```

### Option 2: Individual Phases

For specific fixes:

| Need | Run |
|------|-----|
| Agent events streaming | `01-streaming-integration.md` |
| Faster reviews | `02-parallel-execution.md` |
| Agent UI in CLI | `03-ui-integration.md` |
| Settings working | `04-settings-onboarding.md` |
| Better GH Actions | `05-github-actions.md` |
| Final validation | `06-final-testing.md` |

## Estimated Time

| Phase | Time |
|-------|------|
| Phase 1: Streaming | ~30 min |
| Phase 2: Parallel | ~20 min |
| Phase 3: UI | ~45 min |
| Phase 4: Settings | ~60 min |
| Phase 5: GH Actions | ~30 min |
| Phase 6: Testing | ~30 min |
| **Total** | **~3-4 hours** |

## Critical Path for Hackathon Demo

**Minimum viable demo (1.5 hours):**
1. Phase 1 - Streaming (agent events flow)
2. Phase 2 - Parallel (multiple agents working)
3. Phase 3 - UI (agent panel visible)

**Full demo (3 hours):**
- Add Phase 4 (settings work)
- Add Phase 5 (GitHub integration)

## Validation Commands

```bash
# Build
npm run build

# Type check
npm run type-check

# Run tests
npx vitest run

# Integration test
./scripts/test-integration.sh

# Start CLI
npm run -w apps/cli start

# Start server only
npm run -w apps/server start
```

## Key Files Modified

```
apps/server/src/services/triage.ts      # Streaming integration
apps/server/src/api/routes/triage.ts    # SSE events
packages/core/src/review/triage.ts      # Parallel execution
apps/cli/src/features/review/hooks/     # Event capture
apps/cli/src/app/views/review-view.tsx  # Agent panel
apps/cli/src/app/screens/               # Onboarding/settings
.github/workflows/ai-review.yml         # GitHub Actions
```

## Success Criteria

✅ Agent activity panel shows during review
✅ Multiple agents appear to work simultaneously
✅ Tool calls visible (e.g., "Reading file.ts:42-55")
✅ Issues appear as found
✅ Settings show real configuration
✅ Onboarding wizard completes
✅ GitHub Actions posts inline comments

## Troubleshooting

### Agent events not showing
1. Check server logs for SSE output
2. Verify `triageReviewStream` is called
3. Check `onEvent` callback is wired

### Settings show "[Not Configured]"
1. Check `/config/providers` endpoint
2. Verify hooks fetch from API
3. Check API key is set in env

### GitHub Actions failing
1. Check secrets are configured
2. Verify server starts in CI
3. Check diff size < 5000 lines

## Next Steps

After completing this pipeline:

1. **Polish UI** - Add animations, improve styling
2. **Add features** - Feedback commands (/focus, /ask)
3. **Optimize** - Cache results, reduce token usage
4. **Document** - User guide, API docs
