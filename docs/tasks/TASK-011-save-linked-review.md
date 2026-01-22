# TASK-011: Update saveReview for Linked Reviews

## Metadata

- **Priority**: P1 (Important - enables linked review creation)
- **Agent**: `backend-developer`
- **Dependencies**: TASK-003, TASK-010
- **Package**: `apps/server`

## Context

Read `/docs/ARCHITECTURE-SESSIONS-REVIEWS.md` Section 6 (Starting a linked review).

When a review is triggered from within a session, it should automatically be linked. The server needs to:
1. Accept sessionId parameter
2. Save review with sessionId
3. Update session's relatedReviewIds

## Current State

### File: `apps/server/src/api/routes/review.ts`

```typescript
// Review is saved after streaming completes
gitService.getStatus().then((status) => {
  saveReview(process.cwd(), staged, result, {
    branch: status.value?.branch ?? null,
    fileCount,
  });
}).catch(() => {});
```

The endpoint doesn't accept or pass sessionId.

## Target State

### Update: `apps/server/src/api/routes/review.ts`

Add sessionId query parameter:

```typescript
import { addReviewToSession } from "@repo/core/storage/sessions";

review.get("/stream", async (c) => {
  const staged = c.req.query("staged") === "true";
  const sessionId = c.req.query("sessionId") || null;  // NEW: optional sessionId

  // ... existing code ...

  return streamSSE(c, async (stream) => {
    await reviewDiff(client, staged, {
      onChunk: async (chunk) => {
        // ... existing code ...
      },
      onComplete: async (content) => {
        let result: ReviewResult = { summary: content, issues: [] };
        // ... parse result ...

        // Save review with sessionId
        const saveResult = await saveReview(
          process.cwd(),
          staged,
          result,
          { branch: status?.branch ?? null, fileCount },
          sessionId  // NEW: pass sessionId
        );

        // If linked and save succeeded, update session
        if (saveResult.ok && sessionId) {
          await addReviewToSession(sessionId, saveResult.value.metadata.id);
        }

        await stream.writeSSE({
          event: "complete",
          data: JSON.stringify({
            type: "complete",
            result,
            reviewId: saveResult.ok ? saveResult.value.metadata.id : null,  // NEW: return reviewId
          }),
        });
      },
      onError: async (error) => {
        // ... existing code ...
      },
    });
  });
});
```

### Update SSE Complete Event Schema

File: `packages/schemas/src/review.ts`

Add `reviewId` to complete event:

```typescript
// In ReviewStreamEventSchema
z.object({
  type: z.literal("complete"),
  result: ReviewResultSchema,
  parseWarning: z.string().optional(),
  reviewId: z.string().uuid().nullable().optional(),  // NEW
}),
```

## Files to Modify

1. `apps/server/src/api/routes/review.ts`
   - Add `sessionId` query parameter
   - Pass `sessionId` to `saveReview()`
   - Call `addReviewToSession()` if linked
   - Include `reviewId` in complete event

2. `packages/schemas/src/review.ts`
   - Add `reviewId` to complete event schema (optional)

## Acceptance Criteria

- [ ] `/review/stream` accepts optional `sessionId` query param
- [ ] Review saved with `sessionId` when provided
- [ ] Session's `relatedReviewIds` updated when sessionId provided
- [ ] Complete event includes `reviewId`
- [ ] Works without sessionId (standalone review)
- [ ] `pnpm build` passes
- [ ] `pnpm typecheck` passes

## Verification

```bash
cd /Users/voitz/Projects/stargazer
pnpm build
pnpm typecheck

# Manual test:
# 1. Create a session
# 2. Call /review/stream?staged=true&sessionId={session-id}
# 3. After complete, GET /sessions/{id} should have reviewId in relatedReviewIds
# 4. GET /reviews/{reviewId} should have sessionId set
```

## Notes

- The CLI will need to pass `sessionId` when in a chat session (handled in TASK-008).
- Keep backward compatibility - sessionId is optional.
- Error in addReviewToSession should not fail the review - it's already saved.
