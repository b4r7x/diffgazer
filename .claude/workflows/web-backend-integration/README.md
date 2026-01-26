# Web Backend Integration Workflow

Connect the Web UI to backend and extract shared code.

## Overview

This workflow:
1. Extracts shared UI components to `@repo/ui` package
2. Configures API client for browser
3. Wires all features to real backend
4. Updates server CORS
5. Adds CLI command to launch web

## Phases

| Phase | Focus | Agent |
|-------|-------|-------|
| 1 | Extract @repo/ui | backend-architect + frontend-developer |
| 2 | API Client Config | backend-architect |
| 3 | Wire Features | backend-architect |
| 4 | Server CORS | backend-architect |
| 5 | CLI Integration | backend-developer |
| 6 | Build Config | backend-architect |
| 7 | Testing | test-automator + code-reviewer |
| 8 | Cleanup | code-simplifier + documentation-specialist |

## Prerequisites

- **Web UI created** (run `web-ui-creation` workflow first)
- Server working
- All packages built

## Usage

### In Claude Code
```
Run the workflow at .claude/workflows/web-backend-integration/master-orchestrator.md
```

### In Antigravity
```
/wire-web-backend
```

## Model Recommendation

**Claude Opus 4.5** is recommended for this workflow because:
- Best for backend/integration work
- Stronger reasoning for wiring complex systems
- More reliable for infrastructure code

## Output

After completion:
```
packages/
├── ui/                      # NEW - shared UI components
│   ├── src/components/
│   └── package.json
apps/
├── web/                     # Wired to backend
├── server/                  # CORS updated
└── cli/
    └── src/commands/web.ts  # NEW - web command
```

## Verification

Test the complete flow:
```bash
# Terminal 1: Start server
pnpm --filter server dev

# Terminal 2: Start web
pnpm --filter web dev

# Or use CLI:
pnpm --filter cli start web
```

Open http://127.0.0.1:5173 and verify:
- Home page loads
- Settings work
- Review flow works
- Agent activity displays real-time
