# TASK-015: Add Schema Unit Tests

## Metadata

- **Priority**: P2 (Enhancement - validates schema logic)
- **Agent**: `test-automator`
- **Dependencies**: TASK-014 (test infrastructure exists)
- **Package**: `packages/schemas`

## Context

Zod schemas are the foundation of data validation. Tests ensure:
- Schemas accept valid data
- Schemas reject invalid data
- Type inference works correctly

## Current State

No tests exist for schemas.

## Target State

### New File: `packages/schemas/src/session.test.ts`

```typescript
import { describe, it, expect } from "vitest";
import {
  SessionMetadataSchema,
  SessionMessageSchema,
  SessionSchema,
  CreateSessionRequestSchema,
  AddMessageRequestSchema,
} from "./session.js";

describe("SessionMessageSchema", () => {
  it("accepts valid message", () => {
    const message = {
      id: "123e4567-e89b-12d3-a456-426614174000",
      role: "user",
      content: "Hello",
      createdAt: "2024-01-01T00:00:00.000Z",
    };
    expect(SessionMessageSchema.safeParse(message).success).toBe(true);
  });

  it("rejects invalid role", () => {
    const message = {
      id: "123e4567-e89b-12d3-a456-426614174000",
      role: "invalid",
      content: "Hello",
      createdAt: "2024-01-01T00:00:00.000Z",
    };
    expect(SessionMessageSchema.safeParse(message).success).toBe(false);
  });

  it("rejects invalid UUID", () => {
    const message = {
      id: "not-a-uuid",
      role: "user",
      content: "Hello",
      createdAt: "2024-01-01T00:00:00.000Z",
    };
    expect(SessionMessageSchema.safeParse(message).success).toBe(false);
  });
});

describe("SessionMetadataSchema", () => {
  it("accepts valid metadata", () => {
    const metadata = {
      id: "123e4567-e89b-12d3-a456-426614174000",
      projectPath: "/path/to/project",
      createdAt: "2024-01-01T00:00:00.000Z",
      updatedAt: "2024-01-01T00:00:00.000Z",
      messageCount: 0,
      relatedReviewIds: [],
    };
    expect(SessionMetadataSchema.safeParse(metadata).success).toBe(true);
  });

  it("accepts metadata without relatedReviewIds (uses default)", () => {
    const metadata = {
      id: "123e4567-e89b-12d3-a456-426614174000",
      projectPath: "/path/to/project",
      createdAt: "2024-01-01T00:00:00.000Z",
      updatedAt: "2024-01-01T00:00:00.000Z",
      messageCount: 0,
    };
    const result = SessionMetadataSchema.safeParse(metadata);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.relatedReviewIds).toEqual([]);
    }
  });

  it("rejects negative messageCount", () => {
    const metadata = {
      id: "123e4567-e89b-12d3-a456-426614174000",
      projectPath: "/path/to/project",
      createdAt: "2024-01-01T00:00:00.000Z",
      updatedAt: "2024-01-01T00:00:00.000Z",
      messageCount: -1,
    };
    expect(SessionMetadataSchema.safeParse(metadata).success).toBe(false);
  });
});

describe("CreateSessionRequestSchema", () => {
  it("accepts valid request", () => {
    const request = { projectPath: "/path/to/project" };
    expect(CreateSessionRequestSchema.safeParse(request).success).toBe(true);
  });

  it("accepts request with title", () => {
    const request = { projectPath: "/path", title: "My Session" };
    expect(CreateSessionRequestSchema.safeParse(request).success).toBe(true);
  });
});
```

### New File: `packages/schemas/src/review-history.test.ts`

```typescript
import { describe, it, expect } from "vitest";
import {
  ReviewHistoryMetadataSchema,
  SavedReviewSchema,
} from "./review-history.js";

describe("ReviewHistoryMetadataSchema", () => {
  const validMetadata = {
    id: "123e4567-e89b-12d3-a456-426614174000",
    projectPath: "/path/to/project",
    createdAt: "2024-01-01T00:00:00.000Z",
    staged: true,
    branch: "main",
    overallScore: 8,
    issueCount: 5,
    criticalCount: 1,
    warningCount: 2,
    sessionId: null,
  };

  it("accepts valid metadata with null sessionId (standalone)", () => {
    expect(ReviewHistoryMetadataSchema.safeParse(validMetadata).success).toBe(true);
  });

  it("accepts valid metadata with UUID sessionId (linked)", () => {
    const linked = {
      ...validMetadata,
      sessionId: "223e4567-e89b-12d3-a456-426614174000",
    };
    expect(ReviewHistoryMetadataSchema.safeParse(linked).success).toBe(true);
  });

  it("rejects invalid sessionId", () => {
    const invalid = { ...validMetadata, sessionId: "not-a-uuid" };
    expect(ReviewHistoryMetadataSchema.safeParse(invalid).success).toBe(false);
  });

  it("rejects score out of range", () => {
    const invalid = { ...validMetadata, overallScore: 11 };
    expect(ReviewHistoryMetadataSchema.safeParse(invalid).success).toBe(false);
  });

  it("accepts null overallScore", () => {
    const noScore = { ...validMetadata, overallScore: null };
    expect(ReviewHistoryMetadataSchema.safeParse(noScore).success).toBe(true);
  });
});

describe("SavedReviewSchema", () => {
  it("accepts complete saved review", () => {
    const review = {
      metadata: {
        id: "123e4567-e89b-12d3-a456-426614174000",
        projectPath: "/path",
        createdAt: "2024-01-01T00:00:00.000Z",
        staged: true,
        branch: null,
        overallScore: null,
        issueCount: 0,
        criticalCount: 0,
        warningCount: 0,
        sessionId: null,
      },
      result: {
        summary: "No issues found",
        issues: [],
        overallScore: null,
      },
      gitContext: {
        branch: null,
        fileCount: 1,
      },
    };
    expect(SavedReviewSchema.safeParse(review).success).toBe(true);
  });
});
```

## Files to Create

1. `packages/schemas/src/session.test.ts`
   - Session schema tests

2. `packages/schemas/src/review-history.test.ts`
   - Review history schema tests

## Acceptance Criteria

- [ ] Session schema tests pass
- [ ] Review schema tests pass
- [ ] Tests cover valid and invalid cases
- [ ] Tests verify default values (relatedReviewIds)
- [ ] Tests verify nullable fields (sessionId, branch, score)
- [ ] `pnpm --filter @repo/schemas test` passes
- [ ] `pnpm test` from root passes

## Verification

```bash
cd /Users/voitz/Projects/stargazer
pnpm --filter @repo/schemas test
pnpm test
```

## Notes

- Focus on schema validation, not TypeScript types (Zod handles both).
- Test edge cases: nulls, defaults, boundaries (0-10 for score).
- Keep tests simple and focused on one thing each.
