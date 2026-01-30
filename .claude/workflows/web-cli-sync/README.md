# Web-CLI Sync Workflows

Synchronize web and CLI apps to share the same data, structure, and backend connections.

---

## Two-Phase Execution

```
╔═══════════════════════════════════════╗
║  PHASE 1: AUDIT ALL                   ║
║  Get complete picture of all gaps     ║
╠═══════════════════════════════════════╣
║  01 → Structure gaps                  ║
║  02 → Component gaps (audit only)     ║
║  03 → API connection gaps (audit only)║
║  04 → Backend endpoint gaps           ║
╠═══════════════════════════════════════╣
║  ⏸️  USER APPROVAL                     ║
╠═══════════════════════════════════════╣
║  PHASE 2: IMPLEMENT                   ║
║  Execute approved changes             ║
╠═══════════════════════════════════════╣
║  02 → Create CLI components           ║
║  03 → Wire web to backend             ║
╚═══════════════════════════════════════╝
```

**Run orchestrator:**
```
/run-web-cli-sync
```

---

## Workflow Types

| Workflow | Type | Phase 1 Output | Phase 2 Output |
|----------|------|----------------|----------------|
| 01-structure-audit | AUDIT ONLY | Gap list | - |
| 02-component-mirror | AUDIT + IMPLEMENT | Mapping table | CLI components |
| 03-web-backend-connect | AUDIT + IMPLEMENT | API design | Web API hooks |
| 04-backend-gaps | AUDIT ONLY | Endpoint specs | - (future work) |

---

## Agents (17 total)

### Analysis
| Agent | Purpose |
|-------|---------|
| `feature-dev:code-explorer` | Deep codebase analysis |
| `feature-dev:code-architect` | Architecture blueprints |

### React/Components
| Agent | Purpose |
|-------|---------|
| `react-component-architect` | Component design |
| `react-principles` | React patterns |
| `javascript-typescript:typescript-pro` | TypeScript |

### Backend/API
| Agent | Purpose |
|-------|---------|
| `api-architect` | API design |
| `backend-developer` | Implementation |
| `backend-development:backend-architect` | Architecture |

### Quality
| Agent | Purpose |
|-------|---------|
| `feature-dev:code-reviewer` | Code review |
| `code-simplifier:code-simplifier` | Simplification |
| `pr-review-toolkit:type-design-analyzer` | Type design |
| `pr-review-toolkit:pr-test-analyzer` | Test coverage |
| `pr-review-toolkit:silent-failure-hunter` | Error handling |
| `pr-review-toolkit:comment-analyzer` | Comment quality |

### Other
| Agent | Purpose |
|-------|---------|
| `full-stack-orchestration:security-auditor` | Security |
| `documentation-specialist` | Documentation |
| `code-reviewer` | Final review |

---

## Principles

1. **Web is source of truth** for UI structure and components
2. **CLI mirrors web** in terminal-friendly Ink format
3. **Shared data in @repo/core** - labels, menu items, types
4. **Same backend connections** - CLI and web use identical API calls
5. **No mock data in web** - everything connected to real backend
6. **AUDIT before IMPLEMENT** - full picture before coding
7. **Overengineering check** - validate gaps are real, not imagined
