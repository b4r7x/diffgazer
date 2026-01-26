# Web Refactor Workflows

## Overview

This directory contains workflows for refactoring the Stargazer web app to follow bulletproof-react patterns and clean up architectural issues.

## How to Use

1. **Start with the Master Orchestrator**
   - Load `master-web-refactor-orchestrator.md` into an empty Claude Code session
   - Execute phases sequentially
   - Use specified agents for each task

2. **Or Run Individual Workflows**
   - Each workflow is self-contained
   - Can be run independently if needed

## Workflow Files

| File | Description | Phase |
|------|-------------|-------|
| `master-web-refactor-orchestrator.md` | **Main entry point** - Full orchestration | All |
| `01-critical-cleanup.md` | Delete orphaned packages, fix duplicate imports | 1 |
| `02-dependencies-routes.md` | Fix package.json, register routes, fix dialog | 2 |
| `03-structure-refactor.md` | Move contexts to providers, consolidate duplicates | 3 |
| `04-import-fixes.md` | Fix cross-feature imports, convert to @/ paths | 4 |
| `05-code-quality.md` | Remove console statements, fix hooks, cleanup | 5 |
| `06-validation.md` | Type check, build, runtime verification | 6 |

## Execution Order

```
Phase 1: Critical Cleanup (Parallel - 3 agents)
├── 01-critical-cleanup.md
│
Phase 2: Dependencies & Routes (Parallel - 2 agents)
├── 02-dependencies-routes.md
│
Phase 3: Structure Refactor (Parallel - 3 agents)
├── 03-structure-refactor.md
│
Phase 4: Import Fixes (Parallel - 2 agents)
├── 04-import-fixes.md
│
Phase 5: Code Quality (Parallel - 3 agents)
├── 05-code-quality.md
│
Phase 6: Validation (Sequential - 1 agent)
└── 06-validation.md
```

## Agents Used

| Agent | Purpose |
|-------|---------|
| `Bash` | File deletion, directory operations |
| `frontend-developer` | React components, imports, structure |
| `react-component-architect` | Routes, dialog implementation |
| `code-simplifier:code-simplifier` | API/component consolidation |
| `javascript-typescript:typescript-pro` | Import conversion, validation |
| `codebase-cleanup:code-reviewer` | Console removal, code cleanup |

## What Gets Fixed

### Critical (Build-Breaking)
- Workspace name conflict (@repo/cli in 2 places)
- Duplicate imports causing syntax errors
- Missing date-fns dependency
- Missing sessions route registration
- Dead @repo/ui imports

### Architecture
- `contexts/` moved to `app/providers/`
- Cross-feature imports eliminated
- Duplicate APIs consolidated
- Duplicate components removed

### Code Quality
- Console statements removed
- Hook usage fixed
- Empty directories deleted
- Relative imports converted to @/

## What Gets Deleted

- `packages/cli/` - 90 lines orphaned code
- `packages/ui/` - 14 files unused duplicates
- `apps/web/src/App.tsx` - dead Vite boilerplate
- `apps/web/src/App.css` - dead Vite boilerplate
- `apps/web/src/assets/` - dead Vite boilerplate
- `apps/web/src/contexts/` - moved to providers
- `apps/web/src/stores/` - empty directory
- `apps/web/src/types/` - empty directory
- Duplicate API functions
- Duplicate components

## Final Structure

```
packages/
├── api/
├── core/
├── schemas/
└── tsconfig/

apps/web/src/
├── app/
│   ├── providers/
│   │   ├── index.tsx
│   │   └── config-provider.tsx
│   ├── routes/
│   └── router.tsx
├── components/
│   ├── ui/
│   ├── layout/
│   ├── agent-activity-panel.tsx
│   └── agent-status.tsx
├── features/
├── hooks/
├── lib/
├── main.tsx
└── index.css
```

## Related Documentation

- `/CLAUDE.md` - Project patterns and rules
- `/.claude/docs/structure-apps.md` - Bulletproof-react structure
- `/.claude/docs/structure-packages.md` - Package structure rules
