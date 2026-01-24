Analyze and understand the Stargazer project before starting work.

## Read Primary Context

Read these files in order:
1. CLAUDE.md (project root)
2. docs/architecture/overview.md
3. .claude/docs/patterns.md
4. .claude/docs/decisions.md
5. .claude/docs/security.md

## Check Current State

Run:
- git log --oneline -10 (recent changes)
- git status (uncommitted work)

## Provide Summary

After reading, provide:

### Project Understanding
- What Stargazer does (1 sentence)
- Tech stack (TypeScript, React Ink, Hono, Zod, Vitest)
- Monorepo structure (packages/core, packages/schemas, packages/api, apps/cli, apps/server)

### Key Patterns (MUST follow)
- Result<T, E> for errors, not exceptions
- Zod schemas for validation
- Provider abstraction for AI
- XML escaping in prompts
- Bulletproof React (CLI) / Bulletproof Node.js (server)

### Current State
- Recent commits summary
- Any uncommitted changes
- What might need attention

### Ready
Confirm you understand the project and are ready to work.
