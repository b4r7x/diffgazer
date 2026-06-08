import { createHash } from "node:crypto";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { DrilldownResult, SavedReview } from "@diffgazer/core/schemas/review";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { makeIssue } from "../testing/factories.js";

const REVIEW_ID = "550e8400-e29b-41d4-a716-446655440000";
const REVIEW_ID_2 = "660e8400-e29b-41d4-a716-446655440001";

let tempHome: string;

beforeEach(async () => {
  tempHome = await mkdtemp(join(tmpdir(), "diffgazer-reviews-"));
  process.env.DIFFGAZER_HOME = tempHome;
  vi.resetModules();
});

afterEach(async () => {
  delete process.env.DIFFGAZER_HOME;
  // listReviews/getReview persist the project index and migrations as fire-and-forget
  // writes that can still be recreating .index/ when teardown runs; retry past the
  // resulting ENOTEMPTY race.
  await rm(tempHome, { recursive: true, force: true, maxRetries: 3, retryDelay: 20 });
});

async function loadStorage() {
  return import("./reviews.js");
}

const reviewsDir = (): string => join(tempHome, "triage-reviews");
const reviewPath = (id: string): string => join(reviewsDir(), `${id}.json`);
const projectIndexPath = (projectPath: string): string => {
  const hash = createHash("sha256").update(projectPath).digest("hex").slice(0, 16);
  return join(reviewsDir(), ".index", `${hash}.json`);
};

async function readJson<T>(filePath: string): Promise<T> {
  return JSON.parse(await readFile(filePath, "utf-8")) as T;
}

async function writeSavedReview(review: SavedReview): Promise<void> {
  await mkdir(reviewsDir(), { recursive: true });
  await writeFile(reviewPath(review.metadata.id), `${JSON.stringify(review, null, 2)}\n`, "utf-8");
}

async function readSavedReview(id: string): Promise<SavedReview> {
  return readJson<SavedReview>(reviewPath(id));
}

async function waitForSavedReview(
  id: string,
  predicate: (review: SavedReview) => boolean,
): Promise<SavedReview> {
  return vi.waitFor(
    async () => {
      const review = await readSavedReview(id);
      if (!predicate(review)) throw new Error(`Predicate not yet satisfied for saved review ${id}`);
      return review;
    },
    { timeout: 1000, interval: 10 },
  );
}

const makeSaveOptions = (overrides: Record<string, unknown> = {}) => ({
  projectPath: "/projects/test",
  mode: "unstaged" as const,
  branch: "main",
  commit: "abc123",
  lenses: ["correctness" as const],
  diff: {
    totalStats: { filesChanged: 3, additions: 10, deletions: 5, totalSizeBytes: 1000 },
    files: [],
  },
  result: {
    summary: "Test review",
    issues: [makeIssue()],
  },
  ...overrides,
});

const makeSavedReview = (overrides: Partial<SavedReview> = {}): SavedReview => ({
  metadata: {
    id: REVIEW_ID,
    projectPath: "/projects/test",
    createdAt: "2025-01-01T00:00:00.000Z",
    mode: "unstaged",
    branch: "main",
    profile: null,
    lenses: ["correctness"],
    issueCount: 2,
    blockerCount: 0,
    highCount: 1,
    mediumCount: 1,
    lowCount: 0,
    nitCount: 0,
    fileCount: 3,
  },
  result: {
    summary: "Review summary",
    issues: [
      makeIssue({ id: "i1", title: "Bug", severity: "high", file: "a.ts" }),
      makeIssue({
        id: "i2",
        title: "Warn",
        severity: "medium",
        file: "b.ts",
        line_start: 5,
        line_end: 6,
      }),
    ],
  },
  gitContext: {
    branch: "main",
    commit: "abc123",
    fileCount: 3,
    additions: 10,
    deletions: 5,
  },
  drilldowns: [],
  ...overrides,
});

const makeDrilldown = (issueId: string, detailedAnalysis: string): DrilldownResult => ({
  issueId,
  issue: makeIssue({ id: issueId }),
  detailedAnalysis,
  rootCause: "Root cause",
  impact: "Impact",
  suggestedFix: "Suggested fix",
  patch: null,
  relatedIssues: [],
  references: [],
});

