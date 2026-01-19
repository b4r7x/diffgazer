# Architecture: Stargazer - Local AI Coding Tool

> **Version**: 1.0 (Updated from v0-initial)
> **Stack**: TypeScript, Node.js, React, Hono, Ink, TanStack Start
> **Patterns**: Bulletproof React + Bulletproof Node.js

---

## A) Architecture Decisions (10 Key Points)

1. **Monorepo Structure**: `apps/cli`, `apps/web`, `apps/server` + `packages/*` using pnpm workspaces with Turborepo for build orchestration

2. **Single Hono Server as Truth**: One Hono server handles all API endpoints, SSE streaming, and serves the static SPA build - no TanStack Start server runtime needed

3. **CLI Starts Server (OpenCode Pattern)**: CLI bootstraps the server on a random port, displays the localhost URL, provides "Open in browser" action - single entry point, simple lifecycle

4. **SSE for Realtime (Not WebSocket)**: Server-Sent Events via Hono's `streamSSE` for server->client updates; POST/JSON for client->server mutations - simpler reconnection, HTTP/2 compatible

5. **TanStack Start in SPA Mode**: Web app is pure client-side SPA built with TanStack Router - server functions disabled, Vite builds static assets served by Hono

6. **Dual-Bus Event System**: Internal event bus for in-process pub/sub + GlobalBus exposing events via SSE `/events` endpoint for remote clients

7. **@napi-rs/keyring for Secrets**: Modern keyring-rs binding with no libsecret dependency on Linux - fallback to encrypted file vault when keyring unavailable

8. **Bulletproof Patterns**:
   - CLI: Bulletproof React with `screens/` instead of `routes/`
   - Web: Bulletproof React with feature-first organization
   - Server: Bulletproof Node.js with api/services/loaders layers

9. **Functional Core, No Classes**: Pure functions for business logic, factory functions for complex initialization - no DI containers or class hierarchies

10. **Security by Default**: Bind `127.0.0.1`, require session token in custom header, no permissive CORS, validate all state-changing requests

---

## B) Trade-offs & When to Choose Differently

### SSE vs WebSocket

| Criteria | SSE (Chosen) | WebSocket |
|----------|--------------|-----------|
| Reconnection | Automatic via EventSource API | Manual implementation needed |
| HTTP/2 Multiplexing | Yes | Separate connection |
| Bidirectional | No (use POST for uploads) | Yes |
| Complexity | Simpler protocol | More complex handshake |
| Proxy/Firewall | Better compatibility | May be blocked |

**Choose WebSocket when**: Need true bidirectional streaming (e.g., real-time collaborative editing with OT/CRDT) or binary data streaming.

### Single Process (CLI+Server) vs Two Processes

| Criteria | Single (Chosen) | Two Processes |
|----------|-----------------|---------------|
| UX | Seamless, one command | Requires separate terminal |
| Port Management | CLI owns it | Race conditions possible |
| Lifecycle | Clean shutdown | Orphan process risk |
| Development | Simpler debugging | More complex |
| Resource | Shared memory | Isolation |

**Choose two processes when**: Server needs to run as daemon/service independent of CLI sessions.

### TanStack Start Server Routes vs Hono-Only

| Criteria | Hono-Only (Chosen) | TanStack Server Routes |
|----------|-------------------|------------------------|
| Runtime | Single server process | Requires Start runtime |
| Type Safety | Manual Zod schemas | Built-in from routes |
| SSE/Streaming | Native Hono support | More complex setup |
| Build | Simple Vite SPA | Full-stack build |
| Deployment | Static + API | Needs Node runtime |

**Choose TanStack Server Routes when**: Building traditional web app with SSR/SEO needs.

---

## C) Monorepo Layout

