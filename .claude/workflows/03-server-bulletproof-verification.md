# Server Bulletproof Node.js + Hono Verification Workflow

## Overview

Verify `apps/server` follows Bulletproof Node.js patterns with Hono framework best practices.

---

## Reference Structure (from docs/architecture.md)

```
apps/server/src/
├── index.ts                 # Entry: export createServer
├── app.ts                   # Hono app factory
├── api/                     # Transport layer (thin)
│   ├── routes/              # Route handlers
│   │   ├── index.ts         # Route aggregation
│   │   ├── sessions.ts
│   │   ├── reviews.ts
│   │   ├── events.ts        # SSE endpoint
│   │   └── health.ts
│   └── middleware/          # Cross-cutting concerns
│       ├── auth.ts
│       ├── cors.ts
│       ├── error-handler.ts
│       └── request-id.ts
├── config/                  # Configuration
├── loaders/                 # Bootstrap functions
├── services/                # Business logic
├── models/                  # Domain models
├── providers/               # AI provider adapters
├── storage/                 # File persistence
├── secrets/                 # Keyring + vault
├── subscribers/             # Event handlers (pub/sub)
└── types/
```

---

## Phase 1: Research (Parallel)

### Agent 1: Hono Best Practices Research
```
Web search for Hono 2025/2026 best practices:

Focus on:
- Route organization patterns
- Middleware composition
- Error handling
- SSE streaming patterns
- TypeScript integration
- Testing patterns
```

### Agent 2: Current Structure Analysis
```
Analyze apps/server/src/:

1. List all directories and contents
2. Compare against reference structure
3. Document current patterns
```

---

## Phase 2: Layer Audit (Sequential)

### Agent 3: API Layer Check
```
Verify api/ layer:

1. Routes should:
   - Handle HTTP only (parse request, call service, format response)
   - Not contain business logic
   - Use Zod for validation
   - Return proper HTTP status codes

2. Middleware should:
   - Be composable
   - Handle cross-cutting concerns only
   - Not contain business logic
```

### Agent 4: Services Layer Check
```
Verify services/:

1. Services should:
   - Contain all business logic
   - Not know about HTTP (no req/res)
   - Return Result<T, E> types
   - Be testable in isolation

2. No service should import from api/
```

### Agent 5: Infrastructure Layer Check
```
Verify storage/, secrets/, providers/:

1. Should be swappable implementations
2. Should not contain business logic
3. Should follow repository pattern where applicable
```

---

## Phase 3: Bulletproof Compliance (Sequential)

### Agent 6: Dependency Direction Check
```
Verify import flow:

api/ → services/ → models/
         ↓
    storage/, providers/, secrets/

Rules:
- api/ imports services/, never storage/ directly
- services/ import storage/, providers/, secrets/
- No circular dependencies
```

### Agent 7: Loaders Check
```
Verify loaders/:

1. Bootstrap functions should:
   - Initialize dependencies at startup
   - Return ready-to-use instances
   - Handle initialization errors properly
```

---

## Phase 4: Fixes (Parallel)

### Agent 8: Structure Refactor
```
Based on audit:
1. Move misplaced code to correct layers
2. Extract business logic from routes to services
3. Update imports
```

### Agent 9: Code Simplifier
```
Run pr-review-toolkit:code-simplifier:
- Remove unnecessary abstractions
- Consolidate duplicate code
- Verify layer boundaries
```

---

## Expected Output

1. **Compliance Report**: Layer violations, missing structure
2. **Hono Best Practices**: Recommendations from research
3. **Applied Changes**: Refactored structure
4. **Validation**: Type-check passes, tests pass

---

## Bulletproof Node.js Key Rules

1. **3-Layer Architecture**: API → Services → Data Access
2. **Dependency Injection**: Via loaders, not DI containers
3. **No Business Logic in Routes**: Routes are thin
4. **Result Types**: Services return Result<T, E>, not throw
5. **Testability**: Each layer testable in isolation
