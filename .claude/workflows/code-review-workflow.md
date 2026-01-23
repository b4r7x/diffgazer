# Code Review Workflow

## Overview

Systematic code review using specialized agents in phases.

---

## Agent Categories

### Core Review
| Agent | Purpose |
|-------|---------|
| code-reviewer | Bugs, security, quality issues |
| code-review-ai:architect-review | Over-abstraction, SRP violations |
| pr-review-toolkit:code-simplifier | Removes unnecessary complexity |

### Technology Stack
| Agent | Purpose |
|-------|---------|
| typescript-pro | TypeScript patterns, generics, strict typing |
| react-component-architect | React patterns, hooks, composition |
| backend-architect | Node.js/Hono patterns, API design |

### Type & Schema
| Agent | Purpose |
|-------|---------|
| pr-review-toolkit:type-design-analyzer | Zod schemas, type encapsulation |

### Error Handling & Safety
| Agent | Purpose |
|-------|---------|
| pr-review-toolkit:silent-failure-hunter | Silent failures, error handling |
| full-stack-orchestration:security-auditor | OWASP, auth, DevSecOps |

### Performance
| Agent | Purpose |
|-------|---------|
| performance-optimizer | Bottleneck identification |

### Testing & Docs
| Agent | Purpose |
|-------|---------|
| pr-review-toolkit:pr-test-analyzer | Test coverage quality |
| pr-review-toolkit:comment-analyzer | Comment accuracy |
| experienced-engineer:code-quality-reviewer | Clean code principles |

### Understanding
| Agent | Purpose |
|-------|---------|
| code-archaeologist | Run FIRST on unfamiliar/legacy code |

---

## Execution Strategies

### Parallel (Fastest)
Run all Phase 1 agents simultaneously, then Phase 2, etc.

### Sequential (Most Thorough)
Run one agent, fix issues, commit, run next agent.

### Iterative (Recommended)
1. Run minimum 5 agents
2. Fix critical issues
3. Run remaining specialized agents
4. Final cleanup pass

---

## What Each Agent Detects

### DRY Violations
- code-quality-reviewer
- code-simplifier
- architect-review

### Over-Abstraction
- architect-review (primary)
- code-simplifier (fixes)
- typescript-pro (type abstractions)

### YAGNI Violations
- code-simplifier (primary)
- architect-review
- code-quality-reviewer

### SRP Violations
- architect-review (primary)
- code-quality-reviewer
- backend-architect / react-component-architect

### Unnecessary Wrappers
- architect-review (detects)
- code-simplifier (removes)

### Security Issues
- code-reviewer (general)
- security-auditor (comprehensive)
- silent-failure-hunter (error-related)

---

## When to Run

| Trigger | Agents |
|---------|--------|
| Pre-commit | code-reviewer, typescript-pro |
| Pre-PR | Minimum 5 essential |
| Major refactor | All agents |
| Weekly quality | architect-review, code-simplifier, code-quality-reviewer |
| Security audit | security-auditor, silent-failure-hunter, code-reviewer |

---

## Output Format

Each agent returns:
- Severity-tagged findings (critical, high, medium, low)
- Specific file:line locations
- Actionable recommendations
- Code examples where applicable
