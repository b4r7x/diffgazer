# TASK-012: Add "Discuss Review" Action

## Metadata

- **Priority**: P1 (Important - promotes standalone to linked)
- **Agent**: `react-component-architect`
- **Dependencies**: TASK-009, TASK-010, TASK-008
- **Package**: `apps/cli`

## Context

Read `/docs/ARCHITECTURE-SESSIONS-REVIEWS.md` Section 6 (Promoting standalone to linked).

When viewing a standalone review in history, the user should be able to press 'd' to "discuss" it, which:
1. Creates a new session with context about the review
2. Links the review to the session
3. Enters chat view

## Current State

### File: `apps/cli/src/app/app.tsx`

The review-history view shows reviews but has no "discuss" action:

```typescript
{view === "review-history" && (
  // Shows review list, can view details
  // No 'd' keybinding for discuss
)}
```

## Target State

### Update Key Handler for Review History

```typescript
// In useInput callback
if (input === "d" && view === "review-history" && currentReview) {
  // Only allow discuss for standalone reviews (no sessionId)
  if (currentReview.metadata.sessionId === null) {
    handleDiscussReview(currentReview);
  }
}

// Add this function
async function handleDiscussReview(review: SavedReview) {
  // Create new session with review context
  const title = `Discussion: Review ${review.metadata.id.slice(0, 8)}`;
  const newSession = await createSession(title);

  if (newSession) {
    // Link review to session
    await api().patch(`/reviews/${review.metadata.id}`, {
      sessionId: newSession.metadata.id,
    });

    // Add system message with review context
    await addMessage(
      "system",
      `This session was started to discuss a code review.\n\n` +
      `Review Summary: ${review.result.summary}\n\n` +
      `Issues Found: ${review.result.issues.length}\n` +
      `Critical: ${review.metadata.criticalCount}\n` +
      `Warnings: ${review.metadata.warningCount}\n\n` +
      `You can ask questions about the review findings.`
    );

    // Enter chat view
    setView("chat");
  }
}
```

### Update Review History UI

Show hint for discuss action when viewing a standalone review:

```typescript
{view === "review-history" && currentReview && (
  <Box marginTop={1}>
    <Text color="gray">
      Press 'b' to go back
      {currentReview.metadata.sessionId === null && (
        <Text>, 'd' to discuss this review</Text>
      )}
    </Text>
  </Box>
)}
```

### Add API Method for PATCH

If not already available, add to the api client usage:

```typescript
// In the component or hook
await api().request("PATCH", `/reviews/${reviewId}`, {
  body: JSON.stringify({ sessionId }),
  headers: { "Content-Type": "application/json" },
});

// Or if api() supports patch method
await api().patch(`/reviews/${reviewId}`, { sessionId });
```

## Files to Modify

1. `apps/cli/src/app/app.tsx`
   - Add 'd' keybinding in review-history view
   - Add `handleDiscussReview()` function
   - Update UI hints to show 'd' option

2. `packages/api/src/client.ts` (if needed)
   - Add `patch()` method if not exists

## Acceptance Criteria

- [ ] Press 'd' in review-history on standalone review starts discussion
- [ ] New session created with review context title
- [ ] Review's sessionId updated to new session
- [ ] System message added with review summary
- [ ] User enters chat view after setup
- [ ] 'd' does nothing for already-linked reviews
- [ ] UI shows 'd to discuss' hint for standalone reviews
- [ ] `pnpm build` passes
- [ ] `pnpm typecheck` passes

## Verification

```bash
cd /Users/voitz/Projects/stargazer
pnpm --filter @repo/cli build
pnpm typecheck

# Manual test:
# 1. Create a standalone review (from main menu, not in session)
# 2. Press 'h' to view review history
# 3. Select the review
# 4. Press 'd' to discuss
# 5. Should enter chat with system message about the review
# 6. The review should now have sessionId set
```

## Notes

- Only standalone reviews (sessionId === null) can be discussed.
- The system message provides context for the AI about what's being discussed.
- The session title is based on review ID for identification.
- This creates a new session specifically for discussing the review.
