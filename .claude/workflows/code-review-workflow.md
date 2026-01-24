# Code Review Workflow

## Overview

Systematic code review using specialized agents in phases.

---

## Structure Rules

Before reviewing, load context from `.claude/docs/structure-*.md`:
- `structure-packages.md` - packages/ naming (kebab-case)
- `structure-apps.md` - apps/ naming (kebab-case for ALL files)
- `structure-server.md` - Hono patterns (kebab-case)

---

## Agent Categories

### Structure & Architecture
| Agent | Purpose | Reference |
|-------|---------|-----------|
| code-archaeologist | File placement, naming conventions | structure-*.md |
| code-review-ai:architect-review | Over-abstraction, SRP violations, import hierarchy | structure-apps.md |

### Core Review
| Agent | Purpose |
|-------|---------|
| code-reviewer | Bugs, security, quality issues |
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

**Test review checklist (see `.claude/docs/testing.md`):**
- Tests behavior, not implementation details
- No spying on React hooks or internal state
- Uses `userEvent` not `fireEvent`
- Uses accessible queries (`getByRole`) not `getByTestId`
- Mocks at network boundary (MSW), not internal modules
- No duplicate test cases
- No trivial tests (constants, framework behavior)

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

### Over-Abstraction (see `.claude/workflows/audits/audit-overengineering.md`)
- architect-review (primary)
- code-simplifier (fixes)
- typescript-pro (type abstractions)

**AI-specific patterns to catch:**
- Single-impl interfaces → remove
- Generics with one type → make specific
- Factories for simple objects → direct construction
- Pass-through wrappers → use library directly
- Multiple validation layers → validate once at boundary

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
| Pre-PR | Minimum 5 essential + structure check |
| Major refactor | All agents |
| Weekly quality | architect-review, code-simplifier, code-quality-reviewer |
| Security audit | security-auditor, silent-failure-hunter, code-reviewer |
| New files | code-archaeologist (structure validation) |

---

## Structure Checks

Run on every review:

```
Verify against .claude/docs/structure-*.md:

1. File naming:
   - ALL files use kebab-case (error-classifier.ts, use-review.ts, review-display.tsx)

2. Import hierarchy (apps/):
   - shared → features → app (unidirectional)
   - No cross-feature imports

3. Feature completeness (apps/cli/):
   - features/[name]/api/index.ts
   - features/[name]/components/index.ts
   - features/[name]/hooks/index.ts
   - features/[name]/index.ts

4. Test co-location:
   - parser.ts → parser.test.ts (same folder)
```

---

## Output Format

Each agent returns:
- Severity-tagged findings (critical, high, medium, low)
- Specific file:line locations
- Actionable recommendations
- Code examples where applicable
