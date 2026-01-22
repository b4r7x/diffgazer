# TASK-016: Add Storage Integration Tests

## Metadata

- **Priority**: P2 (Enhancement - validates persistence)
- **Agent**: `test-automator`
- **Dependencies**: TASK-014, TASK-015 (test infra and schema tests)
- **Package**: `packages/core`

## Context

Storage tests verify that sessions and reviews can be created, read, updated, and deleted correctly. These are integration tests that use the real file system (with temp directories).

## Current State

No tests exist for storage functions.

## Target State

### New File: `packages/core/src/storage/sessions.test.ts`

```typescript
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  createSession,
  addMessage,
  listSessions,
  getLastSession,
  deleteSession,
  sessionStore,
} from "./sessions.js";

// Override storage path for tests
let testDir: string;

beforeEach(async () => {
  testDir = await mkdtemp(join(tmpdir(), "stargazer-test-"));
  // Note: You may need to mock or configure the storage path
  // This depends on how paths.ts is implemented
});

afterEach(async () => {
  await rm(testDir, { recursive: true, force: true });
});

describe("createSession", () => {
  it("creates session with correct metadata", async () => {
    const result = await createSession("/test/project", "Test Session");

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.metadata.projectPath).toBe("/test/project");
      expect(result.value.metadata.title).toBe("Test Session");
      expect(result.value.metadata.messageCount).toBe(0);
      expect(result.value.metadata.relatedReviewIds).toEqual([]);
      expect(result.value.messages).toEqual([]);
    }
  });

  it("creates session without title", async () => {
    const result = await createSession("/test/project");

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.metadata.title).toBeUndefined();
    }
  });
});

describe("addMessage", () => {
  it("adds message and updates metadata", async () => {
    const createResult = await createSession("/test/project");
    expect(createResult.ok).toBe(true);
    if (!createResult.ok) return;

    const sessionId = createResult.value.metadata.id;
    const messageResult = await addMessage(sessionId, "user", "Hello");

    expect(messageResult.ok).toBe(true);
    if (messageResult.ok) {
      expect(messageResult.value.role).toBe("user");
      expect(messageResult.value.content).toBe("Hello");
    }

    // Verify session was updated
    const readResult = await sessionStore.read(sessionId);
    expect(readResult.ok).toBe(true);
    if (readResult.ok) {
      expect(readResult.value.metadata.messageCount).toBe(1);
      expect(readResult.value.messages).toHaveLength(1);
    }
  });
});

describe("listSessions", () => {
  it("lists sessions for project", async () => {
    await createSession("/project/a", "Session A");
    await createSession("/project/b", "Session B");
    await createSession("/project/a", "Session A2");

    const result = await listSessions("/project/a");
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value).toHaveLength(2);
    }
  });

  it("returns empty array for no sessions", async () => {
    const result = await listSessions("/nonexistent");
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value).toEqual([]);
    }
  });
});

describe("deleteSession", () => {
  it("deletes existing session", async () => {
    const createResult = await createSession("/test/project");
    expect(createResult.ok).toBe(true);
    if (!createResult.ok) return;

    const sessionId = createResult.value.metadata.id;
    const deleteResult = await deleteSession(sessionId);

    expect(deleteResult.ok).toBe(true);
    if (deleteResult.ok) {
      expect(deleteResult.value).toBe(true);
    }

    // Verify session is gone
    const readResult = await sessionStore.read(sessionId);
    expect(readResult.ok).toBe(false);
  });
});
```

### New File: `packages/core/src/storage/review-history.test.ts`

