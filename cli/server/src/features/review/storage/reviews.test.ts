import { createHash } from "node:crypto";
import { chmod, mkdir, mkdtemp, readFile, rm, stat, writeFile } from "node:fs/promises";
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
  // Fire-and-forget index/migration writes may still be recreating .index/ at teardown;
  // retry past the resulting ENOTEMPTY race.
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
const projectReconcileMarkerPath = (projectPath: string): string => {
  const hash = createHash("sha256").update(projectPath).digest("hex").slice(0, 16);
  return join(reviewsDir(), ".index", `${hash}.reconcile`);
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

async function writeReconcileMarker(projectPath: string): Promise<void> {
  await mkdir(join(reviewsDir(), ".index"), { recursive: true });
  await writeFile(projectReconcileMarkerPath(projectPath), "", "utf-8");
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

  it("reconciles a durably-saved review the stale index omits and self-heals the index", async () => {
    // Index lists only REVIEW_ID with a reconcile marker set (F-097).
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
    await writeReconcileMarker("/proj/a");

    const { listReviews } = await loadStorage();
    const result = await listReviews("/proj/a");

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.items.map((item) => item.id)).toEqual([REVIEW_ID_2, REVIEW_ID]);
    await expect(readJson<string[]>(projectIndexPath("/proj/a"))).resolves.toEqual(
      expect.arrayContaining([REVIEW_ID, REVIEW_ID_2]),
    );
    await expect(stat(projectReconcileMarkerPath("/proj/a"))).rejects.toThrow();
  });

  it("surfaces a corrupt orphan as a listing warning instead of dropping it silently", async () => {
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
    await writeProjectIndexFile("/proj/a", [REVIEW_ID]);
    await writeReconcileMarker("/proj/a");
    await writeFile(reviewPath(REVIEW_ID_2), "{ not json", "utf-8");

    const { listReviews } = await loadStorage();
    const result = await listReviews("/proj/a");

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.items.map((item) => item.id)).toEqual([REVIEW_ID]);
    expect(result.value.warnings.some((w) => w.includes(REVIEW_ID_2))).toBe(true);
  });

  it("serves a single-project listing without reading other projects' index files", async () => {
    // F-097 perf guard: listing /proj/a must not fan out into /proj/b's index.
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
    await writeProjectIndexFile("/proj/a", [REVIEW_ID]);
    await writeProjectIndexFile("/proj/b", [REVIEW_ID_2]);

    // fs/promises named exports are not spyable, so wrap readFile for the fresh module
    // graph the dynamic import builds; reads pass through, only paths are recorded.
    const actual = await vi.importActual<typeof import("node:fs/promises")>("node:fs/promises");
    const readFileSpy = vi.fn(actual.readFile);
    vi.doMock("node:fs/promises", () => ({ ...actual, readFile: readFileSpy }));

    try {
      const { listReviews } = await loadStorage();
      const result = await listReviews("/proj/a");

      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.value.items.map((item) => item.id)).toEqual([REVIEW_ID]);

      const otherIndex = projectIndexPath("/proj/b");
      const readOtherIndex = readFileSpy.mock.calls.some((call) => call[0] === otherIndex);
      expect(readOtherIndex).toBe(false);
    } finally {
      vi.doUnmock("node:fs/promises");
    }
  });

  it("keeps the index authoritative and skips orphan reads when it covers every review", async () => {
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
    await writeProjectIndexFile("/proj/a", [REVIEW_ID]);
    await writeProjectIndexFile("/proj/b", [REVIEW_ID_2]);

    const { listReviews } = await loadStorage();
    const result = await listReviews("/proj/a");

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.items.map((item) => item.id)).toEqual([REVIEW_ID]);
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
    // REVIEW_ID_2 is indexed but its review file was never written.
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

    const { listReviews } = await loadStorage();
    const fromScan = await listReviews("/proj/a");

    expect(fromScan.ok).toBe(true);
    if (!fromScan.ok) return;
    expect(fromScan.value.items.map((item) => item.id)).toEqual([REVIEW_ID_2, REVIEW_ID]);
    await expect(readJson<string[]>(projectIndexPath("/proj/a"))).resolves.toEqual([
      REVIEW_ID_2,
      REVIEW_ID,
    ]);

    const fromIndex = await listReviews("/proj/a");
    expect(fromIndex.ok).toBe(true);
    if (fromIndex.ok) {
      expect(fromIndex.value.items.map((item) => item.id)).toEqual(
        fromScan.value.items.map((item) => item.id),
      );
    }
  });

  it("does not lose a concurrent index add", async () => {
    const { saveReview, listReviews } = await loadStorage();

    const first = saveReview(makeSaveOptions({ reviewId: REVIEW_ID, projectPath: "/proj/a" }));
    const second = saveReview(makeSaveOptions({ reviewId: REVIEW_ID_2, projectPath: "/proj/a" }));

    await expect(Promise.all([first, second])).resolves.toEqual([
      expect.objectContaining({ ok: true }),
      expect.objectContaining({ ok: true }),
    ]);

    await vi.waitFor(async () => {
      const ids = await readJson<string[]>(projectIndexPath("/proj/a"));
      expect(ids).toEqual(expect.arrayContaining([REVIEW_ID, REVIEW_ID_2]));
    });

    const listed = await listReviews("/proj/a");
    expect(listed.ok).toBe(true);
    if (listed.ok) {
      expect(listed.value.items.map((item) => item.id)).toEqual(
        expect.arrayContaining([REVIEW_ID, REVIEW_ID_2]),
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

  it.skipIf(process.platform === "win32")("leaves a review listed when unlink fails", async () => {
    await writeSavedReview(makeSavedReview());
    await writeProjectIndexFile("/projects/test", [REVIEW_ID]);
    const { deleteReview, listReviews } = await loadStorage();

    await chmod(reviewsDir(), 0o500);
    try {
      const deleted = await deleteReview(REVIEW_ID, "/projects/test");
      expect(deleted.ok).toBe(false);
    } finally {
      await chmod(reviewsDir(), 0o700);
    }

    await new Promise((resolve) => setTimeout(resolve, 20));
    const listed = await listReviews("/projects/test");
    expect(listed.ok).toBe(true);
    if (listed.ok) {
      expect(listed.value.items.map((item) => item.id)).toContain(REVIEW_ID);
    }
  });

  it("scrubs the daemon path from a project index build failure warning", async () => {
    const review = makeSavedReview({
      metadata: {
        ...makeSavedReview().metadata,
        projectPath: "/proj/index-fail",
      },
    });
    await writeSavedReview(review);

    const indexPath = projectIndexPath("/proj/index-fail");
    const atomicWrite = await import("../../../shared/lib/fs.js");
    const writeSpy = vi
      .spyOn(atomicWrite, "atomicWriteFile")
      .mockRejectedValueOnce(new Error(`EACCES: permission denied, open '${indexPath}'`));
    const logModule = await import("../../../shared/lib/log.js");
    const logSpy = vi.spyOn(logModule, "log").mockImplementation(() => {});

    const { listReviews } = await loadStorage();
    const result = await listReviews("/proj/index-fail");

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.warnings).toContain("[reviews] Failed to build project index");
      for (const warning of result.value.warnings) {
        expect(warning).not.toContain(tempHome);
      }
    }
    expect(logSpy).toHaveBeenCalledWith(
      "warn",
      "reviews_index_build_failed",
      expect.objectContaining({ error: expect.any(Error) }),
    );

    writeSpy.mockRestore();
    logSpy.mockRestore();
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
    const stored = await getReview(REVIEW_ID);
    expect(stored.ok).toBe(true);
    if (stored.ok) expect(stored.value.metadata.id).toBe(REVIEW_ID);

    expect(logSpy).toHaveBeenCalledWith(
      "warn",
      "reviews_index_add_failed",
      expect.objectContaining({ error: expect.any(Error) }),
    );

    logSpy.mockRestore();
    writeSpy.mockRestore();
  });

  it("keeps a saved review discoverable when the project index append fails", async () => {
    await writeSavedReview(
      makeSavedReview({
        metadata: {
          ...makeSavedReview().metadata,
          id: REVIEW_ID_2,
          projectPath: "/proj/index-fail",
        },
      }),
    );
    await writeProjectIndexFile("/proj/index-fail", [REVIEW_ID_2]);

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

    const { saveReview, listReviews } = await loadStorage();
    const saved = await saveReview(
      makeSaveOptions({ reviewId: REVIEW_ID, projectPath: "/proj/index-fail" }),
    );
    expect(saved.ok).toBe(true);

    const listed = await listReviews("/proj/index-fail");
    writeSpy.mockRestore();

    expect(listed.ok).toBe(true);
    if (listed.ok) {
      expect(listed.value.items.map((item) => item.id)).toEqual(
        expect.arrayContaining([REVIEW_ID, REVIEW_ID_2]),
      );
    }
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
    // Delete before that write's re-read runs; the re-read must observe NOT_FOUND.
    await deleteReview(REVIEW_ID, "/projects/test");

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

    // Hold the review lock so the migration write getReview enqueues stalls behind this
    // gate, letting the drilldown save (which does not take the lock) land first.
    let releaseGate = (): void => {};
    const gate = new Promise<void>((resolve) => {
      releaseGate = resolve;
    });
    const gateHeld = withReviewLock(REVIEW_ID, () => gate);

    // getReview enqueues the pre-drilldown migration snapshot behind the gate.
    const read = await getReview(REVIEW_ID);
    expect(read.ok).toBe(true);

    const saved = await addDrilldownToReview(REVIEW_ID, makeDrilldown("i1", "deep dive"));
    expect(saved.ok).toBe(true);

    // Released: the queued migration re-reads inside the lock and must pick up the
    // drilldown rather than overwrite with its stale pre-drilldown snapshot.
    releaseGate();
    await gateHeld;

    const final = await waitForSavedReview(
      REVIEW_ID,
      (review) => review.metadata.highCount === 1 && review.drilldowns.length === 1,
    );
    expect(final.drilldowns[0]).toMatchObject({ issueId: "i1", detailedAnalysis: "deep dive" });
    expect(final.metadata).toMatchObject({ highCount: 1, mediumCount: 1 });
  });

  it("opens, lists, and deletes a 0.1.3-era review with invalid line numbers and an out-of-range drilldown", async () => {
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
          // Unknown category — the lenient read drops this issue, not the whole record.
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
    // A genuinely JSON-corrupt file — surfaced as a warning, not salvaged.
    await writeFile(reviewPath(REVIEW_ID_2), "{ not json", "utf-8");

    const { getReview, deleteReview, listReviews } = await loadStorage();

    const read = await getReview(REVIEW_ID);
    expect(read.ok).toBe(true);
    if (read.ok) {
      const ids = read.value.result.issues.map((issue) => issue.id);
      expect(ids).toEqual(["ok", "zero"]);
      const first = read.value.result.issues[0];
      // Inverted float range floored and swapped to ascending.
      expect(first?.line_start).toBe(2);
      expect(first?.line_end).toBe(4);
      const second = read.value.result.issues[1];
      // Non-positive line fields nulled.
      expect(second?.line_start).toBeNull();
      expect(second?.line_end).toBeNull();
      expect(read.value.drilldowns).toHaveLength(1);
    }

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

    await expect(deleteReview(REVIEW_ID)).resolves.toEqual({ ok: true, value: { existed: true } });
    await expect(stat(reviewPath(REVIEW_ID))).rejects.toMatchObject({ code: "ENOENT" });
  });

  it("preserves a valid stored diff through lenient salvage", async () => {
    const diff = makeSaveOptions().diff;
    const rawReview = {
      metadata: makeSavedReview().metadata,
      result: {
        summary: "Legacy review",
        issues: [
          makeIssue({ id: "ok", file: "a.ts", severity: "high" }),
          { ...makeIssue({ id: "bad" }), category: "imaginary" },
        ],
      },
      diff,
      gitContext: makeSavedReview().gitContext,
      drilldowns: [],
    };
    await mkdir(reviewsDir(), { recursive: true });
    await writeFile(reviewPath(REVIEW_ID), `${JSON.stringify(rawReview, null, 2)}\n`, "utf-8");

    const { getReview } = await loadStorage();
    const read = await getReview(REVIEW_ID);

    expect(read.ok).toBe(true);
    if (read.ok) {
      expect(read.value.diff).toEqual(diff);
      expect(read.value.result.issues.map((issue) => issue.id)).toEqual(["ok"]);
    }
  });

  it("does not persist a lenient-salvaged record via the migration write-back", async () => {
    const diff = makeSaveOptions().diff;
    const rawReview = {
      metadata: {
        ...makeSavedReview().metadata,
        blockerCount: 0,
        highCount: 0,
        mediumCount: 0,
        lowCount: 0,
        nitCount: 0,
        issueCount: 2,
      },
      result: {
        summary: "Legacy review",
        issues: [
          makeIssue({ id: "ok", file: "a.ts", severity: "high" }),
          { ...makeIssue({ id: "bad" }), category: "imaginary" },
        ],
      },
      diff,
      gitContext: makeSavedReview().gitContext,
      drilldowns: [],
    };
    await mkdir(reviewsDir(), { recursive: true });
    await writeFile(reviewPath(REVIEW_ID), `${JSON.stringify(rawReview, null, 2)}\n`, "utf-8");

    const { getReview } = await loadStorage();
    const read = await getReview(REVIEW_ID);
    expect(read.ok).toBe(true);

    await new Promise((resolve) => setTimeout(resolve, 50));
    const stored = await readJson<typeof rawReview>(reviewPath(REVIEW_ID));
    expect(stored.diff).toEqual(diff);
    expect(stored.result.issues.some((issue) => issue.category === "imaginary")).toBe(true);
  });

  it("serves a strict-valid review with denormalized line fields normalized", async () => {
    await writeSavedReview(
      makeSavedReview({
        result: {
          summary: "Review summary",
          issues: [makeIssue({ id: "i1", line_start: 8.9, line_end: 4 })],
        },
        drilldowns: [
          makeDrilldown("i1", "deep"),
          {
            ...makeDrilldown("i2", "range"),
            issue: makeIssue({ id: "i2", line_start: null, line_end: 9 }),
          },
        ],
      }),
    );

    const { getReview } = await loadStorage();
    const read = await getReview(REVIEW_ID);

    expect(read.ok).toBe(true);
    if (read.ok) {
      expect(read.value.result.issues[0]).toMatchObject({ line_start: 4, line_end: 8 });
      expect(read.value.drilldowns[1]?.issue).toMatchObject({
        line_start: null,
        line_end: null,
      });
    }
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

    await expect(readSavedReview(REVIEW_ID)).resolves.toMatchObject({
      metadata: { projectPath: "/new/path" },
    });
    await expect(stat(projectIndexPath("/old/path"))).rejects.toMatchObject({ code: "ENOENT" });
  });
});
