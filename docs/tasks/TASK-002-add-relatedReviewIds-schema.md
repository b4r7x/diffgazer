# TASK-002: Add relatedReviewIds to SessionMetadata

## Metadata

- **Priority**: P0 (Foundation - must be done first)
- **Agent**: `typescript-pro`
- **Dependencies**: None (can be done in parallel with TASK-001)
- **Package**: `packages/schemas`

## Context

Read `/docs/ARCHITECTURE-SESSIONS-REVIEWS.md` Section 6 (Two Types of Reviews).

Sessions need to track which reviews were created during the conversation. The `relatedReviewIds` field stores UUIDs of linked reviews, enabling:
- "Show all reviews from this session"
- Bidirectional navigation (Session <-> Review)

## Current State

File: `packages/schemas/src/session.ts`

```typescript
export const SessionMetadataSchema = z.object({
  id: z.string().uuid(),
  projectPath: z.string(),
  title: z.string().optional(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  messageCount: z.number().int().nonnegative(),
});
```

## Target State

```typescript
export const SessionMetadataSchema = z.object({
  id: z.string().uuid(),
  projectPath: z.string(),
  title: z.string().optional(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  messageCount: z.number().int().nonnegative(),
  relatedReviewIds: z.array(z.string().uuid()).default([]),  // NEW: reviews linked to this session
});
```

## Files to Modify

1. `packages/schemas/src/session.ts`
   - Add `relatedReviewIds: z.array(z.string().uuid()).default([])` to `SessionMetadataSchema`

## Acceptance Criteria

- [ ] `relatedReviewIds` field added to `SessionMetadataSchema`
- [ ] Field is `z.array(z.string().uuid()).default([])` (array of UUIDs, defaults to empty)
- [ ] `SessionMetadata` type is automatically updated (via `z.infer`)
- [ ] `pnpm build` passes
- [ ] `pnpm typecheck` passes

## Verification

```bash
cd /Users/voitz/Projects/stargazer
pnpm --filter @repo/schemas build
pnpm typecheck
```

## Notes

- Use `.default([])` so existing sessions without this field parse correctly.
- This is a schema-only change. Storage will handle migrations in TASK-003.
- Keep the field at the end of the object for minimal diff.