```
stargazer/
├── apps/
│   ├── cli/                      # Ink TUI (bulletproof-react pattern)
│   │   ├── src/
│   │   │   ├── index.ts          # Entry (Commander setup)
│   │   │   ├── app/              # Application layer
│   │   │   │   ├── screens/      # Screen definitions (TUI "routes")
│   │   │   │   │   ├── chat-screen.tsx
│   │   │   │   │   ├── review-screen.tsx
│   │   │   │   │   └── onboarding-screen.tsx
│   │   │   │   ├── provider.tsx  # Root context providers
│   │   │   │   └── app.tsx       # Main Ink app
│   │   │   ├── commands/         # Commander command handlers
│   │   │   │   ├── run.ts        # Start TUI
│   │   │   │   ├── serve.ts      # Headless server
│   │   │   │   └── auth.ts       # Provider auth
│   │   │   ├── components/       # Shared Ink components
│   │   │   ├── config/           # CLI configuration
│   │   │   ├── features/         # Feature modules
│   │   │   │   ├── chat/
│   │   │   │   │   ├── api/
│   │   │   │   │   ├── components/
│   │   │   │   │   ├── hooks/
│   │   │   │   │   └── index.ts
│   │   │   │   ├── review/
│   │   │   │   └── onboarding/
│   │   │   ├── hooks/            # Shared hooks
│   │   │   ├── lib/              # Server bootstrap, utilities
│   │   │   │   └── server.ts     # Server lifecycle manager
│   │   │   ├── stores/           # Zustand stores
│   │   │   ├── types/
│   │   │   └── utils/
│   │   ├── package.json
│   │   └── tsconfig.json
│   │
│   ├── web/                      # TanStack Start SPA (bulletproof-react)
│   │   ├── src/
│   │   │   ├── app/              # Application layer
│   │   │   │   ├── routes/       # TanStack Router file-based routes
│   │   │   │   │   ├── __root.tsx
│   │   │   │   │   ├── index.tsx
│   │   │   │   │   ├── chat.$session-id.tsx
│   │   │   │   │   └── reviews.tsx
│   │   │   │   ├── provider.tsx
│   │   │   │   └── router.tsx
│   │   │   ├── components/       # Shared UI components
│   │   │   │   ├── ui/           # Primitives (Button, Input)
│   │   │   │   └── layout/       # Layout components
│   │   │   ├── config/           # Configuration
│   │   │   ├── features/         # Feature modules
│   │   │   │   ├── chat/
│   │   │   │   │   ├── api/      # TanStack Query hooks
│   │   │   │   │   ├── components/
│   │   │   │   │   ├── hooks/
│   │   │   │   │   └── index.ts  # Public API
│   │   │   │   ├── review/
│   │   │   │   └── onboarding/
│   │   │   ├── hooks/            # Shared hooks
│   │   │   ├── lib/              # Utilities
│   │   │   │   ├── api-client.ts
│   │   │   │   └── sse-client.ts
│   │   │   ├── stores/           # Zustand stores
│   │   │   ├── types/
│   │   │   └── utils/
│   │   ├── vite.config.ts
│   │   └── package.json
│   │
│   └── server/                   # Hono server (bulletproof-nodejs)
│       ├── src/
│       │   ├── index.ts          # Entry point (export createServer)
│       │   ├── app.ts            # Hono app factory
│       │   ├── api/              # Transport layer
│       │   │   ├── routes/       # Route handlers
│       │   │   │   ├── index.ts  # Route aggregation
│       │   │   │   ├── sessions.ts
│       │   │   │   ├── reviews.ts
│       │   │   │   ├── events.ts # SSE endpoint
│       │   │   │   └── health.ts
│       │   │   └── middleware/   # Cross-cutting concerns
│       │   │       ├── auth.ts
│       │   │       ├── cors.ts
│       │   │       ├── error-handler.ts
│       │   │       └── request-id.ts
│       │   ├── config/           # Configuration
│       │   │   └── index.ts
│       │   ├── loaders/          # Bootstrap functions
│       │   │   ├── index.ts
│       │   │   ├── config.ts
│       │   │   ├── storage.ts
│       │   │   └── providers.ts
│       │   ├── services/         # Business logic
│       │   │   ├── session-service.ts
│       │   │   ├── review-service.ts
│       │   │   └── stream-service.ts
│       │   ├── models/           # Domain models
│       │   ├── providers/        # AI provider adapters
│       │   │   ├── types.ts
│       │   │   ├── gemini.ts
│       │   │   ├── openai.ts
│       │   │   └── anthropic.ts
│       │   ├── storage/          # File persistence
│       │   │   ├── sessions.ts
│       │   │   ├── reviews.ts
│       │   │   ├── config.ts
│       │   │   └── paths.ts      # XDG paths
│       │   ├── secrets/          # Keyring + vault
│       │   │   ├── keyring.ts
│       │   │   ├── vault.ts
│       │   │   └── index.ts
│       │   ├── subscribers/      # Event handlers
│       │   └── types/
│       ├── package.json
│       └── tsconfig.json
│
├── packages/
│   ├── tsconfig/                 # @repo/tsconfig - Shared TypeScript configurations
│   │   ├── base.json             # Base config (strict, ES2022, NodeNext, 2026 settings)
│   │   ├── node.json             # Node.js apps (extends base, adds node types)
│   │   ├── react.json            # React web apps (extends base, adds DOM + Bundler)
│   │   ├── cli.json              # CLI apps (extends node, adds JSX)
│   │   └── package.json
│   │
│   ├── schemas/                  # Zod schemas & types (leaf package)
│   │   ├── src/
│   │   │   ├── index.ts
│   │   │   ├── config.ts
│   │   │   ├── session.ts
│   │   │   ├── message.ts
│   │   │   ├── review.ts
│   │   │   ├── events.ts         # SSE event schemas
│   │   │   └── api.ts            # API request/response
│   │   └── package.json
│   │
│   ├── core/                     # Shared business logic
│   │   ├── src/
│   │   │   ├── index.ts
│   │   │   ├── session/
│   │   │   ├── review/
│   │   │   ├── chat/
│   │   │   └── git/
│   │   └── package.json
│   │
│   └── events/                   # Event bus + SSE helpers
│       ├── src/
│       │   ├── index.ts
│       │   ├── bus.ts            # In-memory event bus
│       │   ├── global-bus.ts     # Cross-client broadcast
│       │   └── sse.ts            # SSE formatting helpers
│       └── package.json
│
├── turbo.json                    # Turborepo config
├── pnpm-workspace.yaml
├── package.json
└── tsconfig.base.json            # Root TS config (extends typescript-config)
```

