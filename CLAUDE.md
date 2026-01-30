# Stargazer

Local-only CLI for AI code review. TypeScript, React 19, Hono, Zod, Vitest.

## Structure

```
packages/core/     # Business logic, Result type, utilities
packages/schemas/  # Zod schemas (canonical types)
packages/api/      # API client
apps/server/       # Hono backend (localhost only)
apps/cli/          # React Ink CLI
```

## Commands

```bash
npm run type-check && npm run build && npx vitest run
```

## Critical Rules

1. **Result<T,E>** for errors, not exceptions
2. **CORS localhost only** (security)
3. **XML escape** user content in prompts
4. **No cross-feature imports** - compose at app layer
5. **kebab-case** all files
6. **Co-located tests** next to source

## Workflow Execution

For non-trivial tasks, follow `~/.claude/workflows/_base/workflow-wrapper.md`:

1. **AUDIT REPORT** → show plan, wait for "ok"
2. **Load context** → `~/.claude/docs/project-context-stargazer.md`
3. **Execute via subagents** (model=haiku) - NEVER bloat main context
4. **Update docs** → trigger project-documentation workflow

Subagents return: `file:line` + one-line summary. NOT full contents.

## Key Subagents

| Task | Agent |
|------|-------|
| Search | Explore |
| React | react-component-architect |
| Types | pr-review-toolkit:type-design-analyzer |
| Tests | pr-review-toolkit:pr-test-analyzer |
| Simplify | code-simplifier:code-simplifier |

## Workflows

Location: `~/.claude/workflows/`

`project-documentation`, `bulletproof-structure`, `react-quality`, `ui-reusability`, `component-grouping`, `overengineering-check`, `test-coverage`, `type-safety-audit`, `dead-code-detection`, `import-graph-analysis`, `react-anti-patterns`, `accessibility-audit`, `effect-cleanup-audit`, `silent-failure-hunt`, `result-pattern-compliance`, `test-quality-audit`, `layer-violation-detection`

## Reference Docs

- `.claude/docs/decisions.md` - ADRs
- `.claude/docs/patterns.md` - Patterns to preserve
- `.claude/docs/security.md` - Security requirements
- `.claude/docs/testing.md` - Testing guidelines
- `.claude/docs/structure-*.md` - Folder structure rules

## Type Locations

- Schemas: `packages/schemas/src/` (use `z.infer<typeof Schema>`)
- Errors: `packages/core/src/errors.ts`
- AI: `packages/core/src/ai/types.ts`
