import { chmod, mkdir, mkdtemp, readFile, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { sha256CanonicalJsonSync } from "@diffgazer/core/json";
import {
  hashExecutionReceiptFingerprintSync,
  type SavedReview,
  SavedReviewSchema,
  TERMINAL_OUTCOMES,
} from "@diffgazer/core/schemas/review";
import { makeIssue } from "@diffgazer/core/testing/factories";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { assertTempHome } from "../../../shared/lib/testing/temp-home.js";
import { drainReviewWrites } from "../testing/storage-drain.js";

const REVIEW_ID = "550e8400-e29b-41d4-a716-446655440000";

let tempHome: string;
let reviewsDir: string;

beforeEach(async () => {
  tempHome = await mkdtemp(join(tmpdir(), "diffgazer-review-store-"));
  assertTempHome(tempHome);
  reviewsDir = join(tempHome, "triage-reviews");
  process.env.DIFFGAZER_HOME = tempHome;
  vi.resetModules();
});

// Settle the fire-and-forget migration writes first, then remove the temp home, and only
// then drop DIFFGAZER_HOME: `paths.ts` re-reads the variable per call, so restoring it
// while a write is still pending re-points that write at the real ~/.diffgazer.
afterEach(async () => {
  await drainReviewWrites(tempHome);
  await rm(tempHome, { recursive: true, force: true });
  delete process.env.DIFFGAZER_HOME;
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

// Records written while the output-token budget still existed hashed both the
// receipt identity and its durable snapshot over limits that carried it, so a
// fossil fixture has to hash the legacy domain the writer used rather than the
// current fingerprint-input schema.
function makeFossilSnapshot(snapshot: NonNullable<SavedReview["executionSnapshot"]>) {
  const limits = { ...snapshot.receipt.limits, maxOutputTokens: 8192 };
  const executionFingerprint = sha256CanonicalJsonSync({
    authentication: null,
    configurationId: snapshot.receipt.configurationId,
    configurationRevision: snapshot.receipt.configurationRevision,
    credentialReferenceIdentity: snapshot.receipt.credentialReferenceIdentity,
    installationId: snapshot.receipt.installationId,
    productId: snapshot.receipt.productId,
    transportFamily: snapshot.receipt.transportFamily,
    modelId: snapshot.receipt.modelId,
    normalizedEndpoint: snapshot.receipt.normalizedEndpoint,
    region: null,
    workspaceAccountReference: null,
    runtime: snapshot.receipt.runtime,
    structuredOutputSchemaSha256: snapshot.receipt.structuredOutputSchemaSha256,
    noticeVersion: snapshot.receipt.noticeVersion,
    limits,
  });
  return {
    ...snapshot,
    executionFingerprint,
    receipt: { ...snapshot.receipt, limits, executionFingerprint },
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

  it("tightens a reviews directory an earlier build left group and other readable", async () => {
    const { reviewStore } = await loadStore();
    await mkdir(reviewsDir, { recursive: true });
    await chmod(reviewsDir, 0o755);

    const writeResult = await reviewStore.write(makeReview());

    expect(writeResult.ok).toBe(true);
    expect((await stat(reviewsDir)).mode & 0o777).toBe(0o700);
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

  it.skipIf(process.platform === "freebsd")(
    "reports filesystem read failures separately from malformed JSON",
    async () => {
      const { reviewStore } = await loadStore();
      await mkdir(join(reviewsDir, `${REVIEW_ID}.json`), { recursive: true });

      const result = await reviewStore.read(REVIEW_ID);

      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.error.code).toBe("READ_ERROR");
    },
  );

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
    const { execution: _runtimeView, ...durable } = readResult.value;
    // The receipt lands once, as executionSnapshot; the runtime execution view is
    // derived on read and must never double the record on disk.
    expect(JSON.parse(bytes)).not.toHaveProperty("execution");
    expect(bytes).toBe(`${JSON.stringify(durable, null, 2)}\n`);
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

  it("recovers the receipt of a fossil review fingerprinted over the retired output-token budget", async () => {
    const { reviewStore } = await loadStore();
    const review = makeReviewWithExecution(REVIEW_ID, "completed", "a");
    const snapshot = review.executionSnapshot;
    expect(snapshot).toBeDefined();
    if (!snapshot) return;
    const { execution: _runtimeView, ...durable } = review;
    await writeRawReview(
      REVIEW_ID,
      JSON.stringify({
        ...durable,
        executionSnapshot: makeFossilSnapshot(snapshot),
      }),
    );

    const detailed = await reviewStore.readDetailed(REVIEW_ID);

    expect(detailed.ok).toBe(true);
    if (!detailed.ok) return;
    expect(detailed.value.salvaged).toBe(false);
    expect(detailed.value.item.execution?.receipt.outcome).toBe("completed");
    expect(detailed.value.item.execution?.receipt.limits).not.toHaveProperty("maxOutputTokens");
    expect(detailed.value.item.execution?.receipt.executionFingerprint).toBe(
      snapshot.receipt.executionFingerprint,
    );
    expect(detailed.value.item.executionSnapshot?.executionFingerprint).toBe(
      snapshot.executionFingerprint,
    );
  });

  it("leaves a fossil review whose receipt was hand-edited to the salvage", async () => {
    const { reviewStore } = await loadStore();
    const review = makeReviewWithExecution(REVIEW_ID, "completed", "a");
    const snapshot = review.executionSnapshot;
    expect(snapshot).toBeDefined();
    if (!snapshot) return;
    const { execution: _runtimeView, ...durable } = review;
    const fossil = makeFossilSnapshot(snapshot);
    await writeRawReview(
      REVIEW_ID,
      JSON.stringify({
        ...durable,
        executionSnapshot: { ...fossil, receipt: { ...fossil.receipt, modelId: "openai/gpt-4.1" } },
      }),
    );

    const detailed = await reviewStore.readDetailed(REVIEW_ID);

    expect(detailed.ok).toBe(true);
    if (!detailed.ok) return;
    expect(detailed.value.salvaged).toBe(true);
    expect(detailed.value.diagnostics?.droppedExecution).toBe(true);
    expect(detailed.value.item.execution).toBeUndefined();
  });

  it("keeps a saved review readable when its receipt names a removed provider", async () => {
    // A run recorded by a build that still shipped groq: the fingerprint is
    // recomputed over the retired identity, so the product enum rejecting an
    // unknown "groq" is the only reason the receipt no longer parses — and the
    // review's findings must survive the retirement.
    const { reviewStore } = await loadStore();
    const review = makeReviewWithExecution(REVIEW_ID, "completed", "a");
    const snapshot = review.executionSnapshot;
    expect(snapshot).toBeDefined();
    if (!snapshot) return;
    const { execution: _runtimeView, ...durable } = review;
    const retired = {
      ...snapshot.receipt,
      productId: "groq",
      modelId: "llama-3.3-70b",
      normalizedEndpoint: "https://api.groq.com/openai/v1",
    };
    const executionFingerprint = sha256CanonicalJsonSync({
      authentication: null,
      configurationId: retired.configurationId,
      configurationRevision: retired.configurationRevision,
      credentialReferenceIdentity: retired.credentialReferenceIdentity ?? null,
      installationId: retired.installationId ?? null,
      productId: retired.productId,
      transportFamily: retired.transportFamily,
      modelId: retired.modelId,
      normalizedEndpoint: retired.normalizedEndpoint,
      region: null,
      workspaceAccountReference: null,
      runtime: retired.runtime ?? null,
      structuredOutputSchemaSha256: retired.structuredOutputSchemaSha256,
      noticeVersion: retired.noticeVersion,
      limits: retired.limits,
    });
    await writeRawReview(
      REVIEW_ID,
      JSON.stringify({
        ...durable,
        executionSnapshot: {
          ...snapshot,
          executionFingerprint,
          receipt: { ...retired, executionFingerprint },
        },
      }),
    );

    const readResult = await reviewStore.read(REVIEW_ID);
    expect(readResult.ok).toBe(true);
    if (!readResult.ok) return;
    expect(readResult.value.result.issues).toHaveLength(1);
    expect(readResult.value.execution).toBeUndefined();

    const detailed = await reviewStore.readDetailed(REVIEW_ID);
    expect(detailed.ok).toBe(true);
    if (!detailed.ok) return;
    expect(detailed.value.salvaged).toBe(true);
    expect(detailed.value.diagnostics?.droppedExecution).toBe(true);
  });
});