---

## D) Import Boundaries (Enforced via ESLint)

```
┌─────────────────────────────────────────────────────────┐
│                        apps/*                           │
│  ┌─────────┐  ┌─────────┐  ┌─────────┐                 │
│  │   cli   │  │   web   │  │  server │                 │
│  └────┬────┘  └────┬────┘  └────┬────┘                 │
│       │            │            │                       │
│       └────────────┴────────────┘                       │
│                    │ imports from                       │
├────────────────────┴────────────────────────────────────┤
│                    packages/*                           │
│  ┌────────┐  ┌──────────┐  ┌─────────┐                 │
│  │  core  │  │  events  │  │ schemas │                 │
│  └────┬───┘  └────┬─────┘  └────┬────┘                 │
│       │           │             │                       │
│       └───────────┴─────────────┘                       │
│                         │ imports from                  │
│                    ┌────┴────┐                          │
│                    │ schemas │  (lowest level)          │
│                    └─────────┘                          │
└─────────────────────────────────────────────────────────┘
```

**Rules**:
- `apps/*` may import from any `packages/*`
- `packages/core` may import from `schemas`, `events`
- `packages/events` may import only from `schemas`
- `packages/schemas` imports nothing from monorepo (leaf package)
- No cross-imports between `apps/*`
- Within each app: `shared -> features -> app` (unidirectional)

