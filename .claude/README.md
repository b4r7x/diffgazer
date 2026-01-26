# Claude Code Configuration

This directory contains prompts, workflows, and documentation for Claude Code.

---

## Workflow Usage Guide

### Before Writing Code
```
/project-structure
```
Loads structure rules into context before implementation.

### After Changes (Pre-PR)
```
Run code-review-workflow.md
```
Reviews code quality, security, and structure compliance.

### Full Project Audit (Weekly)
```
Run codebase-reusability-audit.md
```
Validates entire monorepo: structure, naming, colocation. Auto-fixes violations.
Runs all specialized audits from `workflows/audits/`.

### Run Specific Audit
```
Run audit from .claude/workflows/audits/audit-react.md
```

| Audit | Focus |
|-------|-------|
| `audit-schemas.md` | Zod patterns, safeParse, type inference |
| `audit-core.md` | Library patterns, Result<T,E>, exports |
| `audit-react.md` | React 19, useMemo/useCallback, Zustand |
| `audit-server.md` | Hono, thin routes, services |
| `audit-tests.md` | Practical tests, behavior over implementation |
| `audit-overengineering.md` | YAGNI, unnecessary abstractions, AI patterns |

### Web UI Workflows (NEW)

| Workflow | Model | Purpose |
|----------|-------|---------|
| `web-ui-creation/` | Gemini 3 Pro | Create web UI with Bulletproof React |
| `web-backend-integration/` | Opus 4.5 | Connect web to backend, extract shared code |

Run the master orchestrator:
```
Run workflow at .claude/workflows/web-ui-creation/master-orchestrator.md
```

Or run individual phases:
```
Run .claude/workflows/web-ui-creation/01-project-setup.md
Run .claude/workflows/web-ui-creation/02-ui-components.md
Run .claude/workflows/web-ui-creation/03-review-feature.md
```

### When to Use What

| Situation | Command/Workflow |
|-----------|------------------|
| Before writing code | `/project-structure` |
| After adding files | `code-review-workflow.md` |
| Before PR | `code-review-workflow.md` |
| Weekly maintenance | `codebase-reusability-audit.md` |
| Major refactor | `master-orchestrator.md` |
| New feature | `master-orchestrator.md` |
| Create web UI | `web-ui-creation/master-orchestrator.md` |
| Wire web backend | `web-backend-integration/master-orchestrator.md` |

### Structure Rules Quick Reference

| Area | Naming | Docs |
|------|--------|------|
| `packages/*` | kebab-case | `docs/structure-packages.md` |
| `apps/cli/*`, `apps/web/*` | kebab-case | `docs/structure-apps.md` |
| `apps/server/*` | kebab-case | `docs/structure-server.md` |

### Colocation Principle

| Used by | Location |
|---------|----------|
| 1 component | `components/[name]/use-[name].ts` |
| 1 feature | `features/[name]/hooks/` |
| Multiple features | `src/hooks/` |

---

## Structure

```
.claude/
├── commands/          # Custom slash commands (use with /project:name)
│   ├── project-context.md       # /project:project-context - Load project understanding
│   ├── project-update.md        # /project:project-update - Update documentation
│   └── project-debug-stream.md  # /project:project-debug-stream - Debug streaming error
├── prompts/           # Copy-paste prompts for common tasks
│   ├── project-context.md      # Load project understanding (run first)
│   ├── project-update.md       # Update docs after changes
│   ├── code-review.md
│   ├── code-simplification.md
│   ├── run-reusability-audit.md
│   └── typecheck-fix.md
├── workflows/         # Detailed multi-phase workflows
│   ├── master-orchestrator.md           # Full project setup/refactor
│   ├── code-review-workflow.md          # Pre-PR review (structure + quality)
│   ├── codebase-reusability-audit.md    # Full monorepo validation + auto-fix
│   ├── code-simplification-workflow.md
│   ├── typecheck-fix-workflow.md
│   ├── [numbered workflows]             # Feature-specific workflows
│   └── audits/                          # Specialized audits
│       ├── index.md                     # Audits overview
│       ├── audit-schemas.md             # Zod patterns
│       ├── audit-core.md                # Library patterns
│       ├── audit-react.md               # React 19, memoization
│       ├── audit-server.md              # Hono patterns
│       └── audit-tests.md               # Practical testing
└── docs/              # Reference documentation
    ├── decisions.md         # Architecture Decision Records (ADRs)
    ├── patterns.md          # Patterns to preserve (do not simplify)
    ├── security.md          # Security architecture reference
    ├── testing.md           # Testing guidelines (what to test, anti-patterns)
    ├── structure-packages.md # Package naming rules (kebab-case)
    ├── structure-apps.md     # App naming rules (kebab-case, Bulletproof)
    └── structure-server.md   # Server naming rules (kebab-case, Hono patterns)
```

## Quick Start

### Project Context (Run First in New Session)
```
See .claude/prompts/project-context.md
Loads full project understanding before starting work.
```

### Project Update (Run After Changes)
```
See .claude/prompts/project-update.md
Updates documentation for future AI sessions.
```

### Code Review
```
See .claude/prompts/code-review.md for review prompts
```

### Code Simplification
```
See .claude/prompts/code-simplification.md for simplification prompts
```

### Reusability Audit
```
See .claude/prompts/run-reusability-audit.md for audit prompts
```

### TypeCheck Fix
```
See .claude/prompts/typecheck-fix.md for type error fixing prompts
```

## Prompts vs Workflows

**Prompts** (`prompts/`): Ready-to-use, copy-paste commands for Claude Code.

**Workflows** (`workflows/`): Detailed documentation explaining agents, phases, and strategies. Reference these to understand how prompts work or customize them.

## Important References

Before simplifying code, read:
- `.claude/docs/patterns.md` - Patterns that must not be removed
- `.claude/docs/security.md` - Security requirements

Before writing tests, read:
- `.claude/docs/testing.md` - What to test, anti-patterns to avoid

## Available Agents

### Core Review
- `code-reviewer` - Bugs, security, quality
- `code-review-ai:architect-review` - Over-abstraction, SRP
- `pr-review-toolkit:code-simplifier` - Simplification

### Technology
- `typescript-pro` - TypeScript patterns
- `react-component-architect` - React patterns
- `backend-architect` - Node.js/Hono patterns

### Specialized
- `pr-review-toolkit:type-design-analyzer` - Zod schemas
- `pr-review-toolkit:silent-failure-hunter` - Error handling
- `full-stack-orchestration:security-auditor` - Security
- `performance-optimizer` - Performance
- `unit-testing:test-automator` - Tests

### Analysis
- `code-archaeologist` - Codebase exploration
- `code-simplifier:code-simplifier` - Code cleanup

## Shared Utilities

When simplifying, use these existing utilities:

| Utility | Location | Purpose |
|---------|----------|---------|
| createLazyLoader | core/utils/lazy-loader.ts | Optional module loading |
| createErrorClassifier | core/utils/error-classifier.ts | Error pattern matching |
| createResourceWrapper | core/utils/resource-wrapper.ts | Optional resource access |
| validateSchema | core/utils/validation.ts | Zod validation |
| parseAndValidate | core/utils/validation.ts | JSON + Zod validation |
| safeParseJson | core/json.ts | Safe JSON parsing |
| createError | core/errors.ts | Error factory |
| ok/err | core/result.ts | Result type helpers |
