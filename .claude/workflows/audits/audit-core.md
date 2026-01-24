# Core Package Audit (Library Patterns)

**Agent:** `javascript-typescript:typescript-pro`

## Purpose
Validate `packages/core/` against TypeScript library best practices (zustand, zod, trpc patterns).

---

## Checklist

### 1. File Naming (kebab-case)

```
// ✅ Good
error-classifier.ts
lazy-loader.ts
state-helpers.ts

// ❌ Bad
errorClassifier.ts
lazyLoader.ts
stateHelpers.ts
```

**Check:** All files use kebab-case. Single-word preferred.

### 2. Folder Organization by Concern

```
packages/core/src/
├── index.ts           # Main barrel export
├── result.ts          # Result<T,E> type
├── errors.ts          # Error definitions
├── json.ts            # JSON utilities
│
├── ai/                # AI integration
│   ├── index.ts
│   ├── client.ts
│   ├── types.ts
│   └── errors.ts
│
├── storage/           # Persistence
├── review/            # Review domain
├── streaming/         # SSE utilities
└── utils/             # Generic utilities
```

**Check:**
- Grouped by concern, not by type (no `types/` folder)
- Each group has `index.ts` barrel
- Max 2 levels deep

### 3. Export Patterns

```typescript
// ✅ Good - explicit re-exports
// packages/core/src/index.ts
export * from './result'
export * from './errors'
export * from './ai'
export { validateSchema, parseAndValidate } from './utils/validation'

// ❌ Bad - export everything
export * from './utils'  // Too broad
```

**Check:** Barrel files export explicitly, not wildcard from utils.

### 4. Result<T,E> Pattern

```typescript
// ✅ Good - returns Result
async function fetchData(): Promise<Result<Data, Error>> {
  try {
    const data = await api.get('/data')
    return ok(data)
  } catch (e) {
    return err(e as Error)
  }
}

// ❌ Bad - throws exceptions
async function fetchData(): Promise<Data> {
  const data = await api.get('/data')  // Throws on error
  return data
}
```

**Check:** Functions return `Result<T,E>`, not throw exceptions.

### 5. Utility Design

```typescript
// ✅ Good - factory pattern for configurable utilities
export const createErrorClassifier = (patterns: Pattern[]) => {
  return (error: Error) => {
    // Classification logic
  }
}

// ✅ Good - simple utility for pure functions
export const truncate = (str: string, max: number): string => {
  return str.length > max ? str.slice(0, max) + '...' : str
}

// ❌ Bad - class for stateless utility
export class StringUtils {
  static truncate(str: string, max: number) { ... }
}
```

**Check:**
- Factory pattern for configurable utilities
- Pure functions for simple utilities
- No classes for stateless utilities

### 6. Type Definitions Location

```typescript
// ✅ Good - types with implementation
// ai/types.ts
export interface AIClient { ... }
export type AIResponse = { ... }

// ai/client.ts
import type { AIClient, AIResponse } from './types'

// ❌ Bad - separate types folder
// types/ai.ts (wrong location)
```

**Check:** Types colocated with implementation, not in separate `types/` folder.

### 7. Test Colocation

```
// ✅ Good
├── parser.ts
├── parser.test.ts

// ❌ Bad
├── parser.ts
└── __tests__/
    └── parser.test.ts
```

**Check:** Tests next to source files, not in `__tests__/` folder.

### 8. No Circular Dependencies

```typescript
// ❌ Bad - circular import
// a.ts
import { b } from './b'
export const a = () => b()

// b.ts
import { a } from './a'  // Circular!
export const b = () => a()
```

**Check:** No circular dependencies between modules.

---

## Commands

```bash
# Find camelCase files (should be kebab-case)
find packages/core/src -name "*.ts" | xargs basename -a | grep -E '^[a-z]+[A-Z]'

# Find deep nesting (>2 levels)
find packages/core/src -mindepth 3 -type f

# Find tests not colocated
find packages/core/src -name "__tests__" -type d

# Check for class-based utilities
grep -r "^export class" packages/core/src/
```

---

## Output

| Issue | File | Line | Fix |
|-------|------|------|-----|
| camelCase file | errorClassifier.ts | - | Rename to error-classifier.ts |
| Throws exception | ai/client.ts | 45 | Return Result<T,E> |
| Tests in __tests__/ | utils/__tests__/ | - | Move tests next to source |

---

## Sources
- [Zustand GitHub](https://github.com/pmndrs/zustand)
- [tRPC Monorepo Structure](https://github.com/trpc/trpc)
- [TanStack Query Structure](https://github.com/TanStack/query)
