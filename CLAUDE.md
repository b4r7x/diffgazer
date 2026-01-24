# Stargazer - Claude Code Context

## Project Overview

Stargazer is a local-only CLI tool for AI-powered code review. Server binds to `127.0.0.1` only.

**Tech Stack:** TypeScript, React 19, Hono, Zod, Vitest, Vercel AI SDK

**Monorepo Structure:**
```
packages/
├── core/       # Shared business logic, utilities, Result type
├── schemas/    # Zod schemas and types (canonical type definitions)
├── api/        # API client (bulletproof fetch pattern)
apps/
├── server/     # Hono backend (localhost only)
├── cli/        # React Ink CLI
```

## Essential Commands

```bash
npm run type-check    # TypeScript validation
npm run build         # Build all packages
npx vitest run        # Run tests
npx vitest run <file> # Run specific test file
```

## Architecture Decisions (ADRs)

**Follow these accepted decisions (see `.claude/docs/decisions.md`):**

| ADR | Rule |
|-----|------|
| 0001 | Use `Result<T, E>` for errors, not exceptions |
| 0002 | Abstract AI providers, always show selection UI |
| 0003 | CORS localhost only (CVE-2024-28224) |
| 0004 | XML escape user content in prompts (CVE-2025-53773) |
| 0005 | Use `responseSchema` for AI JSON, 65536 max tokens |

## Patterns to Preserve

**Do not simplify these without reading `.claude/docs/patterns.md`:**

1. **Result<T, E>** - Type-safe error handling, 300x faster than exceptions
2. **Provider Abstraction** - Future providers planned (Ollama, Azure, etc.)
3. **CORS Localhost Restriction** - CVE-2024-28224 DNS rebinding protection
4. **XML Escaping** - CVE-2025-53773 prompt injection protection
5. **@repo/api Client** - Centralized error handling, CSRF protection
6. **No Manual Memoization** - React 19 Compiler auto-memoizes

## Security Requirements

Reference: `.claude/docs/security.md`

- CORS: Only allow localhost/127.0.0.1 origins
- Prompts: Escape `<`, `>`, `&` in user content
- Headers: X-Frame-Options: DENY, X-Content-Type-Options: nosniff

## Shared Utilities

Use these instead of inline implementations:

| Utility | Import | Purpose |
|---------|--------|---------|
| `createLazyLoader` | `@repo/core/utils/lazy-loader` | Optional module loading |
| `createErrorClassifier` | `@repo/core/utils/error-classifier` | Error pattern matching |
| `validateSchema` | `@repo/core/utils/validation` | Zod validation |
| `parseAndValidate` | `@repo/core/utils/validation` | JSON + Zod validation |
| `safeParseJson` | `@repo/core/json` | Safe JSON parsing |
| `createError` | `@repo/core/errors` | Error factory |
| `ok`/`err` | `@repo/core/result` | Result type helpers |
| `createErrorState` | `@repo/core/utils/state-helpers` | Error state factory |
| `escapeXml` | `@repo/core/sanitization` | XML escape for prompts |
| `truncate` | `@repo/core/string` | String truncation |
| `chunk` | `@repo/core/array` | Array chunking |
| `formatRelativeTime` | `@repo/core/format` | Time formatting |

## Review System

### Lenses

Specialized review configurations for different aspects:

| Lens | Focus |
|------|-------|
| `correctness` | Bugs, logic errors, edge cases |
| `security` | Vulnerabilities, injection, auth issues |
| `performance` | Efficiency, memory, algorithms |
| `simplicity` | Complexity, maintainability |
| `tests` | Test coverage and quality |

### Profiles

Preset lens combinations:

| Profile | Lenses | Min Severity |
|---------|--------|--------------|
| `quick` | correctness | high |
| `strict` | correctness, security, tests | all |
| `perf` | correctness, performance | medium |
| `security` | security, correctness | all |

### Triage Flow

1. Parse git diff
2. Run selected lenses in parallel
3. Aggregate and deduplicate issues
4. Filter by severity
5. Save to storage with metadata

## Type Locations

- **Canonical types**: `packages/schemas/src/` (use `z.infer<typeof Schema>`)
- **Error types**: `packages/core/src/errors.ts`
- **AI types**: `packages/core/src/ai/types.ts`
- **Lens types**: `packages/schemas/src/lens.ts`
- **Triage types**: `packages/schemas/src/triage.ts`
- **Storage types**: `packages/schemas/src/triage-storage.ts`

## Code Style

- No comments describing WHAT (code should be self-documenting)
- Only WHY comments (business reasons, workarounds, API quirks)
- Functions <20 lines, nesting <3 levels
- Use existing utilities, don't reinvent patterns

## Avoid Over-Engineering

Reference: `.claude/workflows/audits/audit-overengineering.md`

**YAGNI:** Build for current requirements, not hypothetical future needs.

| Remove | When |
|--------|------|
| Interface | Single implementation |
| Generic `<T>` | Used with only one type |
| Factory | Creates only one type |
| Wrapper | Just passes through to library |
| Config option | Never changed |
| Validation | Already validated upstream |

**Rule of Three:** Don't abstract until you have 3 real use cases.

## Project Structure

**Follow structure rules (see `.claude/docs/structure-*.md`):**

| Area | Naming | Reference |
|------|--------|-----------|
| `packages/*` | kebab-case (all files) | `structure-packages.md` |
| `apps/cli/*` | kebab-case (all files) | `structure-apps.md` |
| `apps/server/*` | kebab-case (all files) | `structure-server.md` |

**Key Rules:**
- Features cannot import from other features (compose in app layer)
- Tests co-located with source files
- Use absolute imports with `@/` prefix in apps
- Package import direction: core → schemas (leaves: schemas, api)

**Commands:**
- `/project-structure` - Load structure context for implementation

## Workflows & Prompts

See `.claude/` folder:
- `.claude/prompts/` - Copy-paste prompts for common tasks
- `.claude/workflows/` - Detailed multi-phase workflows
- `.claude/docs/` - Reference documentation

## Testing Guidelines

Reference: `.claude/docs/testing.md`

**Philosophy:** 100% use case coverage > 100% code coverage

### What to Test

| Test | Skip |
|------|------|
| Business logic | Constants |
| Edge cases | Trivial getters/setters |
| Error handling | Framework behavior |
| User-visible behavior | CSS/styling |
| Integration points | Implementation details |

### Key Rules

1. **Test behavior, not implementation** - Assert on outcomes, not internal state
2. **Mock at boundaries** - Use MSW for network, not `vi.mock()` for modules
3. **Accessible queries** - `getByRole` > `getByTestId`
4. **userEvent > fireEvent** - Realistic user interactions
5. **One test per behavior** - Don't test same case twice
6. **Simple test data** - Avoid over-engineered factories

### Anti-Patterns to Avoid

- Spying on React hooks (useState, useEffect)
- Testing internal state variables
- Mocking modules you're testing
- Using `fireEvent` when `userEvent` works
- Using `getByTestId` as first choice
- Complex test setup with factories
- Chasing 100% code coverage
