# Audits Index

Specialized audits for different areas of the codebase. Run individually or together via `codebase-reusability-audit.md`.

---

## Available Audits

| Audit | Target | Agent | Focus |
|-------|--------|-------|-------|
| `audit-schemas.md` | `packages/schemas/` | `pr-review-toolkit:type-design-analyzer` | Zod patterns, type inference, validation |
| `audit-core.md` | `packages/core/` | `javascript-typescript:typescript-pro` | Library patterns, Result<T,E>, exports |
| `audit-react.md` | `apps/cli/`, `apps/web/` | `react-component-architect` | React 19, memoization, Zustand, colocation |
| `audit-server.md` | `apps/server/` | `backend-development:backend-architect` | Hono patterns, thin routes, services |
| `audit-tests.md` | All `*.test.ts*` | `unit-testing:test-automator` | Practical testing, no overengineering |
| `audit-overengineering.md` | All source | `code-review-ai:architect-review` | YAGNI, unnecessary abstractions, AI patterns |

---

## Run Individual Audit

```
Run audit from .claude/workflows/audits/audit-react.md on apps/cli/src/
```

---

## Run All Audits

```
Run .claude/workflows/codebase-reusability-audit.md
```

This will run:
1. Structure validation (naming, folders)
2. All specialized audits (schemas, core, react, server, tests)
3. Auto-fix violations

---

## Quick Reference

### Naming Conventions

| Area | Convention |
|------|------------|
| `packages/*` | kebab-case |
| `apps/cli/*`, `apps/web/*` | kebab-case |
| `apps/server/*` | kebab-case |

### Key Rules

**React (2026):**
- Don't overuse useMemo/useCallback - React Compiler handles it
- Write pure components
- Use Zustand with selectors

**Schemas:**
- Use safeParse(), not parse()
- Infer types with z.infer<>
- Validate at boundaries only

**Server:**
- Thin routes, fat services
- Services return Result<T,E>
- Use HTTPException for errors

**Tests (see `.claude/docs/testing.md`):**
- Test behavior, not implementation
- Use accessible queries (getByRole > getByTestId)
- Use userEvent, not fireEvent
- Mock at network boundary (MSW), not internal modules
- 100% use case coverage > 100% code coverage
- Don't test: constants, trivial getters, framework behavior, CSS
- Don't spy on React hooks (useState, useEffect)
- Don't test same case twice

**Over-Engineering (AI-Generated Code):**
- YAGNI: Don't build for hypothetical future needs
- Rule of Three: Don't abstract until 3 real use cases
- Remove: single-impl interfaces, unnecessary factories, pass-through wrappers
- Validate once at boundary, not every layer
- Duplication > wrong abstraction (wait for patterns to emerge)