---

## E) TypeScript Configuration Package

### Config Inheritance Hierarchy

```
base.json (core strict settings, NodeNext resolution)
  ├── node.json (adds Node.js types) → used by: server, packages/*
  │     └── cli.json (adds JSX support) → used by: cli
  └── react.json (adds DOM + JSX + Bundler resolution) → used by: web
```

### packages/tsconfig/base.json

State-of-the-art 2026 base config with full strict mode:

```json
{
  "$schema": "https://json.schemastore.org/tsconfig",
  "compilerOptions": {
    "strict": true,
    "target": "ES2022",
    "lib": ["ES2022"],
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "moduleDetection": "force",
    "verbatimModuleSyntax": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true,
    "noUncheckedIndexedAccess": true,
    "noImplicitOverride": true,
    "noImplicitReturns": true,
    "noFallthroughCasesInSwitch": true
  }
}
```

### packages/tsconfig/node.json

For Hono server and Node.js packages:

```json
{
  "$schema": "https://json.schemastore.org/tsconfig",
  "extends": "./base.json",
  "compilerOptions": {
    "lib": ["ES2022"],
    "types": ["node"]
  }
}
```

### packages/tsconfig/react.json

For TanStack Start SPA web app:

```json
{
  "$schema": "https://json.schemastore.org/tsconfig",
  "extends": "./base.json",
  "compilerOptions": {
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "jsx": "react-jsx",
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "noEmit": true
  }
}
```

### packages/tsconfig/cli.json

For Ink CLI app (extends node.json, adds JSX):

```json
{
  "$schema": "https://json.schemastore.org/tsconfig",
  "extends": "./node.json",
  "compilerOptions": {
    "jsx": "react-jsx"
  }
}
```

### Usage in apps

```json
// apps/server/tsconfig.json
{
  "extends": "@repo/tsconfig/node.json",
  "compilerOptions": {
    "outDir": "dist",
    "rootDir": "src"
  },
  "include": ["src"]
}

// apps/web/tsconfig.json
{
  "extends": "@repo/tsconfig/react.json",
  "compilerOptions": {
    "outDir": "dist",
    "rootDir": "src"
  },
  "include": ["src"]
}

// apps/cli/tsconfig.json
{
  "extends": "@repo/tsconfig/cli.json",
  "compilerOptions": {
    "outDir": "dist",
    "rootDir": "src"
  },
  "include": ["src"]
}
```

---

## F) Naming Conventions

### File Naming

All component and module files should use **kebab-case** (lowercase with hyphens):

| Type | Convention | Example |
|------|------------|---------|
| Components | kebab-case | `chat-input.tsx`, `message-list.tsx` |
| Hooks | kebab-case with `use-` prefix | `use-streaming-message.ts` |
| Utilities | kebab-case | `api-client.ts`, `sse-client.ts` |
| Stores | kebab-case with `-store` suffix | `chat-store.ts` |
| Types | kebab-case | `session.ts`, `message.ts` |
| Routes | kebab-case (TanStack Router convention) | `chat.$session-id.tsx` |

**Rationale**:
- Consistent with npm package naming conventions
- Avoids case-sensitivity issues across different operating systems
- Aligns with URL/path conventions (lowercase, hyphen-separated)

**Examples**:
```
Good:
  chat-input.tsx
  message-list.tsx
  use-streaming-message.ts
  api-client.ts

Avoid:
  ChatInput.tsx (PascalCase)
  chatInput.tsx (camelCase)
  chat_input.tsx (snake_case)
```

---

## G) Folder & Module Structure Details

### CLI (apps/cli) - Bulletproof React Pattern

The CLI follows the bulletproof-react structure with `screens/` replacing `routes/`:

