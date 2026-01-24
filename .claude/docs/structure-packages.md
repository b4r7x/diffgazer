# Package Structure Rules (core, schemas, api)

Based on: zustand, zod, trpc, tanstack-query patterns

---

## Naming Conventions

| Element | Convention | Examples |
|---------|------------|----------|
| Files | kebab-case | `result.ts`, `parser.ts`, `types.ts` |
| Folders | kebab-case | `utils/`, `storage/`, `streaming/` |
| Multi-word files | kebab-case | `error-classifier.ts`, `lazy-loader.ts` |
| Test files | `[name].test.ts` | `parser.test.ts`, `result.test.ts` |
| Index files | `index.ts` | Barrel exports only |

**Preferred:** Single-word file names when possible (`result.ts` not `result-type.ts`)

---

## Folder Organization

### packages/core/

```
packages/core/src/
├── index.ts              # Main barrel export
├── result.ts             # Result<T,E> type
├── errors.ts             # Error definitions
├── json.ts               # JSON utilities
├── format.ts             # Formatting utilities
├── array.ts              # Array utilities
├── string.ts             # String utilities
├── sanitization.ts       # Input sanitization
│
├── ai/                   # AI integration layer
│   ├── index.ts          # Barrel export
│   ├── client.ts         # AI client abstraction
│   ├── types.ts          # AI-specific types
│   ├── errors.ts         # AI-specific errors
│   └── prompts.ts        # Prompt templates
│
├── diff/                 # Git diff handling
│   ├── index.ts
│   ├── parser.ts
│   ├── applier.ts
│   └── types.ts
│
├── storage/              # Persistence layer
│   ├── index.ts
│   ├── paths.ts
│   ├── persistence.ts
│   ├── sessions.ts
│   ├── config.ts
│   └── [feature].ts
│
├── review/               # Review domain logic
│   ├── index.ts
│   ├── triage.ts
│   ├── profiles.ts
│   ├── drilldown.ts
│   └── lenses/
│       └── index.ts
│
├── streaming/            # SSE/streaming utilities
│   ├── index.ts
│   └── sse-parser.ts
│
├── secrets/              # Secret management
│   ├── index.ts
│   ├── vault.ts
│   ├── keyring.ts
│   └── types.ts
│
├── fs/                   # File system operations
│   ├── index.ts
│   └── operations.ts
│
└── utils/                # Generic utilities
    ├── validation.ts
    ├── error-classifier.ts
    ├── lazy-loader.ts
    └── state-helpers.ts
```

### packages/schemas/

```
packages/schemas/src/
├── index.ts              # Barrel export for all schemas
├── config.ts             # Configuration schemas
├── session.ts            # Session schemas
├── review.ts             # Review schemas
├── chat.ts               # Chat schemas
├── git.ts                # Git-related schemas
├── errors.ts             # Error schemas
├── lens.ts               # Lens schemas
├── triage.ts             # Triage schemas
├── triage-storage.ts     # Triage storage schemas
├── review-history.ts     # Review history schemas
└── port.ts               # Port validation
```

**Rule:** Flat structure, no subfolders. Each schema domain = one file.

### packages/api/

```
packages/api/src/
├── index.ts              # Barrel export
├── client.ts             # API client implementation
└── types.ts              # Client types
```

**Rule:** Minimal structure. API client is thin wrapper over fetch.

---

## Export Patterns

### Barrel Files (index.ts)

```typescript
// packages/core/src/index.ts
export * from './result'
export * from './errors'
export * from './json'
export * from './format'
export * from './array'
export * from './string'
export * from './sanitization'

// Re-export submodules
export * from './ai'
export * from './diff'
export * from './storage'
export * from './review'
export * from './streaming'
export * from './secrets'
export * from './fs'
export * from './utils/validation'
export * from './utils/error-classifier'
export * from './utils/lazy-loader'
export * from './utils/state-helpers'
```

### Submodule Barrels

```typescript
// packages/core/src/ai/index.ts
export * from './client'
export * from './types'
export * from './errors'
export * from './prompts'
```

---

## Test Placement

Tests co-located with source files:

```
├── parser.ts
├── parser.test.ts        # ✅ Co-located
```

NOT in separate `__tests__/` folder for packages (different from apps).

---

## Import Rules

1. **Within package:** Relative imports
   ```typescript
   import { ok, err } from '../result'
   ```

2. **Cross-package:** Workspace imports
   ```typescript
   import { ConfigSchema } from '@repo/schemas'
   import { createClient } from '@repo/api'
   ```

3. **Dependency direction:**
   - `schemas` → no monorepo imports (leaf)
   - `api` → no monorepo imports (leaf)
   - `core` → can import from `schemas`

---

## Anti-patterns

| ❌ Don't | ✅ Do |
|----------|-------|
| `errorClassifier.ts` | `error-classifier.ts` |
| `types/index.ts` folder | `types.ts` single file |
| `__tests__/parser.test.ts` | `parser.test.ts` co-located |
| Deep nesting (>2 levels) | Flat with logical grouping |
| `src/lib/utils/helpers/` | `src/utils/` |
