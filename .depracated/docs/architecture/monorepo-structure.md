# Monorepo Structure

Stargazer uses pnpm workspaces with Turborepo for build orchestration.

## Directory Layout

```
stargazer/
├── apps/
│   ├── cli/                    # React Ink terminal UI
│   │   ├── src/
│   │   │   ├── index.ts        # Entry point (Commander)
│   │   │   ├── app/            # Application layer
│   │   │   │   ├── app.tsx     # Main component
│   │   │   │   ├── views/      # Screen components
│   │   │   │   └── hooks/      # App-level hooks
│   │   │   ├── commands/       # CLI command handlers
│   │   │   │   ├── run.ts      # TUI mode
│   │   │   │   ├── serve.ts    # Headless server
│   │   │   │   └── review.ts   # Review command
│   │   │   ├── components/     # Shared UI components
│   │   │   ├── features/       # Feature modules
│   │   │   │   ├── chat/       # Chat feature
│   │   │   │   ├── review/     # Review feature
│   │   │   │   └── sessions/   # Session management
│   │   │   ├── hooks/          # Shared hooks
│   │   │   ├── lib/            # Utilities
│   │   │   ├── stores/         # State management
│   │   │   └── types/          # TypeScript types
│   │   └── package.json
│   │
│   └── server/                 # Hono HTTP server
│       ├── src/
│       │   ├── index.ts        # Entry point
│       │   ├── app.ts          # Hono app factory
│       │   ├── api/
│       │   │   └── routes/     # Route handlers
│       │   │       ├── health.ts
│       │   │       ├── git.ts
│       │   │       ├── review.ts
│       │   │       ├── triage.ts   # Triage endpoints
│       │   │       ├── config.ts
│       │   │       ├── sessions.ts
│       │   │       └── reviews.ts
│       │   ├── config/         # Configuration
│       │   ├── lib/            # Server utilities
│       │   └── services/       # Business logic
│       │       ├── review.ts
│       │       ├── triage.ts   # Triage service
│       │       └── git.ts
│       └── package.json
│
├── packages/
│   ├── core/                   # Shared business logic
│   │   ├── src/
│   │   │   ├── index.ts        # Main exports
│   │   │   ├── result.ts       # Result type
│   │   │   ├── errors.ts       # Error utilities
│   │   │   ├── ai/             # AI client abstraction
│   │   │   │   ├── sdk-client.ts   # Vercel AI SDK client
│   │   │   │   ├── types.ts
│   │   │   │   └── errors.ts
│   │   │   ├── diff/           # Git diff parsing
│   │   │   │   ├── parser.ts
│   │   │   │   ├── applier.ts  # Patch application
│   │   │   │   └── types.ts
│   │   │   ├── review/         # Review logic
│   │   │   │   ├── lenses/     # Lens definitions
│   │   │   │   ├── profiles.ts # Review profiles
│   │   │   │   ├── triage.ts   # Triage logic
│   │   │   │   └── drilldown.ts
│   │   │   ├── fs/             # File operations
│   │   │   ├── secrets/        # Keyring integration
│   │   │   ├── storage/        # Persistence layer
│   │   │   │   ├── persistence.ts
│   │   │   │   ├── review-storage.ts  # Triage storage
│   │   │   │   └── sessions.ts
│   │   │   ├── streaming/      # SSE parsing
│   │   │   └── utils/          # Utilities
│   │   └── package.json
│   │
│   ├── schemas/                # Zod schemas (canonical types)
│   │   ├── src/
│   │   │   ├── index.ts
│   │   │   ├── config.ts       # User configuration
│   │   │   ├── review.ts       # Review types
│   │   │   ├── lens.ts         # Lens & profile types
│   │   │   ├── triage.ts       # Triage result types
│   │   │   ├── triage-storage.ts # Saved triage types
│   │   │   ├── session.ts      # Session types
│   │   │   ├── chat.ts         # Chat types
│   │   │   └── errors.ts       # Error schemas
│   │   └── package.json
│   │
│   ├── api/                    # API client
│   │   ├── src/
│   │   │   ├── index.ts
│   │   │   ├── client.ts       # Fetch wrapper
│   │   │   └── types.ts        # Client types
│   │   └── package.json
│   │
│   └── tsconfig/               # Shared TypeScript configs
│       ├── base.json
│       ├── node.json
│       ├── react.json
│       └── cli.json
│
├── docs/                       # Documentation
├── turbo.json                  # Turborepo config
├── pnpm-workspace.yaml
└── package.json
```

