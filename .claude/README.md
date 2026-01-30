# Claude Code Configuration

Project-specific Claude Code configuration for Stargazer.

---

## Workflows

### Web-CLI Sync (Current)

Synchronize web and CLI apps to share data, structure, and backend connections.

```
.claude/workflows/web-cli-sync/
├── README.md              # Index and execution guide
├── 01-structure-audit.md  # Compare web pages vs CLI screens
├── 02-component-mirror.md # Create CLI components from web (source of truth)
├── 03-web-backend-connect.md # Connect web to backend APIs
└── 04-backend-gaps.md     # List missing server endpoints
```

**Execution Order:**
```
01-structure-audit → 02-component-mirror → 03-web-backend-connect → 04-backend-gaps
```

**Run a workflow:**
```
Run .claude/workflows/web-cli-sync/01-structure-audit.md
```

---

## Commands

| Command | Purpose |
|---------|---------|
| `/project-context` | Load project understanding before starting work |
| `/project-update` | Update documentation after changes |
| `/run-web-cli-sync` | Execute all sync workflows with validation checkpoints |

---

## Reference Docs

| Doc | Purpose |
|-----|---------|
| `docs/decisions.md` | Architecture Decision Records (ADRs) |
| `docs/patterns.md` | Patterns to preserve (do not simplify) |
| `docs/security.md` | Security requirements (localhost-only, CORS) |
| `docs/testing.md` | Testing guidelines |
| `docs/structure-apps.md` | App folder structure rules |
| `docs/structure-packages.md` | Package folder structure rules |
| `docs/structure-server.md` | Server patterns (Hono) |
| `docs/web-design-guidelines.md` | Web UI design guidelines |

---

## Agents (17 total)

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
- `pr-review-toolkit:type-design-analyzer` - Type design
- `pr-review-toolkit:pr-test-analyzer` - Test coverage
- `pr-review-toolkit:silent-failure-hunter` - Error handling
- `pr-review-toolkit:comment-analyzer` - Comment quality

### Other
- `full-stack-orchestration:security-auditor` - Security
- `documentation-specialist` - Documentation
- `code-reviewer` - Final review

---

## Directory Structure

```
.claude/
├── README.md              # This file
├── settings.local.json    # Local permissions
├── commands/              # Slash commands
│   ├── project-context.md
│   └── project-update.md
├── docs/                  # Reference documentation
│   ├── decisions.md
│   ├── patterns.md
│   ├── security.md
│   ├── testing.md
│   ├── structure-*.md
│   ├── web-design-guidelines.md
│   └── component-library/
└── workflows/             # Execution workflows
    └── web-cli-sync/      # Current sync workflows
```

---

## Principles

1. **Web is source of truth** for UI structure and components
2. **CLI mirrors web** in terminal-friendly Ink format
3. **Shared data in @repo/core** - labels, menu items, types
4. **Same backend connections** - CLI and web use identical API calls
5. **No mock data in web** - everything connected to real backend