```
cli/src/
├── index.ts                 # Entry: Commander setup, command registration
├── app/                     # Application layer
│   ├── screens/             # TUI screens (like routes for web)
│   │   ├── chat-screen.tsx
│   │   ├── review-screen.tsx
│   │   └── onboarding-screen.tsx
│   ├── provider.tsx         # Root context providers
│   └── app.tsx              # Main Ink application
├── commands/                # Commander command handlers
│   ├── run.ts               # Default: start TUI
│   ├── serve.ts             # Headless server only
│   ├── auth.ts              # Provider authentication
│   └── config.ts            # Config management
├── components/              # Shared Ink components
│   ├── spinner.tsx
│   ├── link.tsx
│   └── status-bar.tsx
├── config/                  # CLI configuration
├── features/                # Feature modules
│   ├── chat/
│   │   ├── api/
│   │   ├── components/
│   │   ├── hooks/
│   │   └── index.ts         # Public API
│   ├── review/
│   └── onboarding/
├── hooks/                   # Shared hooks
│   ├── use-server-connection.ts
│   └── use-keyboard-shortcuts.ts
├── lib/                     # Utilities
│   └── server.ts            # Server lifecycle manager
├── stores/                  # Zustand stores
├── types/
└── utils/
```

### Web (apps/web) - Bulletproof React Pattern

```
web/src/
├── app/                     # Application layer
│   ├── routes/              # TanStack Router file-based routes
│   │   ├── __root.tsx       # Root layout + providers
│   │   ├── index.tsx        # Home/onboarding
│   │   ├── chat.$session-id.tsx
│   │   └── reviews.tsx
│   ├── provider.tsx         # Root providers
│   └── router.tsx           # Router configuration
├── components/              # Shared UI components
│   ├── ui/                  # Primitives
│   └── layout/              # Layout components
├── config/                  # Configuration
├── features/                # Feature modules
│   ├── chat/
│   │   ├── api/             # TanStack Query hooks
│   │   │   └── queries.ts
│   │   ├── components/
│   │   │   ├── chat-input.tsx
│   │   │   ├── message-list.tsx
│   │   │   └── streaming-message.tsx
│   │   ├── hooks/
│   │   │   └── use-streaming-message.ts
│   │   └── index.ts         # Public API
│   ├── review/
│   └── onboarding/
├── hooks/                   # Shared hooks
│   ├── use-sse.ts
│   └── use-server-state.ts
├── lib/                     # Utilities
│   ├── api-client.ts
│   └── sse-client.ts
├── stores/                  # Zustand stores
├── types/
└── utils/
```

### Server (apps/server) - Bulletproof Node.js Pattern

```
server/src/
├── index.ts                 # Entry: export createServer function
├── app.ts                   # Hono app factory
├── api/                     # Transport layer (thin)
│   ├── routes/              # Route handlers
│   │   ├── index.ts         # Route aggregation
│   │   ├── sessions.ts      # /sessions/* handlers
│   │   ├── reviews.ts       # /reviews/* handlers
│   │   ├── events.ts        # /events SSE endpoint
│   │   └── health.ts        # /health
│   └── middleware/          # Cross-cutting concerns
│       ├── auth.ts          # Token validation
│       ├── cors.ts          # CORS configuration
│       ├── error-handler.ts # Global error handling
│       └── request-id.ts    # Request tracing
├── config/                  # Configuration
│   └── index.ts             # Zod-validated config
├── loaders/                 # Bootstrap functions
│   ├── index.ts             # Loader aggregation
│   ├── config.ts            # Load & validate config
│   ├── storage.ts           # Initialize storage
│   └── providers.ts         # Initialize AI providers
├── services/                # Business logic
│   ├── session-service.ts
│   ├── review-service.ts
│   └── stream-service.ts
├── models/                  # Domain models
├── providers/               # AI provider adapters
│   ├── types.ts
│   ├── gemini.ts
│   ├── openai.ts
│   └── anthropic.ts
├── storage/                 # File persistence
│   ├── sessions.ts
│   ├── reviews.ts
│   ├── config.ts
│   └── paths.ts             # XDG paths
├── secrets/                 # Keyring + vault
│   ├── keyring.ts
│   ├── vault.ts
│   └── index.ts
├── subscribers/             # Event handlers (pub/sub)
└── types/
```

