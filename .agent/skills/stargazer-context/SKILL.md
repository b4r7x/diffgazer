# Stargazer Project Context

## Overview

Stargazer is a local-only CLI tool for AI-powered code review. Server binds to `127.0.0.1` only.

## Tech Stack

- **TypeScript** - All code
- **React 19** - UI (Ink for CLI, standard React for Web)
- **Hono** - Backend server
- **Zod** - Schema validation
- **Vitest** - Testing
- **Vercel AI SDK** - Multi-provider AI support

## Monorepo Structure

```
packages/
├── core/       # Shared business logic, Result type, utilities
├── schemas/    # Zod schemas (canonical types) - LEAF PACKAGE
├── api/        # API client - LEAF PACKAGE
├── ui/         # Shared UI components (NEW - for web)
apps/
├── server/     # Hono backend (localhost only)
├── cli/        # React Ink CLI
├── web/        # React Web UI (NEW)
```

## Key Patterns (MUST PRESERVE)

1. **Result<T, E>** - Use for errors, not exceptions
2. **Provider Abstraction** - AI providers are swappable
3. **CORS Localhost Only** - Security (CVE-2024-28224)
4. **XML Escaping** - Prompts (CVE-2025-53773)
5. **Zod responseSchema** - For AI JSON output
6. **No Manual Memoization** - React 19 Compiler handles it

## Architecture Rules

- Import flow: apps -> packages, packages/core -> schemas
- ALL files use **kebab-case** naming
- Features CANNOT import from other features
- Tests co-located with source files

## Existing API Endpoints

| Route | Method | Purpose |
|-------|--------|---------|
| `/health` | GET | Health check |
| `/git/status` | GET | Git status |
| `/git/diff` | GET | Git diff |
| `/config` | GET/POST | AI provider configuration |
| `/config/providers` | GET | Provider status |
| `/settings` | GET/POST | User settings |
| `/sessions` | GET/POST | Session management |
| `/sessions/:id/chat` | POST | Chat streaming (SSE) |
| `/reviews` | GET | Review history |
| `/triage/stream` | POST | Triage streaming (SSE) |
| `/pr-review` | POST | PR review for CI |

## Agent System

Each review lens maps to a named agent:

| Agent | Lens | Emoji | Description |
|-------|------|-------|-------------|
| `detective` | correctness | 🔍 | Finds bugs and logic errors |
| `guardian` | security | 🔒 | Identifies security vulnerabilities |
| `optimizer` | performance | ⚡ | Spots performance bottlenecks |
| `simplifier` | simplicity | 🧹 | Reduces complexity |
| `tester` | tests | 🧪 | Evaluates test coverage |

## Shared Utilities (use these, don't recreate)

| Utility | Import | Purpose |
|---------|--------|---------|
| `ok`/`err` | `@repo/core/result` | Result type helpers |
| `escapeXml` | `@repo/core/sanitization` | XML escape for prompts |
| `truncate` | `@repo/core/string` | String truncation |
| `createError` | `@repo/core/errors` | Error factory |
| `validateSchema` | `@repo/core/utils/validation` | Zod validation |
| `safeParseJson` | `@repo/core/json` | Safe JSON parsing |

## Type Locations

- **Canonical types**: `packages/schemas/src/` (use `z.infer<typeof Schema>`)
- **Error types**: `packages/core/src/errors.ts`
- **AI types**: `packages/core/src/ai/types.ts`
- **Lens types**: `packages/schemas/src/lens.ts`
- **Settings types**: `packages/schemas/src/settings.ts`
- **Agent event types**: `packages/schemas/src/agent-event.ts`
