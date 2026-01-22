# TASK-010: Create linkReviewToSession Function

## Metadata

- **Priority**: P1 (Important - bidirectional linking)
- **Agent**: `backend-developer`
- **Dependencies**: TASK-001, TASK-002, TASK-003, TASK-009
- **Package**: `packages/core`

## Context

Read `/docs/ARCHITECTURE-SESSIONS-REVIEWS.md` Section 6 (Workflows).

When linking a review to a session, we need to:
1. Update the review's `sessionId`
2. Add the review's ID to the session's `relatedReviewIds`

This should be a single function to ensure consistency.

## Current State

No function exists to link reviews and sessions. The operations would need to be done separately.

## Target State

### New Functions in `packages/core/src/storage/sessions.ts`

```typescript
import { reviewStore } from "./review-history.js";

/**
 * Link a review to a session (bidirectional).
 * Updates review.sessionId and session.relatedReviewIds.
 */
export async function linkReviewToSession(
  reviewId: string,
  sessionId: string
): Promise<Result<{ session: Session; review: SavedReview }, StoreError>> {
  // Read session
  const sessionResult = await sessionStore.read(sessionId);
  if (!sessionResult.ok) {
    return sessionResult;
  }
  const session = sessionResult.value;

  // Read review
  const reviewResult = await reviewStore.read(reviewId);
  if (!reviewResult.ok) {
    return reviewResult;
  }
  const review = reviewResult.value;

  // Update review with sessionId
  const updatedReview: SavedReview = {
    ...review,
    metadata: {
      ...review.metadata,
      sessionId,
    },
  };

  const reviewWriteResult = await reviewStore.write(updatedReview);
  if (!reviewWriteResult.ok) {
    return reviewWriteResult;
  }

  // Update session with reviewId (if not already present)
  const relatedReviewIds = session.metadata.relatedReviewIds || [];
  if (!relatedReviewIds.includes(reviewId)) {
    relatedReviewIds.push(reviewId);
  }

  const updatedSession: Session = {
    ...session,
    metadata: {
      ...session.metadata,
      relatedReviewIds,
      updatedAt: new Date().toISOString(),
    },
  };

  const sessionWriteResult = await sessionStore.write(updatedSession);
  if (!sessionWriteResult.ok) {
    return sessionWriteResult;
  }

  return { ok: true, value: { session: updatedSession, review: updatedReview } };
}

/**
 * Add a review ID to a session's relatedReviewIds.
 * Use when creating a new linked review.
 */
export async function addReviewToSession(
  sessionId: string,
  reviewId: string
): Promise<Result<Session, StoreError>> {
  const sessionResult = await sessionStore.read(sessionId);
  if (!sessionResult.ok) {
    return sessionResult;
  }
  const session = sessionResult.value;

  const relatedReviewIds = session.metadata.relatedReviewIds || [];
  if (!relatedReviewIds.includes(reviewId)) {
    relatedReviewIds.push(reviewId);
  }

  const updatedSession: Session = {
    ...session,
    metadata: {
      ...session.metadata,
      relatedReviewIds,
      updatedAt: new Date().toISOString(),
    },
  };

  return sessionStore.write(updatedSession);
}
```

### Add Required Imports

```typescript
import { SavedReview } from "@repo/schemas/review-history";
import { reviewStore } from "./review-history.js";
```

## Files to Modify

1. `packages/core/src/storage/sessions.ts`
   - Add `linkReviewToSession()` function
   - Add `addReviewToSession()` function
   - Add required imports

2. `packages/core/src/storage/index.ts` (if exists)
   - Export new functions

## Acceptance Criteria

- [ ] `linkReviewToSession(reviewId, sessionId)` function created
- [ ] Updates review.metadata.sessionId
- [ ] Adds reviewId to session.metadata.relatedReviewIds (if not present)
- [ ] Updates session.metadata.updatedAt
- [ ] Returns both updated session and review
- [ ] `addReviewToSession(sessionId, reviewId)` function created
- [ ] Handles case where reviewId already in array (no duplicates)
- [ ] Returns proper Result<T, E> types
- [ ] `pnpm build` passes
- [ ] `pnpm typecheck` passes

## Verification

```bash
cd /Users/voitz/Projects/stargazer
pnpm --filter @repo/core build
pnpm typecheck
```

## Notes

- `linkReviewToSession` is for promoting standalone reviews to linked.
- `addReviewToSession` is for when creating a new linked review (TASK-011).
- Both functions are atomic at the file level (each write is atomic).
- No cross-file transaction support, but order of operations is safe.