describe("reviews storage", () => {
  it("saves a review and persists the complete JSON document", async () => {
    const { saveReview } = await loadStorage();

    const result = await saveReview(
      makeSaveOptions({
        reviewId: REVIEW_ID,
        result: {
          summary: "test",
          issues: [
            makeIssue({ id: "i1", title: "A", severity: "blocker", file: "a.ts" }),
            makeIssue({ id: "i2", title: "B", severity: "high", file: "b.ts" }),
            makeIssue({ id: "i3", title: "C", severity: "nit", file: "c.ts" }),
          ],
        },
      }),
    );

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value).toMatchObject({
        id: REVIEW_ID,
        projectPath: "/projects/test",
        branch: "main",
        issueCount: 3,
        blockerCount: 1,
        highCount: 1,
        nitCount: 1,
      });
    }

    await expect(readSavedReview(REVIEW_ID)).resolves.toMatchObject({
      metadata: { id: REVIEW_ID, issueCount: 3, blockerCount: 1, highCount: 1, nitCount: 1 },
      gitContext: { branch: "main", commit: "abc123", fileCount: 3, additions: 10, deletions: 5 },
      result: { summary: "test" },
      drilldowns: [],
    });
  });

  it("lists reviews sorted by newest first and can filter by project path", async () => {
    await writeSavedReview(
      makeSavedReview({
        metadata: {
          ...makeSavedReview().metadata,
          id: REVIEW_ID,
          projectPath: "/proj/a",
          createdAt: "2024-01-01T00:00:00.000Z",
        },
      }),
    );
    await writeSavedReview(
      makeSavedReview({
        metadata: {
          ...makeSavedReview().metadata,
          id: REVIEW_ID_2,
          projectPath: "/proj/b",
          createdAt: "2025-06-01T00:00:00.000Z",
        },
      }),
    );
    const { listReviews } = await loadStorage();

    const all = await listReviews();
    const filtered = await listReviews("/proj/a");

    expect(all.ok).toBe(true);
    if (all.ok) expect(all.value.items.map((item) => item.id)).toEqual([REVIEW_ID_2, REVIEW_ID]);
    expect(filtered.ok).toBe(true);
    if (filtered.ok) expect(filtered.value.items.map((item) => item.id)).toEqual([REVIEW_ID]);
  });

  it("rebuilds a stale project index so saved reviews are not hidden", async () => {
    const first = makeSavedReview({
      metadata: {
        ...makeSavedReview().metadata,
        id: REVIEW_ID,
        projectPath: "/proj/a",
        createdAt: "2024-01-01T00:00:00.000Z",
      },
    });
    const second = makeSavedReview({
      metadata: {
        ...makeSavedReview().metadata,
        id: REVIEW_ID_2,
        projectPath: "/proj/a",
        createdAt: "2025-06-01T00:00:00.000Z",
      },
    });
    await writeSavedReview(first);
    await writeSavedReview(second);
    await mkdir(join(reviewsDir(), ".index"), { recursive: true });
    await writeFile(projectIndexPath("/proj/a"), JSON.stringify([REVIEW_ID]), "utf-8");

    const { listReviews } = await loadStorage();
    const result = await listReviews("/proj/a");

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.items.map((item) => item.id)).toEqual([REVIEW_ID_2, REVIEW_ID]);
    expect(result.value.warnings).toContain(
      "Project review index was stale and has been rebuilt from saved reviews.",
    );
    await expect(readJson<string[]>(projectIndexPath("/proj/a"))).resolves.toEqual([
      REVIEW_ID_2,
      REVIEW_ID,
    ]);
  });

  it("migrates legacy reviews with missing severity counts when listing or reading", async () => {
    const legacy = makeSavedReview({
      metadata: {
        ...makeSavedReview().metadata,
        blockerCount: 0,
        highCount: 0,
        mediumCount: 0,
        lowCount: 0,
        nitCount: 0,
        issueCount: 2,
      },
    });
    await writeSavedReview(legacy);
    const { listReviews, getReview } = await loadStorage();

    const listResult = await listReviews();
    expect(listResult.ok).toBe(true);
    if (listResult.ok) {
      expect(listResult.value.items[0]).toMatchObject({ highCount: 1, mediumCount: 1 });
    }
    await waitForSavedReview(REVIEW_ID, (review) => review.metadata.highCount === 1);

    const readResult = await getReview(REVIEW_ID);
    expect(readResult.ok).toBe(true);
    if (readResult.ok) {
      expect(readResult.value.metadata).toMatchObject({ highCount: 1, mediumCount: 1 });
    }
  });

  it("returns, deletes, and reports missing reviews through persisted files", async () => {
    await writeSavedReview(makeSavedReview());
    const { getReview, deleteReview } = await loadStorage();

    const readResult = await getReview(REVIEW_ID);
    expect(readResult.ok).toBe(true);
    if (readResult.ok) expect(readResult.value.metadata.id).toBe(REVIEW_ID);

    await expect(deleteReview(REVIEW_ID)).resolves.toEqual({
      ok: true,
      value: { existed: true },
    });
    await expect(deleteReview(REVIEW_ID)).resolves.toEqual({
      ok: true,
      value: { existed: false },
    });

    const missing = await getReview(REVIEW_ID);
    expect(missing.ok).toBe(false);
    if (!missing.ok) expect(missing.error.code).toBe("NOT_FOUND");
  });

  it("surfaces lazy project index write failures as warnings", async () => {
    const review = makeSavedReview({
      metadata: {
        ...makeSavedReview().metadata,
        projectPath: "/proj/index-fail",
      },
    });
    await writeSavedReview(review);

    const atomicWrite = await import("../fs.js");
    const writeSpy = vi
      .spyOn(atomicWrite, "atomicWriteFile")
      .mockRejectedValueOnce(new Error("disk full"));

    const { listReviews } = await loadStorage();
    const result = await listReviews("/proj/index-fail");

    writeSpy.mockRestore();

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.warnings).toContain("[reviews] Failed to build project index: disk full");
  });

  it("adds and replaces drilldowns in the saved review", async () => {
    await writeSavedReview(makeSavedReview());
    const { addDrilldownToReview, getReview } = await loadStorage();

    await expect(addDrilldownToReview(REVIEW_ID, makeDrilldown("i1", "first"))).resolves.toEqual({
      ok: true,
      value: undefined,
    });
    await expect(
      addDrilldownToReview(REVIEW_ID, makeDrilldown("i1", "replacement")),
    ).resolves.toEqual({
      ok: true,
      value: undefined,
    });

    const review = await getReview(REVIEW_ID);
    expect(review.ok).toBe(true);
    if (review.ok) {
      expect(review.value.drilldowns).toHaveLength(1);
      expect(review.value.drilldowns[0]).toMatchObject({
        issueId: "i1",
        detailedAnalysis: "replacement",
      });
    }
  });
});
