# TASK-009: Add Review Update Endpoint

## Metadata

- **Priority**: P1 (Important - needed for linking)
- **Agent**: `api-architect`
- **Dependencies**: TASK-001 (sessionId field exists)
- **Package**: `apps/server`

## Context

Read `/docs/ARCHITECTURE-SESSIONS-REVIEWS.md` Section 6 (Promoting standalone to linked).

When a user wants to "discuss" a standalone review, we need to update the review's `sessionId` to link it to the new session. This requires a PATCH endpoint.

## Current State

### File: `apps/server/src/api/routes/reviews.ts`

```typescript
// Only has GET and DELETE
reviews.get("/", async (c) => { ... });
reviews.get("/:id", async (c) => { ... });
reviews.delete("/:id", async (c) => { ... });

// No PATCH endpoint exists
```

## Target State

### Update: `apps/server/src/api/routes/reviews.ts`

```typescript
import { z } from "zod";
import { zValidator } from "@hono/zod-validator";
import { reviewStore } from "@repo/core/storage/review-history";
import { zodErrorHandler, successResponse, handleStoreError } from "../../lib/response.js";

// Add this schema
const UpdateReviewSchema = z.object({
  sessionId: z.string().uuid().nullable(),
});

// Add this endpoint
reviews.patch(
  "/:id",
  zValidator("json", UpdateReviewSchema, zodErrorHandler),
  async (c) => {
    const reviewId = c.req.param("id");
    const body = c.req.valid("json");

    // Read existing review
    const readResult = await reviewStore.read(reviewId);
    if (!readResult.ok) {
      return handleStoreError(c, readResult.error);
    }

    const review = readResult.value;

    // Update sessionId
    const updatedReview = {
      ...review,
      metadata: {
        ...review.metadata,
        sessionId: body.sessionId,
      },
    };

    // Write back
    const writeResult = await reviewStore.write(updatedReview);
    if (!writeResult.ok) {
      return handleStoreError(c, writeResult.error);
    }

    return successResponse(c, { review: updatedReview });
  }
);
```

## Files to Modify

1. `apps/server/src/api/routes/reviews.ts`
   - Add `UpdateReviewSchema`
   - Add `PATCH /:id` endpoint

## Acceptance Criteria

- [ ] `PATCH /reviews/:id` endpoint created
- [ ] Accepts `{ sessionId: string | null }` body
- [ ] Updates review's sessionId field
- [ ] Returns 404 if review not found
- [ ] Returns updated review on success
- [ ] Validates sessionId is UUID or null
- [ ] `pnpm build` passes
- [ ] `pnpm typecheck` passes

## Verification

```bash
cd /Users/voitz/Projects/stargazer
pnpm --filter @repo/server build
pnpm typecheck

# Manual test:
# 1. Create a standalone review (sessionId: null)
# 2. PATCH /reviews/{id} with {"sessionId": "some-uuid"}
# 3. GET /reviews/{id} should show updated sessionId
```

## Notes

- This endpoint ONLY updates sessionId - reviews are otherwise immutable.
- The schema validates that sessionId is a valid UUID or null.
- This is the server-side of "promote to linked" - TASK-012 handles the CLI.
