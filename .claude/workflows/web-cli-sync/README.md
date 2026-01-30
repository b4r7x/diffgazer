# Web-CLI Sync Workflows

Synchronize web and CLI apps to share the same data, structure, and backend connections.

## Execution Order

```
01-structure-audit.md    → Identify gaps between web pages and CLI screens
        ↓
02-component-mirror.md   → Create CLI components matching web (source of truth)
        ↓
03-web-backend-connect.md → Connect web to backend APIs (CLI already uses them)
        ↓
04-backend-gaps.md       → List server endpoints needed for web-only features
```

## Quick Reference

| Workflow | Purpose | Key Agents |
|----------|---------|------------|
| 01-structure-audit | Compare page/screen structure | code-explorer, code-architect |
| 02-component-mirror | Create Ink components from web | react-component-architect, typescript-pro |
| 03-web-backend-connect | Wire web to backend APIs | backend-developer, api-architect |
| 04-backend-gaps | Find missing server endpoints | backend-architect, security-auditor |

## Principles

1. **Web is source of truth** for UI structure and components
2. **CLI mirrors web** in terminal-friendly Ink format
3. **Shared data in @repo/core** - labels, menu items, types
4. **Same backend connections** - CLI and web use identical API calls
5. **No mock data in web** - everything connected to real backend

## Agents Used (17 total)

### Analysis
- `feature-dev:code-explorer` - Deep codebase analysis
- `feature-dev:code-architect` - Architecture blueprints

### React/Components
- `react-component-architect` - Component design
- `react-principles` - React patterns
- `javascript-typescript:typescript-pro` - TypeScript

### Backend/API
- `api-architect` - API design
- `backend-developer` - Implementation
- `backend-development:backend-architect` - Architecture

### Quality
- `feature-dev:code-reviewer` - Code review
- `code-simplifier:code-simplifier` - Simplification
- `pr-review-toolkit:type-design-analyzer` - Types
- `pr-review-toolkit:pr-test-analyzer` - Tests
- `pr-review-toolkit:silent-failure-hunter` - Error handling
- `pr-review-toolkit:comment-analyzer` - Comments

### Other
- `full-stack-orchestration:security-auditor` - Security
- `documentation-specialist` - Documentation
- `code-reviewer` - Final review
