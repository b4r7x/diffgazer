import { chmod, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  hashExecutionReceiptFingerprintSync,
  type SavedReview,
  SavedReviewSchema,
  TERMINAL_OUTCOMES,
} from "@diffgazer/core/schemas/review";
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
  return import("./store.js");
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

const limits = {
  maxInputTokens: 20_000,
  maxOutputTokens: 4_000,
  maxResponseBytes: 1_048_576,
  wallTimeMs: 120_000,
  maxRetries: 2,
  maxConcurrency: 1,
  maxCostUsd: 0.5,
} as const;

function makeExecutionReceipt(
  outcome: (typeof TERMINAL_OUTCOMES)[number],
  fingerprintSeed: string,
) {
  const receipt = {
    schemaVersion: 1 as const,
    executionFingerprint: "0".repeat(64),
    configurationId: `configuration-${fingerprintSeed}`,
    configurationRevision: 1,
    credentialReferenceIdentity: "c".repeat(64),
    installationId: null,
    productId: "openrouter" as const,
    transportFamily: "hosted-api" as const,
    modelId: "openai/gpt-4.1-mini",
    normalizedEndpoint: "https://openrouter.ai/api/v1",
    runtime: { identity: "diffgazer-server", version: "1.2.3" },
    structuredOutputSchemaSha256: "a".repeat(64),
    noticeVersion: 1,
    limits,
    attemptCount: 1,
    startedAt: "2026-07-31T10:00:00.000Z",
    finishedAt: "2026-07-31T10:00:05.000Z",
    usage: { inputTokens: 10, outputTokens: 5, totalTokens: 15 },
    usageAvailability: "reported" as const,
    outcome,
  };
  return {
    ...receipt,
    executionFingerprint: hashExecutionReceiptFingerprintSync({
      configurationId: receipt.configurationId,
      configurationRevision: receipt.configurationRevision,
      authentication: null,
      credentialReferenceIdentity: receipt.credentialReferenceIdentity,
      installationId: receipt.installationId,
      productId: receipt.productId,
      transportFamily: receipt.transportFamily,
      modelId: receipt.modelId,
      normalizedEndpoint: receipt.normalizedEndpoint,
      region: null,
      workspaceAccountReference: null,
      runtime: receipt.runtime,
      structuredOutputSchemaSha256: receipt.structuredOutputSchemaSha256,
      noticeVersion: receipt.noticeVersion,
      limits: receipt.limits,
    }),
  };
}

function makeReviewWithExecution(
  id: string,
  outcome: (typeof TERMINAL_OUTCOMES)[number],
  fingerprintSeed: string,
): SavedReview {
  const review = makeReview(id);
  const issue = review.result.issues[0];
  expect(issue).toBeDefined();
  if (!issue) {
    throw new Error("makeReview fixture must include at least one issue");
  }
  const receipt = makeExecutionReceipt(outcome, fingerprintSeed);
  return SavedReviewSchema.parse({
    ...review,
    metadata: {
      ...review.metadata,
      issueCount: outcome === "completed" ? 1 : 0,
      highCount: outcome === "completed" ? 1 : 0,
    },
    result: outcome === "completed" ? review.result : { issues: [] },
    execution: {
      receipt,
      result: { issues: outcome === "completed" ? [issue] : [] },
    },
  });
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

  it("persists and reloads the exact durable execution snapshot bytes", async () => {
    const { reviewStore } = await loadStore();
    const review = makeReviewWithExecution(REVIEW_ID, "completed", "a");

    const writeResult = await reviewStore.write(review);
    expect(writeResult.ok).toBe(true);

    const bytes = await readFile(join(reviewsDir, `${REVIEW_ID}.json`), "utf-8");
    const readResult = await reviewStore.read(REVIEW_ID);

    expect(readResult.ok).toBe(true);
    if (!readResult.ok) return;
    expect(bytes).toBe(`${JSON.stringify(readResult.value, null, 2)}\n`);
    expect(readResult.value.execution?.receipt.executionFingerprint).toBe(
      review.execution?.receipt.executionFingerprint,
    );
    expect(readResult.value.execution?.receipt.usage).toEqual({
      inputTokens: 10,
      outputTokens: 5,
      totalTokens: 15,
    });
  });

  it.each(
    TERMINAL_OUTCOMES.filter((outcome) => outcome !== "completed"),
  )("persists the exact %s terminal state without completed findings", async (outcome) => {
    const { reviewStore } = await loadStore();
    const review = makeReviewWithExecution(REVIEW_ID, outcome, outcome);

    const writeResult = await reviewStore.write(review);
    expect(writeResult.ok).toBe(true);

    const readResult = await reviewStore.read(REVIEW_ID);
    expect(readResult.ok).toBe(true);
    if (!readResult.ok) return;
    expect(readResult.value.execution?.receipt.outcome).toBe(outcome);
    expect(readResult.value.result.issues).toEqual([]);
    expect(readResult.value.execution?.result.issues).toEqual([]);
  });

  it("isolates execution fingerprints across persisted reviews", async () => {
    const { reviewStore } = await loadStore();
    const first = makeReviewWithExecution(REVIEW_ID, "completed", "a");
    const second = makeReviewWithExecution(
      "650e8400-e29b-41d4-a716-446655440001",
      "completed",
      "b",
    );

    await reviewStore.write(first);
    await reviewStore.write(second);

    const firstRead = await reviewStore.read(REVIEW_ID);
    const secondRead = await reviewStore.read("650e8400-e29b-41d4-a716-446655440001");

    expect(firstRead.ok && secondRead.ok).toBe(true);
    if (!firstRead.ok || !secondRead.ok) return;
    expect(firstRead.value.execution?.receipt.executionFingerprint).not.toBe(
      secondRead.value.execution?.receipt.executionFingerprint,
    );
  });

  it("rejects failed or partial execution state presented as completed findings", async () => {
    const { reviewStore } = await loadStore();
    const review = makeReviewWithExecution(REVIEW_ID, "transport-failed", "a");
    const invalid = {
      ...review,
      result: makeReview().result,
    };

    const result = await reviewStore.write(invalid);

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe("VALIDATION_ERROR");
  });

  it("redacts salvage diagnostics from detailed reads", async () => {
    const { reviewStore } = await loadStore();
    const review = makeReviewWithExecution(REVIEW_ID, "completed", "a");
    await reviewStore.write(review);

    const detailed = await reviewStore.readDetailed(REVIEW_ID);

    expect(detailed.ok).toBe(true);
    if (!detailed.ok) return;
    expect(detailed.value.diagnostics).toBeNull();
    expect(JSON.stringify(detailed.value.item)).not.toContain(tempHome);
  });
});
