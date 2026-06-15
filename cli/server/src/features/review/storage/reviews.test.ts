import { createHash } from "node:crypto";
import { mkdir, mkdtemp, readFile, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { DrilldownResult, SavedReview } from "@diffgazer/core/schemas/review";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { makeIssue } from "../../../shared/lib/testing/factories.js";

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

async function writeProjectIndexFile(projectPath: string, ids: string[]): Promise<void> {
  await mkdir(join(reviewsDir(), ".index"), { recursive: true });
  await writeFile(projectIndexPath(projectPath), JSON.stringify(ids), "utf-8");
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

  it("serves a valid project index and does not fall back to the full directory scan", async () => {
    // Disk holds two reviews for /proj/a, but the index lists only the first.
    // The single-path index branch is authoritative: it must serve exactly the
    // indexed review and never run the full scan (which would surface the second).
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
          projectPath: "/proj/a",
          createdAt: "2025-06-01T00:00:00.000Z",
        },
      }),
    );
    await writeProjectIndexFile("/proj/a", [REVIEW_ID]);

    const { listReviews } = await loadStorage();
    const result = await listReviews("/proj/a");

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.items.map((item) => item.id)).toEqual([REVIEW_ID]);
    // The index file was not rewritten from a full scan.
    await expect(readJson<string[]>(projectIndexPath("/proj/a"))).resolves.toEqual([REVIEW_ID]);
  });

  it("drops index entries whose review file is gone and rewrites the index", async () => {
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
    // REVIEW_ID_2 is indexed but its review file was never written (e.g. deleted).
    await writeProjectIndexFile("/proj/a", [REVIEW_ID, REVIEW_ID_2]);

    const { listReviews } = await loadStorage();
    const result = await listReviews("/proj/a");

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.items.map((item) => item.id)).toEqual([REVIEW_ID]);
    await expect(readJson<string[]>(projectIndexPath("/proj/a"))).resolves.toEqual([REVIEW_ID]);
  });

  it("runs the full scan on index miss, rebuilds the index, then serves it identically", async () => {
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
          projectPath: "/proj/a",
          createdAt: "2025-06-01T00:00:00.000Z",
        },
      }),
    );
    // No index file on disk → full-scan path.

    const { listReviews } = await loadStorage();
    const fromScan = await listReviews("/proj/a");

    expect(fromScan.ok).toBe(true);
    if (!fromScan.ok) return;
    expect(fromScan.value.items.map((item) => item.id)).toEqual([REVIEW_ID_2, REVIEW_ID]);
    // The scan rebuilt the index with both ids.
    await expect(readJson<string[]>(projectIndexPath("/proj/a"))).resolves.toEqual([
      REVIEW_ID_2,
      REVIEW_ID,
    ]);

    // The index path now returns the identical listing.
    const fromIndex = await listReviews("/proj/a");
    expect(fromIndex.ok).toBe(true);
    if (fromIndex.ok) {
      expect(fromIndex.value.items.map((item) => item.id)).toEqual(
        fromScan.value.items.map((item) => item.id),
      );
    }
  });

  it.skipIf(process.platform === "win32")(
    "creates the reviews index directory with 0o700 mode under a permissive umask",
    async () => {
      const previousUmask = process.umask(0o022);
      try {
        const { saveReview } = await loadStorage();
        const result = await saveReview(makeSaveOptions({ reviewId: REVIEW_ID }));
        expect(result.ok).toBe(true);

        const indexDir = join(reviewsDir(), ".index");
        await vi.waitFor(async () => {
          const dirStat = await stat(indexDir);
          expect(dirStat.mode & 0o777).toBe(0o700);
        });
      } finally {
        process.umask(previousUmask);
      }
    },
  );

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

    const atomicWrite = await import("../../../shared/lib/fs.js");
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

  it("returns ok and warns when the project index write fails after a durable review save", async () => {
    const atomicWrite = await import("../../../shared/lib/fs.js");
    const real = atomicWrite.atomicWriteFile;
    const writeSpy = vi
      .spyOn(atomicWrite, "atomicWriteFile")
      .mockImplementation(async (filePath, content, mode) => {
        if (filePath.includes(`${join("triage-reviews", ".index")}`)) {
          throw new Error("disk full");
        }
        return real(filePath, content, mode);
      });
    const logModule = await import("../../../shared/lib/log.js");
    const logSpy = vi.spyOn(logModule, "log").mockImplementation(() => {});

    const { saveReview, getReview } = await loadStorage();
    const result = await saveReview(makeSaveOptions({ reviewId: REVIEW_ID }));

    expect(result.ok).toBe(true);
    // The review file itself was written durably and is openable.
    const stored = await getReview(REVIEW_ID);
    expect(stored.ok).toBe(true);
    if (stored.ok) expect(stored.value.metadata.id).toBe(REVIEW_ID);

    // The index write is fire-and-forget; its rejection handler warns on a later
    // microtask, so wait for the structured warn before asserting.
    await vi.waitFor(() => {
      expect(logSpy).toHaveBeenCalledWith(
        "warn",
        "reviews_index_add_failed",
        expect.objectContaining({ error: expect.any(Error) }),
      );
    });

    logSpy.mockRestore();
    writeSpy.mockRestore();
  });

  it("does not resurrect a legacy review deleted during its background migration write", async () => {
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

    const { getReview, deleteReview } = await loadStorage();

    // getReview enqueues a background migration write through the review lock.
    const read = await getReview(REVIEW_ID);
    expect(read.ok).toBe(true);
    // Delete before the background write's re-read writes back the migrated value.
    await deleteReview(REVIEW_ID, "/projects/test");

    // Let the locked migration write settle; the re-read must observe the deletion
    // (NOT_FOUND) and skip the write rather than recreating the file.
    await new Promise((resolve) => setTimeout(resolve, 50));

    await expect(stat(reviewPath(REVIEW_ID))).rejects.toMatchObject({ code: "ENOENT" });
  });

  it("preserves a concurrently-saved drilldown against a background migration write", async () => {
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

    const { withReviewLock } = await import("./review-lock.js");
    const { getReview, addDrilldownToReview } = await loadStorage();

    // Hold the review lock so the migration write getReview enqueues stalls behind
    // this gate. The drilldown save (which does not take the lock) lands first.
    let releaseGate = (): void => {};
    const gate = new Promise<void>((resolve) => {
      releaseGate = resolve;
    });
    const gateHeld = withReviewLock(REVIEW_ID, () => gate);

    // getReview enqueues the pre-drilldown migration snapshot behind the gate.
    const read = await getReview(REVIEW_ID);
    expect(read.ok).toBe(true);

    // Save the drilldown while the migration is still blocked.
    const saved = await addDrilldownToReview(REVIEW_ID, makeDrilldown("i1", "deep dive"));
    expect(saved.ok).toBe(true);

    // Release the gate: the queued migration re-reads inside the lock and must pick
    // up the drilldown rather than overwriting with its stale pre-drilldown snapshot.
    releaseGate();
    await gateHeld;

    const final = await waitForSavedReview(
      REVIEW_ID,
      (review) => review.metadata.highCount === 1 && review.drilldowns.length === 1,
    );
    expect(final.drilldowns[0]).toMatchObject({ issueId: "i1", detailedAnalysis: "deep dive" });
    // The migration still applied its severity-count fix.
    expect(final.metadata).toMatchObject({ highCount: 1, mediumCount: 1 });
  });

  it("opens, lists, and deletes a 0.1.3-era review with invalid line numbers and an out-of-range drilldown", async () => {
    // A raw record the strict write-side schema would reject: zero/negative/float/
    // inverted issue lines, an out-of-range drilldown line, and one issue carrying
    // an unknown category (salvaged-and-dropped by the lenient read).
    const rawReview = {
      metadata: {
        ...makeSavedReview().metadata,
        id: REVIEW_ID,
        projectPath: "/legacy/proj",
      },
      result: {
        summary: "Legacy review",
        issues: [
          makeIssue({ id: "ok", file: "a.ts", line_start: 4.7, line_end: 2, severity: "high" }),
          makeIssue({ id: "zero", file: "b.ts", line_start: 0, line_end: -3 }),
          // Unknown category — the lenient read drops this issue instead of voiding
          // the whole record.
          { ...makeIssue({ id: "bad" }), category: "imaginary" },
        ],
      },
      gitContext: makeSavedReview().gitContext,
      drilldowns: [
        {
          ...makeDrilldown("ok", "deep"),
          issue: makeIssue({ id: "ok", file: "a.ts", line_start: -1, line_end: 999999 }),
        },
      ],
    };
    await mkdir(reviewsDir(), { recursive: true });
    await writeFile(reviewPath(REVIEW_ID), `${JSON.stringify(rawReview, null, 2)}\n`, "utf-8");
    // A second file that is genuinely JSON-corrupt — it must surface as a warning,
    // not be salvaged.
    await writeFile(reviewPath(REVIEW_ID_2), "{ not json", "utf-8");

    const { getReview, deleteReview, listReviews } = await loadStorage();

    // GET opens the record with the valid issues normalized.
    const read = await getReview(REVIEW_ID);
    expect(read.ok).toBe(true);
    if (read.ok) {
      const ids = read.value.result.issues.map((issue) => issue.id);
      expect(ids).toEqual(["ok", "zero"]);
      const first = read.value.result.issues[0];
      // Inverted float range is floored and swapped to a valid ascending range.
      expect(first?.line_start).toBe(2);
      expect(first?.line_end).toBe(4);
      const second = read.value.result.issues[1];
      // Non-positive line fields are nulled.
      expect(second?.line_start).toBeNull();
      expect(second?.line_end).toBeNull();
      // The salvaged drilldown opens too.
      expect(read.value.drilldowns).toHaveLength(1);
    }

    // The listing keeps the salvageable record and surfaces the corrupt one.
    const listed = await listReviews("/legacy/proj");
    expect(listed.ok).toBe(true);
    if (listed.ok) {
      expect(listed.value.items.map((item) => item.id)).toContain(REVIEW_ID);
    }
    const allListed = await listReviews();
    expect(allListed.ok).toBe(true);
    if (allListed.ok) {
      expect(allListed.value.warnings.some((w) => w.includes(REVIEW_ID_2))).toBe(true);
    }

    // DELETE removes the salvaged record (its ownership read succeeds).
    await expect(deleteReview(REVIEW_ID)).resolves.toEqual({ ok: true, value: { existed: true } });
    await expect(stat(reviewPath(REVIEW_ID))).rejects.toMatchObject({ code: "ENOENT" });
  });

  it("rekeys a project's reviews to a new path and removes the stale index", async () => {
    await writeSavedReview(
      makeSavedReview({
        metadata: {
          ...makeSavedReview().metadata,
          id: REVIEW_ID,
          projectPath: "/old/path",
        },
      }),
    );
    await writeProjectIndexFile("/old/path", [REVIEW_ID]);

    const { listReviews, rekeyProjectReviews } = await loadStorage();

    await rekeyProjectReviews("/old/path", "/new/path");

    const underOld = await listReviews("/old/path");
    const underNew = await listReviews("/new/path");

    expect(underOld.ok).toBe(true);
    if (underOld.ok) expect(underOld.value.items).toEqual([]);
    expect(underNew.ok).toBe(true);
    if (underNew.ok) expect(underNew.value.items.map((item) => item.id)).toEqual([REVIEW_ID]);

    // The stored review now carries the new path.
    await expect(readSavedReview(REVIEW_ID)).resolves.toMatchObject({
      metadata: { projectPath: "/new/path" },
    });
    // The old-hash index file is gone.
    await expect(stat(projectIndexPath("/old/path"))).rejects.toMatchObject({ code: "ENOENT" });
  });
});
