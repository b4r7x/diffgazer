import { chmod, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { SavedReview } from "@diffgazer/core/schemas/review";
import { makeIssue } from "@diffgazer/core/testing/factories";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const REVIEW_ID = "550e8400-e29b-41d4-a716-446655440000";

let tempHome: string;
let reviewsDir: string;

beforeEach(async () => {
  tempHome = await mkdtemp(join(tmpdir(), "diffgazer-review-store-"));
  reviewsDir = join(tempHome, "triage-reviews");
  process.env.DIFFGAZER_HOME = tempHome;
  vi.resetModules();
});

afterEach(async () => {
  delete process.env.DIFFGAZER_HOME;
  await rm(tempHome, { recursive: true, force: true, maxRetries: 3, retryDelay: 20 });
});

async function loadStore() {
  return import("./review-store.js");
}

function makeReview(id: string = REVIEW_ID): SavedReview {
  return {
    metadata: {
      id,
      projectPath: "/projects/test",
      createdAt: "2025-01-01T00:00:00.000Z",
      mode: "unstaged",
      branch: "main",
      profile: null,
      lenses: ["correctness"],
      issueCount: 1,
      failedLensCount: 0,
      blockerCount: 0,
      highCount: 1,
      mediumCount: 0,
      lowCount: 0,
      nitCount: 0,
      fileCount: 1,
    },
    result: { issues: [makeIssue({ id: "i1", severity: "high", file: "a.ts" })] },
    gitContext: { branch: "main", commit: "abc123", fileCount: 1, additions: 1, deletions: 0 },
  };
}

async function writeRawReview(id: string, content: string): Promise<void> {
  await mkdir(reviewsDir, { recursive: true });
  await writeFile(join(reviewsDir, `${id}.json`), content, "utf-8");
}

describe("reviewStore", () => {
  it("writes and reads back a review as a real JSON file", async () => {
    const { reviewStore } = await loadStore();
    const review = makeReview();

    const writeResult = await reviewStore.write(review);

    expect(writeResult.ok).toBe(true);
    await expect(readFile(join(reviewsDir, `${REVIEW_ID}.json`), "utf-8")).resolves.toBe(
      `${JSON.stringify(review, null, 2)}\n`,
    );
    await expect(reviewStore.read(REVIEW_ID)).resolves.toEqual({ ok: true, value: review });
  });

  it("returns NOT_FOUND for a review that was never written", async () => {
    const { reviewStore } = await loadStore();

    const result = await reviewStore.read(REVIEW_ID);

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe("NOT_FOUND");
  });

  it("reports parse and validation failures from persisted files", async () => {
    const { reviewStore } = await loadStore();

    await writeRawReview(REVIEW_ID, "{invalid json");
    const corruptResult = await reviewStore.read(REVIEW_ID);
    expect(corruptResult.ok).toBe(false);
    if (!corruptResult.ok) expect(corruptResult.error.code).toBe("PARSE_ERROR");

    await writeRawReview(REVIEW_ID, JSON.stringify({ wrong: "shape" }));
    const invalidResult = await reviewStore.read(REVIEW_ID);
    expect(invalidResult.ok).toBe(false);
    if (!invalidResult.ok) expect(invalidResult.error.code).toBe("VALIDATION_ERROR");
  });

  it("rejects a non-uuid review id before touching the filesystem", async () => {
    const { reviewStore } = await loadStore();

    await expect(reviewStore.read("../escaped")).rejects.toThrow("Invalid review id");
    await expect(reviewStore.read("/tmp/escaped")).rejects.toThrow("Invalid review id");
  });

  it("keeps absolute daemon paths out of client-facing store error messages", async () => {
    const { reviewStore } = await loadStore();

    const missing = await reviewStore.read(REVIEW_ID);
    expect(missing.ok).toBe(false);
    if (!missing.ok) {
      expect(missing.error.code).toBe("NOT_FOUND");
      expect(missing.error.message).not.toContain(tempHome);
      expect(missing.error.message).not.toContain(reviewsDir);
    }

    await writeRawReview(REVIEW_ID, "{invalid json");
    const corrupt = await reviewStore.read(REVIEW_ID);
    expect(corrupt.ok).toBe(false);
    if (!corrupt.ok) expect(corrupt.error.message).not.toContain(tempHome);
  });

  it.skipIf(process.platform === "win32")(
    "scrubs the absolute path from a permission-denied write error",
    async () => {
      const { reviewStore } = await loadStore();
      await mkdir(reviewsDir, { recursive: true });
      await chmod(reviewsDir, 0o500);
      try {
        const result = await reviewStore.write(makeReview());

        expect(result.ok).toBe(false);
        if (!result.ok) {
          expect(result.error.code).toBe("PERMISSION_ERROR");
          expect(result.error.message).not.toContain(tempHome);
          expect(result.error.message).not.toContain(reviewsDir);
        }
      } finally {
        await chmod(reviewsDir, 0o700);
      }
    },
  );

  it.skipIf(process.platform === "win32")(
    "scrubs the absolute path from a permission-denied read error",
    async () => {
      const { reviewStore } = await loadStore();
      await reviewStore.write(makeReview());
      const filePath = join(reviewsDir, `${REVIEW_ID}.json`);
      await chmod(filePath, 0o200);
      try {
        const result = await reviewStore.read(REVIEW_ID);

        expect(result.ok).toBe(false);
        if (!result.ok) {
          expect(result.error.code).toBe("PERMISSION_ERROR");
          expect(result.error.message).not.toContain(tempHome);
          expect(result.error.message).not.toContain(reviewsDir);
        }
      } finally {
        await chmod(filePath, 0o600);
      }
    },
  );

  it("returns WRITE_ERROR when the reviews directory cannot be created", async () => {
    const blockedPath = join(tempHome, "blocked");
    await writeFile(blockedPath, "not a directory", "utf-8");
    process.env.DIFFGAZER_HOME = join(blockedPath, "home");
    vi.resetModules();
    const { reviewStore } = await loadStore();

    const result = await reviewStore.write(makeReview());

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe("WRITE_ERROR");
  });
});