```typescript
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  saveReview,
  listReviews,
  deleteReview,
  reviewStore,
} from "./review-history.js";
import type { ReviewResult, ReviewGitContext } from "@repo/schemas/review";

let testDir: string;

beforeEach(async () => {
  testDir = await mkdtemp(join(tmpdir(), "stargazer-test-"));
});

afterEach(async () => {
  await rm(testDir, { recursive: true, force: true });
});

describe("saveReview", () => {
  const mockResult: ReviewResult = {
    summary: "Test review",
    issues: [
      {
        severity: "warning",
        category: "style",
        file: "test.ts",
        line: 10,
        title: "Test issue",
        description: "Test description",
        suggestion: null,
      },
    ],
    overallScore: 8,
  };

  const mockGitContext: ReviewGitContext = {
    branch: "main",
    fileCount: 1,
  };

  it("saves standalone review (no sessionId)", async () => {
    const result = await saveReview(
      "/test/project",
      true,
      mockResult,
      mockGitContext
    );

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.metadata.projectPath).toBe("/test/project");
      expect(result.value.metadata.staged).toBe(true);
      expect(result.value.metadata.sessionId).toBeNull();
      expect(result.value.metadata.issueCount).toBe(1);
      expect(result.value.metadata.warningCount).toBe(1);
      expect(result.value.metadata.criticalCount).toBe(0);
    }
  });

  it("saves linked review (with sessionId)", async () => {
    const sessionId = "123e4567-e89b-12d3-a456-426614174000";
    const result = await saveReview(
      "/test/project",
      true,
      mockResult,
      mockGitContext,
      sessionId
    );

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.metadata.sessionId).toBe(sessionId);
    }
  });

  it("counts issues by severity", async () => {
    const resultWithCritical: ReviewResult = {
      summary: "Test",
      issues: [
        { severity: "critical", category: "security", file: null, line: null, title: "Critical", description: "Desc", suggestion: null },
        { severity: "warning", category: "style", file: null, line: null, title: "Warning", description: "Desc", suggestion: null },
        { severity: "suggestion", category: "style", file: null, line: null, title: "Suggestion", description: "Desc", suggestion: null },
      ],
      overallScore: null,
    };

    const result = await saveReview("/test", true, resultWithCritical, mockGitContext);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.metadata.issueCount).toBe(3);
      expect(result.value.metadata.criticalCount).toBe(1);
      expect(result.value.metadata.warningCount).toBe(1);
    }
  });
});

describe("listReviews", () => {
  it("lists reviews for project", async () => {
    const result: ReviewResult = { summary: "Test", issues: [], overallScore: null };
    const gitContext: ReviewGitContext = { branch: null, fileCount: 0 };

    await saveReview("/project/a", true, result, gitContext);
    await saveReview("/project/b", true, result, gitContext);
    await saveReview("/project/a", false, result, gitContext);

    const listResult = await listReviews("/project/a");
    expect(listResult.ok).toBe(true);
    if (listResult.ok) {
      expect(listResult.value).toHaveLength(2);
    }
  });
});

describe("deleteReview", () => {
  it("deletes existing review", async () => {
    const result: ReviewResult = { summary: "Test", issues: [], overallScore: null };
    const gitContext: ReviewGitContext = { branch: null, fileCount: 0 };

    const saveResult = await saveReview("/test", true, result, gitContext);
    expect(saveResult.ok).toBe(true);
    if (!saveResult.ok) return;

    const reviewId = saveResult.value.metadata.id;
    const deleteResult = await deleteReview(reviewId);

    expect(deleteResult.ok).toBe(true);

    const readResult = await reviewStore.read(reviewId);
    expect(readResult.ok).toBe(false);
  });
});
```

## Files to Create

1. `packages/core/src/storage/sessions.test.ts`
   - Session storage tests

2. `packages/core/src/storage/review-history.test.ts`
   - Review storage tests

## Acceptance Criteria

- [ ] Session CRUD tests pass
- [ ] Review CRUD tests pass
- [ ] Tests verify metadata updates (messageCount, updatedAt)
- [ ] Tests verify issue counting logic
- [ ] Tests verify sessionId handling (null vs UUID)
- [ ] Tests clean up temp files after each test
- [ ] `pnpm --filter @repo/core test` passes
- [ ] `pnpm test` from root passes

## Verification

```bash
cd /Users/voitz/Projects/stargazer
pnpm --filter @repo/core test
pnpm test
```

## Notes

- These are integration tests using real file system (temp dirs).
- May need to mock/configure storage path - check how paths.ts works.
- Keep tests independent - each test creates its own data.
- Clean up temp directories after tests.
- If path mocking is complex, simplify tests to focus on logic.
