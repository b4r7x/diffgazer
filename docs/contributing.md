# Contributing to Stargazer

## Prerequisites

- **Node.js 20+**
- **pnpm 9+** — enable via Corepack: `corepack enable`
- **A git repository** to test reviews against (any repo with uncommitted changes works - might be even the stargazer repository itself)

## Setup

```bash
git clone https://github.com/user/stargazer.git
cd stargazer
pnpm install
pnpm dev
```

This starts the API server, Vite dev server, and opens your browser. You're ready to go.

## Dev Commands

| Command | What it does |
|---------|-------------|
| `pnpm dev` | Run web + CLI in parallel |
| `pnpm dev:cli` | CLI only — starts API on :3000, opens browser |
| `pnpm dev:web` | Web only — Vite dev server on :3001 |
| `pnpm build` | Build all packages (in dependency order) |
| `pnpm test` | Run all tests |

## How Dev Mode Works

The API server (Hono) runs on port 3000, bound to `127.0.0.1`. The Vite dev server runs on port 3001 and proxies `/api` requests to `localhost:3000`. When you run `pnpm dev`, the CLI starts both as child processes and opens a browser to `:3001` when ready.

In production, the CLI embeds the built web app and serves everything from a single server on port 3000.

## Project Structure

```
apps/cli/         CLI app (Ink 6 terminal UI + embedded server)
apps/server/      Hono backend, AI providers via Vercel AI SDK
apps/web/         React 19 + TanStack Router + Vite 7 + Tailwind 4
packages/schemas/ Zod v4 validation schemas (shared)
packages/core/    Result<T,E> type, error handling, shared utilities
packages/api/     Type-safe API client
packages/hooks/   Shared React hooks
packages/keyboard/ Keyboard shortcut handling
packages/ui/      Shared UI components
```

Keep changes scoped to the right package. See [architecture.md](./architecture.md) for the full dependency graph.

## Code Style

- **ESM everywhere** — `import`/`export`, never CommonJS
- **TypeScript strict mode**
- **kebab-case** file names (`review-display.tsx`, not `ReviewDisplay.tsx`)
- **`Result<T, E>`** for error handling, not try/catch (see `packages/core/src/result.ts`)
- **Zod v4** schemas from `@stargazer/schemas` for all validation
- **Tailwind 4 + CVA** for styling in the web app
- **No manual `useCallback`/`useMemo`** — React 19 Compiler handles memoization
- **Safe index access** with `??` fallback, no `!` assertions

## Build Order

Build order matters due to package dependencies:

schemas -> core -> api -> hooks/keyboard/ui -> server -> web -> CLI

`pnpm build` handles this automatically. If you're working on a single package, build its dependencies first.

## Making Changes

1. Keep changes scoped to the right package under `apps/` or `packages/`.
2. Run `pnpm test` before opening a PR.
3. If you're adding a new feature, open an issue first to discuss the approach.

## Current Focus

The project is in a **stabilization phase until April 2026**. Bug fixes, quality improvements, and small features are welcome. Large new features should be discussed in an issue before starting work.

---

[Back to README](../README.md)
