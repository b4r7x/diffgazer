# Server Audit (Hono & Node.js)

**Agent:** `backend-development:backend-architect`

## Purpose
Validate `apps/server/` against Hono and Node.js best practices.

---

## Checklist

### 1. Route Organization

```typescript
// ✅ Good - routes in separate files, mounted with app.route()
// api/routes/reviews.ts
const reviews = new Hono()
reviews.get('/', listReviews)
reviews.post('/', createReview)
reviews.get('/:id', getReview)
export default reviews

// api/routes/index.ts
import reviews from './reviews'
import sessions from './sessions'

const routes = new Hono()
routes.route('/reviews', reviews)
routes.route('/sessions', sessions)
export default routes

// ❌ Bad - all routes in one file
app.get('/reviews', ...)
app.post('/reviews', ...)
app.get('/sessions', ...)
// ... 500 lines
```

**Check:**
- Routes in separate files by domain
- Mounted with `app.route()`
- Index.ts aggregates routes

### 2. Thin Routes, Fat Services

```typescript
// ✅ Good - route just handles HTTP
// api/routes/reviews.ts
reviews.post('/', async (c) => {
  const body = await c.req.json()
  const validated = ReviewInputSchema.safeParse(body)
  if (!validated.success) {
    throw new HTTPException(400, { message: 'Invalid input' })
  }

  const result = await reviewService.create(validated.data)
  if (!result.ok) {
    throw new HTTPException(500, { message: result.error.message })
  }

  return c.json(result.value, 201)
})

// services/review.ts - business logic
export const reviewService = {
  async create(input: ReviewInput): Promise<Result<Review, Error>> {
    // Business logic here
    return ok(review)
  }
}

// ❌ Bad - business logic in route
reviews.post('/', async (c) => {
  const body = await c.req.json()
  // 50 lines of business logic...
  // Database calls...
  // External API calls...
  return c.json(result)
})
```

**Check:**
- Routes: validate input, call service, return response
- Services: business logic, return Result<T,E>
- No business logic in routes

### 3. Error Handling with HTTPException

```typescript
// ✅ Good - use HTTPException
import { HTTPException } from 'hono/http-exception'

if (!result.ok) {
  throw new HTTPException(404, { message: 'Review not found' })
}

// Global error handler
app.onError((error, c) => {
  if (error instanceof HTTPException) {
    return error.getResponse()
  }
  console.error(error)
  return c.json({ error: 'Internal server error' }, 500)
})

// ❌ Bad - manual error responses
if (!result.ok) {
  return c.json({ error: 'Not found' }, 404)  // Inconsistent
}
```

**Check:**
- Use `HTTPException` for all errors
- Global `app.onError()` handler
- Consistent error response format

### 4. Services Return Result<T,E>

```typescript
// ✅ Good
export const reviewService = {
  async getById(id: string): Promise<Result<Review | null, Error>> {
    try {
      const review = await db.reviews.findById(id)
      return ok(review)
    } catch (e) {
      return err(e as Error)
    }
  }
}

// ❌ Bad - throws exceptions
export const reviewService = {
  async getById(id: string): Promise<Review> {
    const review = await db.reviews.findById(id)
    if (!review) throw new Error('Not found')  // Bad
    return review
  }
}
```

**Check:** All service methods return `Result<T,E>`.

### 5. Validation at Boundaries

```typescript
// ✅ Good - validate at API boundary
reviews.post('/', async (c) => {
  const body = await c.req.json()
  const validated = ReviewInputSchema.safeParse(body)
  if (!validated.success) {
    throw new HTTPException(400, { message: formatErrors(validated.error) })
  }
  // Now validated.data is typed
})

// ❌ Bad - no validation or validation deep inside
reviews.post('/', async (c) => {
  const body = await c.req.json()
  await reviewService.create(body)  // Unvalidated!
})
```

**Check:** All external input validated with Zod at route level.

### 6. File Naming (kebab-case)

```
// ✅ Good
api/routes/reviews.ts
services/review-orchestrator.ts
lib/sse-helpers.ts

// ❌ Bad
api/routes/reviewRoutes.ts
services/reviewOrchestrator.ts
```

**Check:** All files kebab-case.

### 7. Folder Structure

```
apps/server/src/
├── index.ts           # Entry point
├── app.ts             # Hono app factory
├── api/
│   ├── routes/        # Route handlers
│   │   ├── index.ts
│   │   ├── reviews.ts
│   │   └── sessions.ts
│   └── middleware/    # Custom middleware (if needed)
├── services/          # Business logic
├── lib/               # Utilities
└── config/            # Configuration
```

**Check:** Structure matches expected pattern.

### 8. Type-Safe Middleware

```typescript
// ✅ Good - use createMiddleware for types
import { createMiddleware } from 'hono/factory'

type Variables = {
  userId: string
}

const authMiddleware = createMiddleware<{ Variables: Variables }>(
  async (c, next) => {
    c.set('userId', extractUserId(c))
    await next()
  }
)

// Usage - c.get('userId') is typed
app.get('/me', authMiddleware, (c) => {
  const userId = c.get('userId')  // string
})

// ❌ Bad - untyped middleware
const authMiddleware = async (c, next) => {
  c.set('userId', extractUserId(c))
  await next()
}
```

**Check:** Custom middleware uses `createMiddleware<>` for type safety.

---

## Commands

```bash
# Find camelCase files (should be kebab-case)
find apps/server/src -name "*.ts" | xargs basename -a | grep -E '^[a-z]+[A-Z]'

# Find business logic in routes (long route handlers)
grep -A 30 "app\.\(get\|post\|put\|delete\)" apps/server/src/api/routes/*.ts | wc -l

# Find services not returning Result
grep -rn "async.*Promise<" apps/server/src/services/ | grep -v "Result<"

# Find manual error returns (should use HTTPException)
grep -rn "return c.json.*error" apps/server/src/api/routes/
```

---

## Output

| Issue | File | Line | Fix |
|-------|------|------|-----|
| Business logic in route | routes/reviews.ts | 45-90 | Extract to service |
| Service throws | services/review.ts | 23 | Return Result<T,E> |
| Manual error response | routes/sessions.ts | 67 | Use HTTPException |
| camelCase file | sseHelpers.ts | - | Rename to sse-helpers.ts |

---

## Sources
- [Hono Best Practices](https://hono.dev/docs/guides/best-practices)
- [Building Production-Ready Apps with Hono](https://www.freecodecamp.org/news/build-production-ready-web-apps-with-hono/)
- [Hono GitHub](https://github.com/honojs/hono)
