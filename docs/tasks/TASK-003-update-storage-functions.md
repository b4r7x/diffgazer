# TASK-003: Update Storage Functions for New Schema Fields

## Metadata

- **Priority**: P0 (Critical - needed for linking)
- **Agent**: `backend-developer`
- **Dependencies**: TASK-001, TASK-002
- **Package**: `packages/core`

## Context

Read `/docs/ARCHITECTURE-SESSIONS-REVIEWS.md` Sections 3-4 (Sessions and Reviews).

After TASK-001 and TASK-002 added `sessionId` and `relatedReviewIds` to the schemas, the storage functions need to handle these fields correctly.

## Current State

### File: `packages/core/src/storage/sessions.ts`

```typescript
export async function createSession(
  projectPath: string,
  title?: string
): Promise<Result<Session, StoreError>> {
  const now = new Date().toISOString();
  const session: Session = {
    metadata: {
      id: randomUUID(),
      projectPath,
      title,
      createdAt: now,
      updatedAt: now,
      messageCount: 0,
      // NOTE: relatedReviewIds NOT included
    },
    messages: [],
  };
  return sessionStore.write(session);
}
```

### File: `packages/core/src/storage/review-history.ts`

```typescript
export async function saveReview(
  projectPath: string,
  staged: boolean,
  result: ReviewResult,
  gitContext: ReviewGitContext
): Promise<Result<SavedReview, StoreError>> {
  const { criticalCount, warningCount } = countIssuesBySeverity(result.issues);
  const review: SavedReview = {
    metadata: {
      id: randomUUID(),
      projectPath,
      createdAt: new Date().toISOString(),
      staged,
      branch: gitContext.branch,
      overallScore: result.overallScore ?? null,
      issueCount: result.issues.length,
      criticalCount,
      warningCount,
      // NOTE: sessionId NOT included
    },
    result,
    gitContext,
  };
  return reviewStore.write(review);
}
```

## Target State

### File: `packages/core/src/storage/sessions.ts`

```typescript
export async function createSession(
  projectPath: string,
  title?: string
): Promise<Result<Session, StoreError>> {
  const now = new Date().toISOString();
  const session: Session = {
    metadata: {
      id: randomUUID(),
      projectPath,
      title,
      createdAt: now,
      updatedAt: now,
      messageCount: 0,
      relatedReviewIds: [],  // NEW: empty array for new sessions
    },
    messages: [],
  };
  return sessionStore.write(session);
}
```

### File: `packages/core/src/storage/review-history.ts`

```typescript
export async function saveReview(
  projectPath: string,
  staged: boolean,
  result: ReviewResult,
  gitContext: ReviewGitContext,
  sessionId: string | null = null  // NEW: optional sessionId parameter
): Promise<Result<SavedReview, StoreError>> {
  const { criticalCount, warningCount } = countIssuesBySeverity(result.issues);
  const review: SavedReview = {
    metadata: {
      id: randomUUID(),
      projectPath,
      createdAt: new Date().toISOString(),
      staged,
      branch: gitContext.branch,
      overallScore: result.overallScore ?? null,
      issueCount: result.issues.length,
      criticalCount,
      warningCount,
      sessionId,  // NEW: include sessionId (null for standalone)
    },
    result,
    gitContext,
  };
  return reviewStore.write(review);
}
```

## Files to Modify

1. `packages/core/src/storage/sessions.ts`
   - Add `relatedReviewIds: []` to session metadata in `createSession()`

2. `packages/core/src/storage/review-history.ts`
   - Add `sessionId` parameter to `saveReview()` (default to `null`)
   - Include `sessionId` in review metadata

## Acceptance Criteria

- [ ] `createSession()` includes `relatedReviewIds: []` in metadata
- [ ] `saveReview()` accepts optional `sessionId` parameter (default `null`)
- [ ] `saveReview()` includes `sessionId` in review metadata
- [ ] Existing callers of `saveReview()` still work (backward compatible)
- [ ] `pnpm build` passes
- [ ] `pnpm typecheck` passes

## Verification

```bash
cd /Users/voitz/Projects/stargazer
pnpm --filter @repo/core build
pnpm typecheck
```

## Notes

- `sessionId` defaults to `null` for backward compatibility (existing callers don't need changes yet).
- TASK-011 will update the server to actually pass `sessionId` when in a session.
- Keep the function signature change minimal - just add one optional parameter.
