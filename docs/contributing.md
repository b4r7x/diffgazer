# Contributing

I don't have a proper contribution process yet. I'll add one in the future with clearer guidelines on how PRs should look, what's expected, etc. For now, if you want to contribute, open an issue first so we can talk about it.

That said, here's how to get the project running and what to know about the codebase.

## Prerequisites

- **Node.js 20+**
- **pnpm 9+** - enable via Corepack: `corepack enable`
- A git repo to test reviews against (any repo with uncommitted changes works, can be diffgazer itself)

## Setup

```bash
git clone https://github.com/b4r7x/diffgazer
cd diffgazer
pnpm install
pnpm dev
```

This starts the API server, Vite dev server, and opens the browser.

## Dev commands

| Command | What it does |
|---------|-------------|
| `pnpm dev` | Run web + CLI in parallel |
| `pnpm dev:cli` | CLI only, starts API on :3000, opens browser |
| `pnpm dev:web` | Web only, Vite dev server on :3001 |
| `pnpm build` | Build all packages (in dependency order) |
| `pnpm test` | Run all tests |

## How dev mode works

The API server (Hono) runs on port 3000, bound to `127.0.0.1`. Vite dev server runs on port 3001 and proxies `/api` requests to `localhost:3000`. When you run `pnpm dev`, the CLI starts both as child processes and opens a browser to `:3001`.

In production, the CLI embeds the built web app and serves everything from a single server on port 3000.

## Project structure

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

See [architecture.md](./architecture.md) for the full dependency graph.

## Code style

- ESM everywhere, `import`/`export`, never CommonJS
- TypeScript strict mode
- kebab-case file names (`review-display.tsx`, not `ReviewDisplay.tsx`)
- `Result<T, E>` for error handling, not try/catch (see `packages/core/src/result.ts`)
- Zod v4 schemas from `@diffgazer/schemas` for all validation
- Tailwind 4 + CVA for styling in the web app
- No manual `useCallback`/`useMemo`, React 19 Compiler handles it
- Safe index access with `??` fallback, no `!` assertions

## Build order

Build order matters because of package dependencies:

schemas -> core -> api -> hooks/keyboard/ui -> server -> web -> CLI

`pnpm build` handles this automatically. If you're working on a single package, build its dependencies first.

---

[Back to README](../README.md)
