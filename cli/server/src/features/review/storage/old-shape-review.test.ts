import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { getRunSummaryText, hasDroppedCandidates, isCleanRun } from "@diffgazer/core/review";
import type { SavedReview } from "@diffgazer/core/schemas/review";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { assertTempHome } from "../../../shared/lib/testing/temp-home.js";

const REVIEW_ID = "550e8400-e29b-41d4-a716-446655440000";

let tempHome: string;

beforeEach(async () => {
  tempHome = await mkdtemp(join(tmpdir(), "diffgazer-old-shape-"));
  assertTempHome(tempHome);
  process.env.DIFFGAZER_HOME = tempHome;
  vi.resetModules();
});

afterEach(async () => {
  await rm(tempHome, { recursive: true, force: true });
  delete process.env.DIFFGAZER_HOME;
});

// A review persisted before the salvaged-lens feature: lensStats entries carry
// lensId/issueCount/status only, metadata has failedLensCount but none of the
// new fields.
const oldShapeReview = {
  metadata: {
    id: REVIEW_ID,
    projectPath: "/projects/test",
    createdAt: "2025-01-01T00:00:00.000Z",
    mode: "unstaged",
    branch: "main",
    profile: null,
    lenses: ["correctness", "security"],
    issueCount: 0,
    failedLensCount: 0,
    blockerCount: 0,
    highCount: 0,
    mediumCount: 0,
    lowCount: 0,
    nitCount: 0,
    fileCount: 2,
  },
  result: { issues: [] },
  gitContext: { branch: "main", commit: "abc123", fileCount: 2, additions: 4, deletions: 1 },
  lensStats: [
    { lensId: "correctness", issueCount: 0, status: "success" },
    { lensId: "security", issueCount: 0, status: "success" },
  ],
} as const;

async function seedAndRead(): Promise<SavedReview> {
  const reviewsDir = join(tempHome, "triage-reviews");
  await mkdir(reviewsDir, { recursive: true });
  await writeFile(
    join(reviewsDir, `${REVIEW_ID}.json`),
    `${JSON.stringify(oldShapeReview, null, 2)}\n`,
    "utf-8",
  );
  const { reviewStore } = await import("./store.js");
  const detailed = await reviewStore.readDetailed(REVIEW_ID);
  expect(detailed.ok).toBe(true);
  if (!detailed.ok) throw new Error(detailed.error.message);
  expect(detailed.value.salvaged).toBe(false);
  expect(detailed.value.diagnostics).toBeNull();
  return detailed.value.item;
}

describe("old-shape saved review", () => {
  it("loads through the strict parse path with no error and no salvage warnings", async () => {
    const loaded = await seedAndRead();

    expect(loaded.metadata.id).toBe(REVIEW_ID);
    expect(loaded.result.issues).toEqual([]);
  });

  it("reports no lens as incomplete", async () => {
    const loaded = await seedAndRead();

    // Counted first: an empty (or dropped) lensStats would make the loop below vacuous.
    expect(loaded.lensStats).toHaveLength(oldShapeReview.lensStats.length);
    for (const lens of loaded.lensStats ?? []) {
      expect(lens).not.toHaveProperty("droppedCandidateCount");
    }
    expect(loaded.metadata).not.toHaveProperty("salvagedLensCount");
    expect(hasDroppedCandidates(loaded.lensStats)).toBe(false);
  });

  it("keeps the clean verdict and history sentence unchanged", async () => {
    const loaded = await seedAndRead();

    expect(
      isCleanRun({
        issueCount: 0,
        lensStats: loaded.lensStats,
        failedLensCount: loaded.metadata.failedLensCount,
        salvagedLensCount: loaded.metadata.salvagedLensCount,
      }),
    ).toBe(true);
    expect(getRunSummaryText(loaded.metadata)).toBe("Passed with no issues.");
  });
});
