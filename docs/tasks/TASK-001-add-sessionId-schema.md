# TASK-001: Add sessionId to ReviewHistoryMetadata

## Metadata

- **Priority**: P0 (Foundation - must be done first)
- **Agent**: `typescript-pro`
- **Dependencies**: None
- **Package**: `packages/schemas`

## Context

Read `/docs/ARCHITECTURE-SESSIONS-REVIEWS.md` Section 6 (Two Types of Reviews).

Reviews can be **linked** (part of a session) or **standalone** (independent). The `sessionId` field distinguishes between them:
- `sessionId: string` = Linked review (belongs to a session)
- `sessionId: null` = Standalone review (no session)

## Current State

File: `packages/schemas/src/review-history.ts`

```typescript
export const ReviewHistoryMetadataSchema = z.object({
  id: z.string().uuid(),
  projectPath: z.string(),
  createdAt: z.string().datetime(),
  staged: z.boolean(),
  branch: z.string().nullable(),
  overallScore: z.number().min(0).max(10).nullable(),
  issueCount: z.number().int().nonnegative(),
  criticalCount: z.number().int().nonnegative(),
  warningCount: z.number().int().nonnegative(),
});
```

## Target State

```typescript
export const ReviewHistoryMetadataSchema = z.object({
  id: z.string().uuid(),
  projectPath: z.string(),
  createdAt: z.string().datetime(),
  staged: z.boolean(),
  branch: z.string().nullable(),
  overallScore: z.number().min(0).max(10).nullable(),
  issueCount: z.number().int().nonnegative(),
  criticalCount: z.number().int().nonnegative(),
  warningCount: z.number().int().nonnegative(),
  sessionId: z.string().uuid().nullable(),  // NEW: null = standalone, string = linked
});
```

## Files to Modify

1. `packages/schemas/src/review-history.ts`
   - Add `sessionId: z.string().uuid().nullable()` to `ReviewHistoryMetadataSchema`

## Acceptance Criteria

- [ ] `sessionId` field added to `ReviewHistoryMetadataSchema`
- [ ] Field is `z.string().uuid().nullable()` (accepts UUID or null)
- [ ] `ReviewHistoryMetadata` type is automatically updated (via `z.infer`)
- [ ] `pnpm build` passes
- [ ] `pnpm typecheck` passes

## Verification

```bash
cd /Users/voitz/Projects/stargazer
pnpm --filter @repo/schemas build
pnpm typecheck
```

## Notes

- This is a schema-only change. Storage and API will be updated in later tasks.
- Keep the field at the end of the object for minimal diff.
- Do NOT add any default value - let the storage layer handle that.
