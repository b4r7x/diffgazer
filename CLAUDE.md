# Stargazer

Local-only AI code review CLI tool with embedded web UI. TypeScript monorepo (pnpm).

## Commands

```bash
pnpm dev              # Run web + CLI in parallel
pnpm dev:cli          # CLI only (Ink terminal UI)
pnpm dev:web          # Web only (Vite dev server, port 3001)
pnpm build            # Build all packages
```

Server runs on port 3000. Web dev server proxies `/api` → `localhost:3000`.

## Monorepo Structure

```
apps/cli/       → Ink 6 (React for terminal) + embedded Hono server + bundled web app
apps/web/       → React 19 + TanStack Router + Vite 7 + Tailwind 4
apps/server/    → Hono backend, AI providers via Vercel AI SDK
packages/core/  → Result<T,E> type, error handling, shared utilities
packages/api/   → Type-safe API client (review, config, git types)
packages/schemas/ → Zod 4 validation schemas (shared between server & frontend)
packages/hooks/ → Shared React hooks
packages/tsconfig/ → Shared TS configs
```

## Architecture Rules

- Web is source of truth for UI structure. CLI mirrors web in Ink format.
- Shared data lives in `@stargazer/core` — labels, types, utilities.
- Both apps use `@stargazer/api` client for API calls — no direct fetch in apps.
- Use `Result<T, E>` for error handling, NOT try/catch. See @.claude/docs/decisions.md (ADR-0001).
- Use Zod 4 schemas from `@stargazer/schemas` for all validation.
- No manual `useCallback`/`useMemo` — React 19 Compiler auto-memoizes.
- No mock data in web — everything connects to real backend.

## Code Style

- ESM (`import/export`), never CommonJS
- Tailwind 4 + CVA + tailwind-merge for styling
- Destructure imports: `import { foo } from 'bar'`
- Safe index access with `??` fallback, no `!` assertions

## Security (Do NOT Weaken)

- CORS: localhost/127.0.0.1 only (CVE-2024-28224)
- XML escape user content in prompts (CVE-2025-53773)
- Security headers: X-Frame-Options, X-Content-Type-Options
- Details: @.claude/docs/security.md

## Reference Docs (Read On Demand)

- @.claude/docs/decisions.md — ADRs (error handling, providers, CORS, prompts, AI output)
- @.claude/docs/patterns.md — Protected patterns (do not simplify)
- @.claude/docs/security.md — Threat model and mitigations
- @.claude/docs/testing.md — Testing guidelines
- @.claude/docs/structure-apps.md — App folder structure
- @.claude/docs/structure-packages.md — Package folder structure
- @.claude/docs/structure-server.md — Server patterns (Hono)
- @.claude/docs/web-design-guidelines.md — Web UI design system
