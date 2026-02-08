# Architecture

Technical architecture reference for contributors working on the Stargazer codebase.

## Overview

Stargazer is a pnpm monorepo. All packages are ESM (`"type": "module"`) with `verbatimModuleSyntax: true`. Packages use subpath exports for tree-shaking and declare `"sideEffects": false`.

The CLI is the distribution unit. It bundles the Hono server and pre-built web assets into a single installable package. One command starts the server, serves the UI, and opens the browser.

## Monorepo Structure

```
stargazer/
├── apps/
│   ├── cli/                # stargazer — Ink 6 launcher, bundles server + web
│   ├── server/             # @stargazer/server — Hono backend (127.0.0.1:3000)
│   └── web/                # @stargazer/web — React 19 + Vite 7 frontend
│
├── packages/
│   ├── tsconfig/           # Shared TypeScript configs (base, node, react, cli, test)
│   ├── schemas/            # @stargazer/schemas — Zod v4 validation schemas
│   ├── core/               # @stargazer/core — Result<T,E>, errors, review state, utilities
│   ├── api/                # @stargazer/api — Type-safe API client
│   ├── hooks/              # @stargazer/hooks — useTimer, getFigletText
│   ├── keyboard/           # @stargazer/keyboard — useScope, useKey, useNavigation
│   └── ui/                 # @stargazer/ui — Terminal-inspired component library
│
└── docs/                   # Documentation
```

## Package Dependency Graph

```
                @stargazer/tsconfig (devDep for all)
                       │
          ┌────────────┼────────────┐
          v            v            v
    @stargazer/   @stargazer/   @stargazer/
     schemas       keyboard       hooks
     (leaf)        (leaf)         (leaf)
          │
          v
    @stargazer/core
    (depends on: schemas)
          │
     ┌────┴────┐
     v         v
@stargazer/  @stargazer/ui
   api         (leaf)
(depends on:
 core, schemas)
     │
     v
┌────┴─────────────────────────┐
v                              v
@stargazer/server          @stargazer/web
(deps: api, core,          (deps: api, core, schemas,
 schemas)                   hooks, keyboard, ui)
└──────────┐  ┌────────────────┘
           v  v
       stargazer (CLI)
       (bundles: core, hooks, server)
```

## Packages

**@stargazer/schemas** -- Zod v4 schemas. Single source of truth for all data shapes: reviews, issues, events, config, git status, UI types.

**@stargazer/core** -- `Result<T,E>` type with `ok()`/`err()` constructors, error definitions, severity constants, formatting utilities. Also contains the shared review state reducer and SSE stream processor used by both web and CLI.

**@stargazer/api** -- Type-safe API client created via `createApi({ baseUrl })`. Used by both web and CLI for all server communication. No direct `fetch` calls in apps.

**@stargazer/hooks** -- Two shared React hooks: `useTimer` (elapsed time tracking) and `getFigletText` (ASCII art generation).

**@stargazer/keyboard** -- Keyboard navigation system: `useScope` sets context, `useKey` registers handlers, `useNavigation` provides arrow-key navigation within containers.

**@stargazer/ui** -- Custom terminal-inspired React component library. Primitives (Button, Badge, Input), layout (Panel, ScrollArea, FocusablePane), and compound components (Dialog, Tabs, CodeBlock, DiffView). No Radix or shadcn.

## Server

Hono backend with feature-based route structure. Binds to `127.0.0.1` only, default port 3000.

Feature routes: `health`, `config`, `settings`, `git`, `review`. Shared libraries handle AI client management, git operations, diff parsing, review orchestration, and storage.

**Middleware stack** (applied in order):

1. Host header validation -- rejects non-localhost hosts (403)
2. Security headers -- `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`
3. CORS -- localhost/127.0.0.1 origins only (CVE-2024-28224)
4. Setup guard -- requires configured provider + model + trust
5. Trust guard -- requires per-project trust grant
6. Body limit -- 10KB-50KB per route
7. Zod validation -- request validation with structured errors

## Web App

React 19 + Vite 7 with TanStack Router, Tailwind 4, and a terminal-inspired design system ("TUI"). JetBrains Mono throughout.

Keyboard-first navigation via `@stargazer/keyboard` -- all pages are fully navigable without a mouse. Dynamic footer bar shows per-page shortcuts.

State management uses pure React: context providers (config, theme, footer), `useReducer` with the shared core reducer for review state, and `useSyncExternalStore` for module-level caches. No Redux or Zustand.

## CLI

Ink 6 app that acts as a **launcher, not an interactive TUI**. It starts the server, opens the browser, displays status, and handles graceful shutdown. All user interaction happens in the browser.

**Production mode:** Single embedded Hono server serves both `/api/*` routes and static web assets from `dist/web/`. Opens browser to `:3000`.

**Development mode:** Starts API server on `:3000` (via `tsx`) and Vite dev server on `:3001` (which proxies `/api` to `:3000`). Opens browser to `:3001`.

## Key Decisions

- **ESM everywhere** with `verbatimModuleSyntax: true`. No CommonJS.
- **Subpath exports** for tree-shaking (e.g., `@stargazer/core/result`, not `@stargazer/core`).
- **`Result<T,E>`** for error handling, not try/catch. Callers must handle both paths.
- **React 19 Compiler** auto-memoizes. No manual `useCallback`/`useMemo`.
- **XML escaping** for all user content in AI prompts (CVE-2025-53773).
- **CORS locked to localhost** (CVE-2024-28224).

## Build Pipeline

Packages must build in dependency order:

```
1. schemas          (tsc)       -- leaf
2. core             (tsc)       -- depends on schemas
3. api              (tsc)       -- depends on core, schemas
4. hooks, keyboard, ui  (tsc)   -- leaves, can build in parallel
5. server           (tsc)       -- depends on api, core, schemas
6. web              (vite build)-- depends on all packages
7. CLI              (tsup)      -- bundles core, hooks, server + web output
```

The CLI build copies the Vite output into `apps/cli/dist/web/` and bundles the server code via tsup with `noExternal` for core, hooks, and server packages.

---

[Back to README](../README.md)