## Import Boundaries

```
+-------------------------------------------------------+
|                       apps/*                           |
|  +-----------+                    +-----------+        |
|  |    cli    |                    |  server   |        |
|  +-----+-----+                    +-----+-----+        |
|        |                                |              |
|        +---------------+----------------+              |
|                        | imports from                  |
+------------------------+------------------------------+
|                     packages/*                         |
|  +--------+     +----------+     +--------+           |
|  |  core  |---->|  schemas |<----|   api  |           |
|  +--------+     +----------+     +--------+           |
|       |               |                               |
|       +---------------+                               |
|             | imports from                            |
|       +-----+------+                                  |
|       |   schemas  |  (leaf package)                  |
|       +------------+                                  |
+-------------------------------------------------------+
```

### Rules

1. `apps/*` may import from any `packages/*`
2. `packages/core` may import from `schemas`
3. `packages/api` is a leaf package (no monorepo imports)
4. `packages/schemas` is a leaf package (no monorepo imports)
5. No cross-imports between `apps/*`

## Package Exports

### @repo/core

```typescript
// Main exports
export { ok, err, type Result } from "./result.js";
export { createError, getErrorMessage } from "./errors.js";

// Subpath exports
import { createAIClient } from "@repo/core/ai";
import { parseDiff, filterDiffByFiles } from "@repo/core/diff";
import { triageReview, getLenses, getProfile } from "@repo/core/review";
import { saveTriageReview, listTriageReviews } from "@repo/core/storage";
```

### @repo/schemas

```typescript
// All schemas exported from index
export { ConfigSchema, type Config } from "./config.js";
export { LensSchema, ProfileIdSchema, type Lens } from "./lens.js";
export { TriageResultSchema, type TriageIssue } from "./triage.js";
export { SavedTriageReviewSchema } from "./triage-storage.js";
```

## TypeScript Configuration

### Inheritance Hierarchy

```
base.json (strict settings, NodeNext resolution)
  ├── node.json (adds Node.js types)
  │     └── cli.json (adds JSX support)
  └── react.json (adds DOM + JSX + Bundler resolution)
```

### Usage

```json
// apps/server/tsconfig.json
{
  "extends": "@repo/tsconfig/node.json",
  "compilerOptions": {
    "outDir": "dist",
    "rootDir": "src"
  }
}

// apps/cli/tsconfig.json
{
  "extends": "@repo/tsconfig/cli.json",
  "compilerOptions": {
    "outDir": "dist",
    "rootDir": "src"
  }
}
```

## Build System

### Turborepo Tasks

```bash
npm run build         # Build all packages
npm run type-check    # TypeScript validation
npm run test          # Run all tests
npm run dev           # Development mode
```

### Package Scripts

Each package defines standard scripts:
- `build` - Compile TypeScript
- `type-check` - Type validation without emit
- `test` - Run tests

## Naming Conventions

| Type | Convention | Example |
|------|------------|---------|
| Files | kebab-case | `use-review.ts` |
| Components | kebab-case | `review-display.tsx` |
| Hooks | `use-` prefix | `use-git-status.ts` |
| Stores | `-store` suffix | `session-store.ts` |
| API files | `-api` suffix | `review-api.ts` |

## Cross-References

- [Architecture Overview](./overview.md) - System design
- [Data Flow](./data-flow.md) - Request flows
- [Packages: Core](../packages/core.md) - Core package details