**Layer Rules**:
- Routes handle HTTP only (parse request, call service, format response)
- Services contain business logic (no HTTP knowledge)
- Loaders bootstrap dependencies at startup
- Models represent domain entities
- Providers/Storage/Secrets are infrastructure concerns

---

## H) Feature Module Structure

Each feature follows this structure (both CLI and Web):

```
features/[feature-name]/
├── api/                     # API calls and query hooks
│   ├── queries.ts           # TanStack Query options
│   └── mutations.ts         # Mutation hooks
├── components/              # Feature-specific components
│   ├── [component].tsx
│   └── index.ts
├── hooks/                   # Feature-specific hooks
│   └── use-[feature].ts
├── stores/                  # Feature state (if needed)
│   └── [feature]-store.ts
├── types/                   # Feature types (if complex)
│   └── index.ts
├── utils/                   # Feature utilities (if needed)
│   └── index.ts
└── index.ts                 # PUBLIC API - only export what's needed
```

### Public API Export Example

```typescript
// features/chat/index.ts

// Components
export { ChatInput } from './components/chat-input';
export { MessageList } from './components/message-list';
export { StreamingMessage } from './components/streaming-message';

// Hooks
export { useStreamingMessage } from './hooks/use-streaming-message';

// API (for route loaders)
export { chatQueryOptions, messagesQueryOptions } from './api/queries';

// Types
export type { Message, ChatSession } from './types';
```

---

## I) Secrets: Keyring/Keychain

*(See architecture-v0-initial.md Section E for full details)*

**Implementation Strategy**:
1. Check environment variable (CI/Docker override)
2. Try system keyring via @napi-rs/keyring
3. Fallback: Encrypted vault file
4. Last resort: Config file (with warning)

---

## J) Realtime: SSE Events + Streaming

*(See architecture-v0-initial.md Section F for full details)*

**Key Events**: `session.*`, `message.start/chunk/done`, `review.*`

---

## K) API Spec: Routes & Endpoints

*(See architecture-v0-initial.md Section G for full details)*

**Endpoints**: `/sessions`, `/reviews`, `/config`, `/auth`, `/health`, `/events`

---

## L) Schemas & Types

*(See architecture-v0-initial.md Section H for full details)*

Located in `packages/schemas/src/`

---

## M) Storage: XDG Compliant

*(See architecture-v0-initial.md Section I for full details)*

- Config: `~/.config/stargazer/`
- Data: `~/.local/share/stargazer/`
- State: `~/.local/state/stargazer/`
- Cache: `~/.cache/stargazer/`

---

## N) Security: Threat Model

*(See architecture-v0-initial.md Section J for full details)*

**Key mitigations**: Bind 127.0.0.1, session token, custom header, no permissive CORS

---

## O) Roadmap

*(See architecture-v0-initial.md Section K for full details)*

---

## References

1. Bulletproof React - https://github.com/alan2207/bulletproof-react
2. Bulletproof Node.js - https://github.com/santiq/bulletproof-nodejs
3. OpenCode Architecture - https://deepwiki.com/sst/opencode
4. TanStack Start SPA Mode - https://tanstack.com/start/latest/docs/framework/react/guide/spa-mode
5. Hono SSE Streaming - https://hono.dev/docs/helpers/streaming
6. @napi-rs/keyring - https://github.com/Brooooooklyn/keyring-node
7. Ink (React for CLI) - https://github.com/vadimdemedes/ink
8. Turborepo - https://turbo.build/repo
9. pnpm Workspaces - https://pnpm.io/workspaces
