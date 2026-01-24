# Claude Code Configuration

This directory contains prompts, workflows, and documentation for Claude Code.

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
│   ├── master-orchestrator.md       # Run all improvement workflows
│   ├── 01-package-structure-audit.md
│   ├── 02-cli-bulletproof-verification.md
│   ├── 03-server-bulletproof-verification.md
│   ├── 04-ai-sdk-migration.md
│   ├── 05-review-flow-implementation.md
│   ├── 06-documentation-generator.md
│   ├── 07-gap-fixer.md
│   ├── 08-stream-error-debug.md
│   ├── code-review-workflow.md
│   ├── code-simplification-workflow.md
│   ├── codebase-reusability-audit.md
│   └── typecheck-fix-workflow.md
└── docs/              # Reference documentation
    ├── decisions.md   # Architecture Decision Records (ADRs)
    ├── patterns.md    # Patterns to preserve (do not simplify)
    └── security.md    # Security architecture reference
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
