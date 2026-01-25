# Provider Integration Workflow

Add GLM (Z.ai) and OpenRouter providers to Stargazer.

## Overview

This workflow adds two new AI providers:
- **GLM (Z.ai)**: Chinese LLM with dedicated coding endpoint
- **OpenRouter**: Gateway to 400+ models with dynamic model fetching

## Features

| Provider | Endpoint | Models | Cache |
|----------|----------|--------|-------|
| GLM | Standard / Coding (default) | glm-4.6, glm-4.7 | None |
| OpenRouter | `openrouter.ai/api/v1` | 400+ (fetched dynamically) | 1-day file cache |

## Phases

| # | Phase | Agent | Files |
|---|-------|-------|-------|
| 1 | Schema Updates | `typescript-pro` | `packages/schemas/src/config.ts` |
| 2 | Core SDK Integration | `backend-architect` | `packages/core/src/ai/sdk-client.ts` |
| 3 | API Routes | `backend-developer` | `apps/server/src/api/routes/` |
| 4 | CLI UI | `frontend-developer` | `apps/cli/src/components/wizard/` |
| 5 | Security Review | `code-reviewer` | All new code |
| 6 | Tests | `test-automator` | `*.test.ts` files |

## How to Run

### Option A: Full Orchestrator
Paste `master-orchestrator.md` into empty Claude Code session.

### Option B: Individual Phases
Run phases sequentially:
```
Phase 1 → npm run type-check
Phase 2 → npm run type-check
Phase 3 → npm run type-check && npx vitest run
Phase 4 → npm run type-check
Phase 5 → Review findings
Phase 6 → npx vitest run
```

## Dependencies

```bash
# Install before running
pnpm add zhipu-ai-provider @openrouter/ai-sdk-provider
```

## Environment Variables

| Provider | Variable | Notes |
|----------|----------|-------|
| GLM | `GLM_API_KEY` or `ZHIPU_API_KEY` | Z.ai API key |
| OpenRouter | `OPENROUTER_API_KEY` | OpenRouter API key |

## Related Docs

- `.claude/docs/patterns.md` - Provider abstraction pattern
- `.claude/docs/decisions.md` - ADR 0002 (Provider Abstraction)
- `packages/schemas/src/config.ts` - Existing provider definitions
