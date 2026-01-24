# Server Structure Rules (Hono)

Based on: Official Hono best practices, real-world patterns

---

## Root Structure

```
apps/server/src/
├── index.ts              # Entry point (starts server)
├── app.ts                # Hono app configuration
│
├── api/                  # API layer
│   └── routes/           # Route definitions
│
├── services/             # Business logic
├── lib/                  # Utilities and helpers
└── config/               # Configuration
```

---

## Naming Conventions

| Element | Convention | Examples |
|---------|------------|----------|
| Route files | kebab-case | `reviews.ts`, `sessions.ts` |
| Service files | kebab-case | `review.ts`, `chat.ts` |
| Middleware files | kebab-case | `auth.ts`, `validation.ts` |
| Multi-word files | kebab-case | `review-orchestrator.ts`, `sse-helpers.ts` |
| Index files | `index.ts` | Barrel exports |
| Test files | `[name].test.ts` | `review.test.ts` |

---

## Detailed Structure

### Routes

```
api/routes/
├── index.ts              # Mounts all routes
├── health.ts             # Health check endpoint
├── reviews.ts            # Review endpoints
├── sessions.ts           # Session endpoints
├── config.ts             # Config endpoints
├── git.ts                # Git endpoints
├── triage.ts             # Triage endpoints
├── chat.ts               # Chat endpoints
└── review.ts             # Single review endpoints
```

**Route File Pattern:**

```typescript
// api/routes/reviews.ts
import { Hono } from 'hono'
import { reviewService } from '../../services/review'

const reviews = new Hono()

reviews.get('/', async (c) => {
  const result = await reviewService.list()
  if (!result.ok) {
    return c.json({ error: result.error }, 500)
  }
  return c.json(result.value)
})

reviews.post('/', async (c) => {
  const body = await c.req.json()
  const result = await reviewService.create(body)
  if (!result.ok) {
    return c.json({ error: result.error }, 400)
  }
  return c.json(result.value, 201)
})

export default reviews
```

**Route Index Pattern:**

```typescript
// api/routes/index.ts
import { Hono } from 'hono'
import health from './health'
import reviews from './reviews'
import sessions from './sessions'
import config from './config'
import git from './git'
import triage from './triage'
import chat from './chat'

const routes = new Hono()

routes.route('/health', health)
routes.route('/reviews', reviews)
routes.route('/sessions', sessions)
routes.route('/config', config)
routes.route('/git', git)
routes.route('/triage', triage)
routes.route('/chat', chat)

export default routes
```

### Services

```
services/
├── review.ts             # Review business logic
├── chat.ts               # Chat business logic
├── triage.ts             # Triage business logic
├── git.ts                # Git operations
├── review-orchestrator.ts # Complex review workflows
└── review-aggregator.ts   # Review aggregation logic
```

**Service Pattern:**

```typescript
// services/review.ts
import { ok, err, type Result } from '@repo/core'
import type { Review } from '@repo/schemas'

export const reviewService = {
  async list(): Promise<Result<Review[], Error>> {
    try {
      // Business logic
      return ok(reviews)
    } catch (error) {
      return err(error as Error)
    }
  },

  async create(data: CreateReviewInput): Promise<Result<Review, Error>> {
    // Validation, business logic
  },

  async getById(id: string): Promise<Result<Review | null, Error>> {
    // Retrieval logic
  }
}
```

### Lib (Utilities)

```
lib/
├── response.ts           # Response helpers
├── validation.ts         # Request validation
├── sse-helpers.ts        # SSE streaming utilities
└── ai-client.ts          # AI client wrapper
```

**Response Helper Pattern:**

```typescript
// lib/response.ts
import type { Context } from 'hono'
import type { Result } from '@repo/core'

export const handleResult = <T>(
  c: Context,
  result: Result<T, Error>,
  successStatus = 200
) => {
  if (!result.ok) {
    return c.json({ error: result.error.message }, 500)
  }
  return c.json(result.value, successStatus)
}
```

### Config

```
config/
└── index.ts              # Server configuration
```

---

## Middleware Organization

For complex apps, add middleware folder:

```
middleware/
├── auth.ts               # Authentication
├── cors.ts               # CORS configuration
├── error-handler.ts      # Global error handling
└── logger.ts             # Request logging
```

**Type-Safe Middleware:**

```typescript
// middleware/auth.ts
import { createMiddleware } from 'hono/factory'
import { HTTPException } from 'hono/http-exception'

type Variables = {
  userId: string
}

export const authMiddleware = createMiddleware<{ Variables: Variables }>(
  async (c, next) => {
    const token = c.req.header('Authorization')
    if (!token) {
      throw new HTTPException(401, { message: 'Unauthorized' })
    }
    c.set('userId', extractUserId(token))
    await next()
  }
)
```

---

## App Configuration

```typescript
// app.ts
import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { logger } from 'hono/logger'
import routes from './api/routes'

const app = new Hono()

// Global middleware
app.use('*', logger())
app.use('*', cors({
  origin: ['http://localhost:3000', 'http://127.0.0.1:3000'],
  credentials: true,
}))

// Mount routes
app.route('/api', routes)

// Global error handler
app.onError((error, c) => {
  console.error(error)
  return c.json({ error: 'Internal server error' }, 500)
})

export default app
export type AppType = typeof app
```

---

## Route Ordering Rules

1. **Specific routes first** - `/reviews/active` before `/reviews/:id`
2. **Middleware above handlers** - Applied in registration order
3. **Fallback routes last** - 404 handlers at the bottom
4. **First match wins** - No fallthrough behavior

---

## Error Handling

Use `HTTPException` for structured errors:

```typescript
import { HTTPException } from 'hono/http-exception'

// In route handler
if (!data) {
  throw new HTTPException(404, { message: 'Resource not found' })
}

// Custom error types
export class ValidationError extends HTTPException {
  constructor(message: string) {
    super(400, { message })
  }
}
```

---

## Test Structure

Mirror source structure:

```
services/
├── review.ts
├── review.test.ts        # ✅ Co-located
├── review-orchestrator.ts
└── review-orchestrator.test.ts
```

---

## Integration with Monorepo

```typescript
// Import from packages
import { ok, err } from '@repo/core'
import { ReviewSchema } from '@repo/schemas'
import { createApiClient } from '@repo/api'

// Validate requests with schemas
const body = await c.req.json()
const parsed = ReviewSchema.safeParse(body)
if (!parsed.success) {
  throw new HTTPException(400, { message: 'Invalid request body' })
}
```

---

## Anti-patterns

| ❌ Don't | ✅ Do |
|----------|-------|
| Separate controller files | Handlers in route files |
| `routes/reviewController.ts` | `routes/reviews.ts` |
| Business logic in routes | Extract to services |
| Throw raw errors | Use `HTTPException` |
| Magic strings for status | Use constants or enums |
| Deep route nesting | Flat route structure |
