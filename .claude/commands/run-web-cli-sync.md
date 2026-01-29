# Web-CLI Sync Orchestrator

Execute web-cli-sync workflows in two phases: AUDIT first, then IMPLEMENT after approval.

---

## Execution Flow

```
╔═══════════════════════════════════════════════════════════════╗
║  PHASE 1: AUDIT ALL                                           ║
║  Run all 4 audits to get complete picture                     ║
╠═══════════════════════════════════════════════════════════════╣
║  01-structure-audit    → Gap list (pages vs screens)          ║
║  02-component-mirror   → Component mapping (AUDIT only)       ║
║  03-web-backend-connect → API connection list (AUDIT only)    ║
║  04-backend-gaps       → Missing endpoint specs               ║
╠═══════════════════════════════════════════════════════════════╣
║  SUMMARY + OVERENGINEERING CHECK                              ║
║  Show all findings, validate they're necessary                ║
╠═══════════════════════════════════════════════════════════════╣
║  ⏸️  STOP - Wait for user "ok" to proceed                      ║
╠═══════════════════════════════════════════════════════════════╣
║  PHASE 2: IMPLEMENT                                           ║
║  Execute implementation for approved items                    ║
╠═══════════════════════════════════════════════════════════════╣
║  02-component-mirror   → Create/update CLI components         ║
║  03-web-backend-connect → Wire web to backend APIs            ║
╚═══════════════════════════════════════════════════════════════╝
```

---

## PHASE 1: AUDIT ALL

### 1.1 Structure Audit
```
Workflow: 01-structure-audit.md (AUDIT ONLY)

Agents (opus):
- feature-dev:code-explorer → Analyze web pages
- feature-dev:code-explorer → Analyze CLI screens
- feature-dev:code-architect → Create mapping table
- pr-review-toolkit:type-design-analyzer → Type consistency

Output: Structure mapping table + gap list
```

### 1.2 Component Audit
```
Workflow: 02-component-mirror.md (AUDIT PHASE ONLY)

Agents (opus):
- feature-dev:code-explorer → Inventory web components
- feature-dev:code-explorer → Inventory CLI components
- react-component-architect → Map components, identify gaps

Output: Component mapping table + missing list
```

### 1.3 API Connection Audit
```
Workflow: 03-web-backend-connect.md (AUDIT PHASE ONLY)

Agents (opus):
- feature-dev:code-explorer → Analyze CLI API patterns
- feature-dev:code-explorer → Analyze web API state
- api-architect → Design API layer

Output: API connection checklist + design specs
```

### 1.4 Backend Gaps Audit
```
Workflow: 04-backend-gaps.md (AUDIT ONLY)

Agents (opus):
- feature-dev:code-explorer → Analyze server endpoints
- feature-dev:code-explorer → Analyze web requirements
- backend-development:backend-architect → Identify gaps
- api-architect → Design new endpoints
- full-stack-orchestration:security-auditor → Security review

Output: Missing endpoints list + specs
```

### 1.5 Audit Summary & Validation
```
Agent: code-simplifier:code-simplifier (opus)
Task: Review ALL audit outputs for overengineering
- Are all identified gaps REAL and NECESSARY?
- Is anything "just in case"?
- Can we reduce scope?

Agent: code-reviewer (opus)
Task: Validate audit quality
- Is analysis accurate?
- Are outputs actionable?
```

### 1.6 CHECKPOINT
```
╔═══════════════════════════════════════════════════════════════╗
║  ⏸️  STOP HERE                                                 ║
║                                                               ║
║  Show to user:                                                ║
║  - Structure gaps (from 01)                                   ║
║  - Component gaps (from 02 audit)                             ║
║  - API connection gaps (from 03 audit)                        ║
║  - Backend endpoint gaps (from 04)                            ║
║                                                               ║
║  Ask: "Review findings. Type 'ok' to proceed to IMPLEMENT"    ║
╚═══════════════════════════════════════════════════════════════╝
```

---

## PHASE 2: IMPLEMENT

Only runs after user approval of Phase 1 audits.

### 2.1 Component Implementation
```
Workflow: 02-component-mirror.md (IMPLEMENT PHASE)

Agents (opus):
- react-component-architect → Design Ink components
- javascript-typescript:typescript-pro → Implement with types
- react-principles → Ensure React patterns

Validation:
- feature-dev:code-reviewer → Quality check
- code-simplifier:code-simplifier → Overengineering check
```

### 2.2 API Implementation
```
Workflow: 03-web-backend-connect.md (IMPLEMENT PHASE)

Agents (opus):
- backend-developer → Implement API connections
- javascript-typescript:typescript-pro → TypeScript hooks

Validation:
- pr-review-toolkit:silent-failure-hunter → Error handling check
- pr-review-toolkit:type-design-analyzer → Type check
- code-simplifier:code-simplifier → Overengineering check
```

### 2.3 Final Summary
```
Show:
- Files created/modified
- Components added
- API connections made
- What's left (backend gaps from 04 - separate workflow)
```

---

## Quick Reference

| Phase | Workflows | Output |
|-------|-----------|--------|
| AUDIT | 01, 02-audit, 03-audit, 04 | Gap lists + specs |
| IMPLEMENT | 02-impl, 03-impl | Actual code changes |

| Workflow | Audit Output | Implement Output |
|----------|--------------|------------------|
| 01-structure-audit | Gap list | - (audit only) |
| 02-component-mirror | Mapping table | CLI components |
| 03-web-backend-connect | API design | Web API hooks |
| 04-backend-gaps | Endpoint specs | - (audit only, future work) |

---

## Rules

1. **ALL agents use model=opus**
2. **Delegate to subagents** - don't bloat main context
3. **Subagents return**: file:line + one-line summary
4. **AUDIT ALL before IMPLEMENT** - full picture first
5. **User approval required** between phases
6. **Overengineering check** after each phase
