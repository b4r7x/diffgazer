# Web UI Creation Workflow

Create the Stargazer Web UI application.

## Overview

This workflow creates a full React web application for Stargazer that:
- Follows Bulletproof React architecture
- Uses Base UI + Tailwind (shadcn pattern)
- Connects to existing Hono backend
- Shows real-time agent activity

## Phases

| Phase | Focus | Agent |
|-------|-------|-------|
| 1 | Project Setup | frontend-developer |
| 2 | UI Components | frontend-developer |
| 3 | Review Feature | frontend-developer + backend-developer |
| 4 | Settings Feature | frontend-developer + backend-developer |
| 5 | Layout & Navigation | frontend-developer |
| 6 | Polish | frontend-developer |

## Prerequisites

- Server (`apps/server`) working
- Packages (`@repo/schemas`, `@repo/api`, `@repo/core`) built

## Usage

### In Claude Code
```
Run the workflow at .claude/workflows/web-ui-creation/master-orchestrator.md
```

### In Antigravity
```
/create-web-ui
```

## Model Recommendation

**Gemini 3 Pro** is recommended for this workflow because:
- Best-in-class UI/frontend generation
- #1 on WebDev Arena leaderboard
- Thinks in design systems, not individual components

If using Claude Code, the `frontend-developer` agent works well.

## Output

After completion:
```
apps/web/
├── src/
│   ├── app/routes/          # Pages
│   ├── components/ui/       # UI primitives
│   ├── features/            # Feature modules
│   ├── hooks/               # Shared hooks
│   └── lib/                 # Utilities
├── package.json
├── tailwind.config.ts
└── vite.config.ts
```

## Next Steps

After this workflow, run **Web Backend Integration** to:
- Extract shared components to `@repo/ui`
- Wire up to real backend
- Add CLI `web` command
