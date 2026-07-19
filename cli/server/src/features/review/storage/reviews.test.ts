import { createHash } from "node:crypto";
import { mkdir, mkdtemp, readFile, rm, stat, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { getRunSummaryText } from "@diffgazer/core/review";
import type { SavedReview } from "@diffgazer/core/schemas/review";
import { createDeferred } from "@diffgazer/core/testing/deferred";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { makeIssue } from "../../../shared/lib/testing/factories.js";
import { parseDiff } from "../engine/diff/parser.js";

const REVIEW_ID = "550e8400-e29b-41d4-a716-446655440000";
const REVIEW_ID_2 = "660e8400-e29b-41d4-a716-446655440001";
const CURSOR_INDEX_MARKER = "createdAt+id-v1\n";
const makeReviewId = (value: number): string =>
  `00000000-0000-4000-8000-${value.toString().padStart(12, "0")}`;

interface ProjectIndexEntry {
  id: string;
  createdAt: string;
}

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
const projectCursorMarkerPath = (projectPath: string): string => {
  const hash = createHash("sha256").update(projectPath).digest("hex").slice(0, 16);
  return join(reviewsDir(), ".index", `${hash}.cursor-v1`);
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

async function readProjectIndexIds(projectPath: string): Promise<string[]> {
  const entries = await readJson<Array<string | ProjectIndexEntry>>(projectIndexPath(projectPath));
  return entries.map((entry) => (typeof entry === "string" ? entry : entry.id));
}

async function writeCertifiedProjectIndex(
  projectPath: string,
  entries: ProjectIndexEntry[],
): Promise<void> {
  await mkdir(join(reviewsDir(), ".index"), { recursive: true });
  await writeFile(projectIndexPath(projectPath), JSON.stringify(entries), "utf-8");
  await writeFile(projectCursorMarkerPath(projectPath), CURSOR_INDEX_MARKER, "utf-8");
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
    failedLensCount: 0,
    blockerCount: 0,
    highCount: 1,
    mediumCount: 1,
    lowCount: 0,
    nitCount: 0,
    fileCount: 3,
  },
  result: {
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
  ...overrides,
});

function makeProjectReview(id: string, createdAt: string, projectPath = "/proj/a"): SavedReview {
  const review = makeSavedReview();
  return {
    ...review,
    metadata: { ...review.metadata, id, createdAt, projectPath },
  };
}

describe("reviews storage", () => {
  it("saves a review and persists the complete JSON document", async () => {
    const { saveReview } = await loadStorage();

    const result = await saveReview(
      makeSaveOptions({
        reviewId: REVIEW_ID,
        result: {
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

    const savedReview = await readSavedReview(REVIEW_ID);
    expect(savedReview).toMatchObject({
      metadata: { id: REVIEW_ID, issueCount: 3, blockerCount: 1, highCount: 1, nitCount: 1 },
      gitContext: { branch: "main", commit: "abc123", fileCount: 3, additions: 10, deletions: 5 },
      result: { issues: expect.any(Array) },
    });
    expect(savedReview?.result).not.toHaveProperty("summary");
  });

  it("persists header-shaped hunk payload counts in git context", async () => {
    const { saveReview } = await loadStorage();
    const diff = parseDiff(`diff --git a/file.ts b/file.ts
--- a/file.ts
+++ b/file.ts
@@ -1,2 +1,2 @@
--- a/path
--- "a/quoted path"
+++ b/path
+++ "b/quoted path"`);

    const result = await saveReview(makeSaveOptions({ reviewId: REVIEW_ID, diff }));

    expect(result.ok).toBe(true);
    await expect(readSavedReview(REVIEW_ID)).resolves.toMatchObject({
      diff: {
        files: [{ stats: { additions: 2, deletions: 2 } }],
        totalStats: { filesChanged: 1, additions: 2, deletions: 2 },
      },
      gitContext: { fileCount: 1, additions: 2, deletions: 2 },
    });
  });

  it("persists failed lens count through save, list, and detail reads", async () => {
    const { getReview, listReviews, saveReview } = await loadStorage();

    const saved = await saveReview(
      makeSaveOptions({
        reviewId: REVIEW_ID,
        lensStats: [
          { lensId: "correctness", issueCount: 0, status: "success" },
          {
            lensId: "security",
            issueCount: 0,
            status: "failed",
            errorCode: "UPSTREAM_ERROR",
          },
        ],
      }),
    );

    expect(saved.ok).toBe(true);
    if (saved.ok) expect(saved.value.failedLensCount).toBe(1);

    const listed = await listReviews("/projects/test");
    expect(listed.ok).toBe(true);
    if (listed.ok) expect(listed.value.items[0]?.failedLensCount).toBe(1);

    const detail = await getReview(REVIEW_ID);
    expect(detail.ok).toBe(true);
    if (detail.ok) expect(detail.value.metadata.failedLensCount).toBe(1);
  });

  it("migrates a historical zero-issue failed-lens review for list and detail reads", async () => {
    const current = makeSavedReview({
      metadata: {
        ...makeSavedReview().metadata,
        lenses: ["correctness", "security"],
        issueCount: 0,
        blockerCount: 0,
        highCount: 0,
        mediumCount: 0,
        lowCount: 0,
        nitCount: 0,
      },
      result: { issues: [] },
      lensStats: [
        { lensId: "correctness", issueCount: 0, status: "success" },
        { lensId: "security", issueCount: 0, status: "failed", errorCode: "UPSTREAM_ERROR" },
      ],
    });
    const { failedLensCount: _omitted, ...legacyMetadata } = current.metadata;
    await writeSavedReview({ ...current, metadata: legacyMetadata });
    const { getReview, listReviews } = await loadStorage();

    const [listed, detail] = await Promise.all([
      listReviews("/projects/test"),
      getReview(REVIEW_ID),
    ]);

    expect(listed.ok).toBe(true);
    if (listed.ok) {
      const listedMetadata = listed.value.items[0];
      expect(listedMetadata).toBeDefined();
      if (listedMetadata) {
        expect(listedMetadata.failedLensCount).toBe(1);
        expect(getRunSummaryText(listedMetadata)).toBe(
          "Partial analysis: 1 lens failed; no issues found.",
        );
      }
    }
    expect(detail.ok).toBe(true);
    if (detail.ok) {
      expect(detail.value.metadata.failedLensCount).toBe(1);
      expect(getRunSummaryText(detail.value.metadata)).toBe(
        "Partial analysis: 1 lens failed; no issues found.",
      );
    }

    await waitForSavedReview(REVIEW_ID, (review) => review.metadata.failedLensCount === 1);
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
    await expect(readProjectIndexIds("/proj/a")).resolves.toEqual(
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
    expect(result.value.warnings).toContainEqual({
      kind: "unreadable_review",
      reviewId: REVIEW_ID_2,
    });
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
    await expect(readProjectIndexIds("/proj/a")).resolves.toEqual([REVIEW_ID]);
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
    await expect(readProjectIndexIds("/proj/a")).resolves.toEqual([REVIEW_ID]);
  });

  it("returns a typed maintenance warning when stale index cleanup fails", async () => {
    await writeSavedReview(
      makeSavedReview({
        metadata: {
          ...makeSavedReview().metadata,
          id: REVIEW_ID,
          projectPath: "/proj/a",
        },
      }),
    );
    await writeProjectIndexFile("/proj/a", [REVIEW_ID, REVIEW_ID_2]);
    const atomicWrite = await import("../../../shared/lib/fs.js");
    const writeSpy = vi
      .spyOn(atomicWrite, "atomicWriteFile")
      .mockRejectedValueOnce(new Error("index is read-only"));
    const logModule = await import("../../../shared/lib/log.js");
    const logSpy = vi.spyOn(logModule, "log").mockImplementation(() => {});

    try {
      const { listReviews } = await loadStorage();
      const result = await listReviews("/proj/a");

      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.value.items.map((item) => item.id)).toEqual([REVIEW_ID]);
      expect(result.value.warnings).toContainEqual({ kind: "index_rewrite_failed" });
    } finally {
      writeSpy.mockRestore();
      logSpy.mockRestore();
    }
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
    await expect(readProjectIndexIds("/proj/a")).resolves.toEqual([REVIEW_ID_2, REVIEW_ID]);

    const fromIndex = await listReviews("/proj/a");
    expect(fromIndex.ok).toBe(true);
    if (fromIndex.ok) {
      expect(fromIndex.value.items.map((item) => item.id)).toEqual(
        fromScan.value.items.map((item) => item.id),
      );
    }
  });

  it("rejects a traversal-shaped index before collection reads and rebuilds from valid files", async () => {
    const projectPath = "/proj/a";
    const invalidRecordId = makeReviewId(90);
    await writeSavedReview(makeProjectReview(REVIEW_ID, "2025-01-01T00:00:00.000Z"));
    await mkdir(reviewsDir(), { recursive: true });
    await writeFile(
      reviewPath(invalidRecordId),
      `${JSON.stringify({ metadata: { id: invalidRecordId } })}\n`,
      "utf-8",
    );
    await writeFile(
      join(reviewsDir(), "not-a-uuid.json"),
      `${JSON.stringify(makeProjectReview(REVIEW_ID_2, "2026-01-01T00:00:00.000Z"))}\n`,
      "utf-8",
    );
    await writeProjectIndexFile(projectPath, ["../escaped", REVIEW_ID_2]);
    const escapedPath = join(tempHome, "escaped.json");
    await writeFile(
      escapedPath,
      `${JSON.stringify(makeProjectReview(REVIEW_ID_2, "2026-01-01T00:00:00.000Z"))}\n`,
      "utf-8",
    );

    const actual = await vi.importActual<typeof import("node:fs/promises")>("node:fs/promises");
    const readFileSpy = vi.fn(actual.readFile);
    vi.doMock("node:fs/promises", () => ({ ...actual, readFile: readFileSpy }));

    try {
      const { listReviews } = await loadStorage();
      const result = await listReviews(projectPath);

      expect(result).toMatchObject({ ok: true });
      if (!result.ok) return;
      expect(result.value.items.map((item) => item.id)).toEqual([REVIEW_ID]);
      expect(readFileSpy).not.toHaveBeenCalledWith(escapedPath, expect.anything());
      await expect(readProjectIndexIds(projectPath)).resolves.toEqual([REVIEW_ID]);
    } finally {
      vi.doUnmock("node:fs/promises");
    }
  });

  it("does not create an index for an ordinary empty index miss", async () => {
    const projectPath = "/proj/empty";
    const { listReviews } = await loadStorage();

    await expect(listReviews(projectPath)).resolves.toMatchObject({
      ok: true,
      value: { items: [], warnings: [] },
    });
    await expect(stat(projectIndexPath(projectPath))).rejects.toMatchObject({ code: "ENOENT" });
    await expect(stat(projectCursorMarkerPath(projectPath))).rejects.toMatchObject({
      code: "ENOENT",
    });
  });

  it("replaces a corrupt empty index without following symlinks or mismatched records", async () => {
    const projectPath = "/proj/empty-corrupt";
    const symlinkId = makeReviewId(91);
    const mismatchedFilenameId = makeReviewId(92);
    const mismatchedMetadataId = makeReviewId(93);
    await mkdir(reviewsDir(), { recursive: true });
    await writeProjectIndexFile(projectPath, ["../escaped"]);

    const escapedPath = join(tempHome, "escaped.json");
    await writeFile(
      escapedPath,
      `${JSON.stringify(makeProjectReview(symlinkId, "2026-01-01T00:00:00.000Z"))}\n`,
      "utf-8",
    );
    await symlink(escapedPath, reviewPath(symlinkId));
    await writeFile(
      reviewPath(mismatchedFilenameId),
      `${JSON.stringify(makeProjectReview(mismatchedMetadataId, "2025-01-01T00:00:00.000Z"))}\n`,
      "utf-8",
    );

    const actual = await vi.importActual<typeof import("node:fs/promises")>("node:fs/promises");
    const readFileSpy = vi.fn(actual.readFile);
    vi.doMock("node:fs/promises", () => ({ ...actual, readFile: readFileSpy }));

    try {
      const { listReviews } = await loadStorage();
      const result = await listReviews(projectPath);

      expect(result).toMatchObject({ ok: true, value: { items: [] } });
      expect(readFileSpy).not.toHaveBeenCalledWith(reviewPath(symlinkId), expect.anything());
      await expect(readProjectIndexIds(projectPath)).resolves.toEqual([]);
      await expect(readFile(projectCursorMarkerPath(projectPath), "utf-8")).resolves.toBe(
        CURSOR_INDEX_MARKER,
      );
    } finally {
      vi.doUnmock("node:fs/promises");
    }
  });

  it("rejects absolute and separator-bearing review ids before filesystem access", async () => {
    const actual = await vi.importActual<typeof import("node:fs/promises")>("node:fs/promises");
    const readFileSpy = vi.fn(actual.readFile);
    vi.doMock("node:fs/promises", () => ({
      ...actual,
      readFile: readFileSpy,
    }));

    try {
      const { getReview } = await loadStorage();

      await expect(getReview("../escaped")).rejects.toThrow("Invalid review id");
      await expect(getReview("/tmp/escaped")).rejects.toThrow("Invalid review id");
      expect(readFileSpy).not.toHaveBeenCalled();
    } finally {
      vi.doUnmock("node:fs/promises");
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
      const ids = await readProjectIndexIds("/proj/a");
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

  it("deduplicates repeated review ids and rewrites the project index", async () => {
    await writeSavedReview(makeProjectReview(REVIEW_ID, "2026-01-01T00:00:00.000Z"));
    await writeProjectIndexFile("/proj/a", [REVIEW_ID, REVIEW_ID]);

    const { listReviews } = await loadStorage();
    const result = await listReviews("/proj/a");

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.items.map((item) => item.id)).toEqual([REVIEW_ID]);
    await expect(readProjectIndexIds("/proj/a")).resolves.toEqual([REVIEW_ID]);
  });

  it("bootstraps a legacy index from every durable review and certifies canonical order", async () => {
    const oldId = makeReviewId(1);
    const newestId = makeReviewId(2);
    const wrongProjectId = makeReviewId(3);
    const missingId = makeReviewId(4);
    await Promise.all([
      writeSavedReview(makeProjectReview(oldId, "2024-01-01T00:00:00Z")),
      writeSavedReview(makeProjectReview(newestId, "2026-01-01T00:00:00.000Z")),
      writeSavedReview(makeProjectReview(wrongProjectId, "2025-01-01T00:00:00.000Z", "/proj/b")),
    ]);
    await writeProjectIndexFile("/proj/a", [oldId, oldId, missingId, wrongProjectId]);

    const { listReviewPage } = await loadStorage();
    const result = await listReviewPage("/proj/a", { limit: 1 });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.items.map((item) => item.id)).toEqual([newestId]);
    expect(result.value.nextCursor).toMatch(/^dg1_/);
    const cursor = result.value.nextCursor;
    if (!cursor) throw new Error("Expected a legacy bootstrap cursor");
    const secondPage = await listReviewPage("/proj/a", {
      cursor,
      limit: 1,
    });
    expect(secondPage.ok).toBe(true);
    if (secondPage.ok) expect(secondPage.value.items.map((item) => item.id)).toEqual([oldId]);
    await expect(readProjectIndexIds("/proj/a")).resolves.toEqual([newestId, oldId]);
    await expect(readFile(projectCursorMarkerPath("/proj/a"), "utf-8")).resolves.toBe(
      CURSOR_INDEX_MARKER,
    );
  });

  it("does not certify an incomplete legacy index when a save happens before pagination", async () => {
    const indexedId = makeReviewId(5);
    const omittedId = makeReviewId(6);
    const savedId = makeReviewId(7);
    await Promise.all([
      writeSavedReview(makeProjectReview(indexedId, "2024-01-01T00:00:00.000Z")),
      writeSavedReview(makeProjectReview(omittedId, "2025-01-01T00:00:00.000Z")),
    ]);
    await writeProjectIndexFile("/proj/a", [indexedId]);
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-01-01T00:00:00.000Z"));

    try {
      const { listReviewPage, saveReview } = await loadStorage();
      const saved = await saveReview(
        makeSaveOptions({ reviewId: savedId, projectPath: "/proj/a" }),
      );
      expect(saved.ok).toBe(true);

      const page = await listReviewPage("/proj/a", { limit: 10 });
      expect(page.ok).toBe(true);
      if (!page.ok) return;
      expect(page.value.items.map((item) => item.id)).toEqual([savedId, omittedId, indexedId]);
      await expect(readProjectIndexIds("/proj/a")).resolves.toEqual([
        savedId,
        omittedId,
        indexedId,
      ]);
      await expect(readFile(projectCursorMarkerPath("/proj/a"), "utf-8")).resolves.toBe(
        CURSOR_INDEX_MARKER,
      );
    } finally {
      vi.useRealTimers();
    }
  });

  it("preserves certified entries when a save coincides with a transient metadata read error", async () => {
    const firstId = makeReviewId(8);
    const secondId = makeReviewId(9);
    const savedId = makeReviewId(10);
    vi.useFakeTimers();

    try {
      const initialStorage = await loadStorage();
      vi.setSystemTime(new Date("2024-01-01T00:00:00.000Z"));
      await initialStorage.saveReview(
        makeSaveOptions({ reviewId: firstId, projectPath: "/proj/a" }),
      );
      vi.setSystemTime(new Date("2025-01-01T00:00:00.000Z"));
      await initialStorage.saveReview(
        makeSaveOptions({ reviewId: secondId, projectPath: "/proj/a" }),
      );

      vi.resetModules();
      const actual = await vi.importActual<typeof import("node:fs/promises")>("node:fs/promises");
      const readFileSpy = vi.fn(actual.readFile);
      let transientReads = 0;
      readFileSpy.mockImplementation(async (filePath, options) => {
        if (filePath === reviewPath(firstId)) {
          transientReads += 1;
          throw Object.assign(new Error("transient metadata read failure"), { code: "EIO" });
        }
        return actual.readFile(filePath, options);
      });
      vi.doMock("node:fs/promises", () => ({ ...actual, readFile: readFileSpy }));

      vi.setSystemTime(new Date("2026-01-01T00:00:00.000Z"));
      const mockedStorage = await loadStorage();
      const saved = await mockedStorage.saveReview(
        makeSaveOptions({ reviewId: savedId, projectPath: "/proj/a" }),
      );
      expect(saved.ok).toBe(true);
      expect(transientReads).toBe(0);
      await expect(readProjectIndexIds("/proj/a")).resolves.toEqual([savedId, secondId, firstId]);
      await expect(readFile(projectCursorMarkerPath("/proj/a"), "utf-8")).resolves.toBe(
        CURSOR_INDEX_MARKER,
      );

      vi.doUnmock("node:fs/promises");
      vi.resetModules();
      const restoredStorage = await loadStorage();
      const page = await restoredStorage.listReviewPage("/proj/a", { limit: 10 });
      expect(page.ok).toBe(true);
      if (page.ok) {
        expect(page.value.items.map((item) => item.id)).toEqual([savedId, secondId, firstId]);
      }
    } finally {
      vi.doUnmock("node:fs/promises");
      vi.useRealTimers();
    }
  });

  it("reads only limit plus one review records after bootstrap", async () => {
    const ids = Array.from({ length: 7 }, (_, index) => makeReviewId(index + 10));
    await Promise.all(
      ids.map((id, index) =>
        writeSavedReview(makeProjectReview(id, `2026-01-0${7 - index}T00:00:00.000Z`)),
      ),
    );

    const initialStorage = await loadStorage();
    const bootstrap = await initialStorage.listReviewPage("/proj/a", { limit: 2 });
    expect(bootstrap.ok).toBe(true);

    vi.resetModules();
    const actual = await vi.importActual<typeof import("node:fs/promises")>("node:fs/promises");
    const readFileSpy = vi.fn(actual.readFile);
    vi.doMock("node:fs/promises", () => ({ ...actual, readFile: readFileSpy }));

    try {
      const { listReviewPage } = await loadStorage();
      const result = await listReviewPage("/proj/a", { limit: 2 });
      expect(result.ok).toBe(true);
      expect(
        readFileSpy.mock.calls.filter(
          ([filePath]) =>
            typeof filePath === "string" &&
            filePath.startsWith(`${reviewsDir()}/`) &&
            !filePath.startsWith(`${join(reviewsDir(), ".index")}/`) &&
            filePath.endsWith(".json"),
        ),
      ).toHaveLength(3);
    } finally {
      vi.doUnmock("node:fs/promises");
    }
  });

  it("limits concurrent metadata reads during a large-history bootstrap", async () => {
    const ids = Array.from({ length: 40 }, (_, index) => makeReviewId(index + 100));
    await Promise.all(
      ids.map((id, index) =>
        writeSavedReview(
          makeProjectReview(id, new Date(Date.UTC(2026, 1, ids.length - index)).toISOString()),
        ),
      ),
    );

    const actual = await vi.importActual<typeof import("node:fs/promises")>("node:fs/promises");
    const readFileSpy = vi.fn(actual.readFile);
    let activeReviewReads = 0;
    let maxConcurrentReviewReads = 0;
    readFileSpy.mockImplementation(async (filePath, options) => {
      const isReviewFile =
        typeof filePath === "string" &&
        filePath.startsWith(`${reviewsDir()}/`) &&
        !filePath.startsWith(`${join(reviewsDir(), ".index")}/`) &&
        filePath.endsWith(".json");
      if (!isReviewFile) return actual.readFile(filePath, options);

      activeReviewReads += 1;
      maxConcurrentReviewReads = Math.max(maxConcurrentReviewReads, activeReviewReads);
      await new Promise<void>((resolve) => setImmediate(resolve));
      try {
        return await actual.readFile(filePath, options);
      } finally {
        activeReviewReads -= 1;
      }
    });
    vi.doMock("node:fs/promises", () => ({ ...actual, readFile: readFileSpy }));

    try {
      const { listReviewPage } = await loadStorage();
      const result = await listReviewPage("/proj/a", { limit: 5 });

      expect(result.ok).toBe(true);
      if (result.ok) expect(result.value.items).toHaveLength(5);
      expect(maxConcurrentReviewReads).toBeGreaterThan(1);
      expect(maxConcurrentReviewReads).toBeLessThanOrEqual(8);
    } finally {
      vi.doUnmock("node:fs/promises");
    }
  });

  it("parses a large cursor index once and replaces its cache after a committed save", async () => {
    const ids = Array.from({ length: 40 }, (_, index) => makeReviewId(index + 200));
    const entries = ids.map((id, index) => ({
      id,
      createdAt: new Date(Date.UTC(2027, 1, ids.length - index)).toISOString(),
    }));
    await Promise.all(
      entries.map(({ id, createdAt }) => writeSavedReview(makeProjectReview(id, createdAt))),
    );
    await writeCertifiedProjectIndex("/proj/a", entries);

    const actual = await vi.importActual<typeof import("node:fs/promises")>("node:fs/promises");
    const readFileSpy = vi.fn(actual.readFile);
    vi.doMock("node:fs/promises", () => ({ ...actual, readFile: readFileSpy }));

    try {
      const { listReviewPage, saveReview } = await loadStorage();
      const firstPage = await listReviewPage("/proj/a", { limit: 5 });
      expect(firstPage.ok).toBe(true);
      if (!firstPage.ok || !firstPage.value.nextCursor) return;

      const secondPage = await listReviewPage("/proj/a", {
        cursor: firstPage.value.nextCursor,
        limit: 5,
      });
      expect(secondPage.ok).toBe(true);
      expect(
        readFileSpy.mock.calls.filter(([filePath]) => filePath === projectIndexPath("/proj/a")),
      ).toHaveLength(1);

      const saved = await saveReview(
        makeSaveOptions({ reviewId: makeReviewId(999), projectPath: "/proj/a" }),
      );
      expect(saved.ok).toBe(true);
      const refreshedPage = await listReviewPage("/proj/a", { limit: 5 });
      expect(refreshedPage.ok).toBe(true);
      expect(
        readFileSpy.mock.calls.filter(([filePath]) => filePath === projectIndexPath("/proj/a")),
      ).toHaveLength(1);
    } finally {
      vi.doUnmock("node:fs/promises");
    }
  });

  it("takes a cursor snapshot after an in-flight indexed save completes", async () => {
    const olderId = makeReviewId(250);
    const savedId = makeReviewId(251);
    const olderCreatedAt = "2024-01-01T00:00:00.000Z";
    await writeSavedReview(makeProjectReview(olderId, olderCreatedAt));
    await writeCertifiedProjectIndex("/proj/a", [{ id: olderId, createdAt: olderCreatedAt }]);

    const actual = await vi.importActual<typeof import("node:fs/promises")>("node:fs/promises");
    const indexReadStarted = createDeferred<void>();
    const releaseIndexRead = createDeferred<void>();
    let heldIndexRead = false;
    const readFileSpy = vi.fn(actual.readFile);
    readFileSpy.mockImplementation(async (filePath, options) => {
      if (!heldIndexRead && filePath === projectIndexPath("/proj/a")) {
        heldIndexRead = true;
        indexReadStarted.resolve();
        await releaseIndexRead.promise;
      }
      return actual.readFile(filePath, options);
    });
    vi.doMock("node:fs/promises", () => ({ ...actual, readFile: readFileSpy }));

    try {
      const { listReviewPage, saveReview } = await loadStorage();
      const savePromise = saveReview(
        makeSaveOptions({ reviewId: savedId, projectPath: "/proj/a" }),
      );
      await indexReadStarted.promise;

      const pagePromise = listReviewPage("/proj/a", { limit: 10 });
      await new Promise((resolve) => setTimeout(resolve, 20));
      releaseIndexRead.resolve();

      const [saved, page] = await Promise.all([savePromise, pagePromise]);
      expect(saved.ok).toBe(true);
      expect(page.ok).toBe(true);
      if (page.ok) {
        expect(page.value.items.map((item) => item.id)).toEqual([savedId, olderId]);
      }
    } finally {
      releaseIndexRead.resolve();
      vi.doUnmock("node:fs/promises");
    }
  });

  it("reloads a cached cursor index when another writer replaces the file", async () => {
    const olderId = makeReviewId(300);
    const newerId = makeReviewId(301);
    const olderEntry = { id: olderId, createdAt: "2027-01-01T00:00:00.000Z" };
    const newerEntry = { id: newerId, createdAt: "2028-01-01T00:00:00.000Z" };
    await Promise.all([
      writeSavedReview(makeProjectReview(olderId, olderEntry.createdAt)),
      writeSavedReview(makeProjectReview(newerId, newerEntry.createdAt)),
    ]);
    await writeCertifiedProjectIndex("/proj/a", [olderEntry]);

    const actual = await vi.importActual<typeof import("node:fs/promises")>("node:fs/promises");
    const readFileSpy = vi.fn(actual.readFile);
    vi.doMock("node:fs/promises", () => ({ ...actual, readFile: readFileSpy }));

    try {
      const { listReviewPage } = await loadStorage();
      const initialPage = await listReviewPage("/proj/a", { limit: 5 });
      expect(initialPage.ok).toBe(true);
      if (initialPage.ok) {
        expect(initialPage.value.items.map((item) => item.id)).toEqual([olderId]);
      }

      await writeCertifiedProjectIndex("/proj/a", [newerEntry, olderEntry]);
      const refreshedPage = await listReviewPage("/proj/a", { limit: 5 });
      expect(refreshedPage.ok).toBe(true);
      if (refreshedPage.ok) {
        expect(refreshedPage.value.items.map((item) => item.id)).toEqual([newerId, olderId]);
      }
      expect(
        readFileSpy.mock.calls.filter(([filePath]) => filePath === projectIndexPath("/proj/a")),
      ).toHaveLength(2);
    } finally {
      vi.doUnmock("node:fs/promises");
    }
  });

  it("migrates legacy metadata when serving a certified cursor page", async () => {
    const current = makeSavedReview({
      metadata: {
        ...makeSavedReview().metadata,
        projectPath: "/proj/a",
        lenses: ["correctness", "security"],
        issueCount: 0,
        blockerCount: 0,
        highCount: 0,
        mediumCount: 0,
        lowCount: 0,
        nitCount: 0,
      },
      result: { issues: [] },
      lensStats: [
        { lensId: "correctness", issueCount: 0, status: "success" },
        { lensId: "security", issueCount: 0, status: "failed", errorCode: "UPSTREAM_ERROR" },
      ],
    });
    const { failedLensCount: _omitted, ...legacyMetadata } = current.metadata;
    await writeSavedReview({ ...current, metadata: legacyMetadata });
    await writeCertifiedProjectIndex("/proj/a", [
      { id: REVIEW_ID, createdAt: current.metadata.createdAt },
    ]);

    const { listReviewPage } = await loadStorage();
    const result = await listReviewPage("/proj/a", { limit: 1 });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.items).toHaveLength(1);
    const metadata = result.value.items[0];
    expect(metadata?.failedLensCount).toBe(1);
    if (metadata) {
      expect(getRunSummaryText(metadata)).toBe("Partial analysis: 1 lens failed; no issues found.");
    }
    await waitForSavedReview(REVIEW_ID, (review) => review.metadata.failedLensCount === 1);
  });

  it("reconciles a newest orphan and keeps the certified index canonical", async () => {
    const oldId = makeReviewId(20);
    const currentId = makeReviewId(21);
    const orphanId = makeReviewId(22);
    await Promise.all([
      writeSavedReview(makeProjectReview(oldId, "2024-01-01T00:00:00.000Z")),
      writeSavedReview(makeProjectReview(currentId, "2025-01-01T00:00:00.000Z")),
    ]);

    const { listReviewPage } = await loadStorage();
    await listReviewPage("/proj/a", { limit: 10 });
    await writeSavedReview(makeProjectReview(orphanId, "2099-01-01T00:00:00.000Z"));
    await writeReconcileMarker("/proj/a");

    const result = await listReviewPage("/proj/a", { limit: 2 });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.items.map((item) => item.id)).toEqual([orphanId, currentId]);
    await expect(readProjectIndexIds("/proj/a")).resolves.toEqual([orphanId, currentId, oldId]);
    await expect(readFile(projectCursorMarkerPath("/proj/a"), "utf-8")).resolves.toBe(
      CURSOR_INDEX_MARKER,
    );
    await expect(stat(projectReconcileMarkerPath("/proj/a"))).rejects.toMatchObject({
      code: "ENOENT",
    });
  });

  it("merges a save that completes while bootstrap is reading a reconciled orphan", async () => {
    const oldId = makeReviewId(30);
    const orphanId = makeReviewId(31);
    const savedId = makeReviewId(32);
    await Promise.all([
      writeSavedReview(makeProjectReview(oldId, "2024-01-01T00:00:00.000Z")),
      writeSavedReview(makeProjectReview(orphanId, "2099-01-01T00:00:00.000Z")),
    ]);
    await writeProjectIndexFile("/proj/a", [oldId]);
    await writeReconcileMarker("/proj/a");

    const orphanReadStarted = createDeferred<void>();
    const releaseOrphanRead = createDeferred<void>();
    const actual = await vi.importActual<typeof import("node:fs/promises")>("node:fs/promises");
    const readFileSpy = vi.fn(actual.readFile);
    let held = false;
    readFileSpy.mockImplementation(async (filePath, options) => {
      if (!held && filePath === reviewPath(orphanId)) {
        held = true;
        orphanReadStarted.resolve();
        await releaseOrphanRead.promise;
      }
      return actual.readFile(filePath, options);
    });
    vi.doMock("node:fs/promises", () => ({ ...actual, readFile: readFileSpy }));

    try {
      const { listReviewPage, saveReview } = await loadStorage();
      const pagePromise = listReviewPage("/proj/a", { limit: 10 });
      await orphanReadStarted.promise;

      const savePromise = saveReview(
        makeSaveOptions({ reviewId: savedId, projectPath: "/proj/a" }),
      );
      releaseOrphanRead.resolve();

      const [page, saved] = await Promise.all([pagePromise, savePromise]);
      expect(saved.ok).toBe(true);
      expect(page.ok).toBe(true);
      const settledPage = await listReviewPage("/proj/a", { limit: 10 });
      expect(settledPage.ok).toBe(true);
      if (!settledPage.ok) return;
      expect(settledPage.value.items.map((item) => item.id)).toEqual([orphanId, savedId, oldId]);
      await expect(readProjectIndexIds("/proj/a")).resolves.toEqual([orphanId, savedId, oldId]);
      await expect(readFile(projectCursorMarkerPath("/proj/a"), "utf-8")).resolves.toBe(
        CURSOR_INDEX_MARKER,
      );
    } finally {
      releaseOrphanRead.resolve();
      vi.doUnmock("node:fs/promises");
    }
  });

  it("orders equal timestamps by descending id regardless of save order", async () => {
    const lowerId = makeReviewId(40);
    const higherId = makeReviewId(41);
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-02-01T00:00:00.000Z"));

    try {
      const { listReviewPage, saveReview } = await loadStorage();
      await saveReview(makeSaveOptions({ reviewId: higherId, projectPath: "/proj/a" }));
      await saveReview(makeSaveOptions({ reviewId: lowerId, projectPath: "/proj/a" }));

      const page = await listReviewPage("/proj/a", { limit: 10 });
      expect(page.ok).toBe(true);
      if (!page.ok) return;
      expect(page.value.items.map((item) => item.id)).toEqual([higherId, lowerId]);
      await expect(readProjectIndexIds("/proj/a")).resolves.toEqual([higherId, lowerId]);
    } finally {
      vi.useRealTimers();
    }
  });

  it("bounds stale-entry reads and continues without losing valid reviews", async () => {
    const ids = Array.from({ length: 7 }, (_, index) => makeReviewId(index + 50));
    const entries = ids.map((id, index) => ({
      id,
      createdAt: `2026-03-0${7 - index}T00:00:00.000Z`,
    }));
    const validNewest = entries[0];
    const wrongProject = entries[2];
    const validMiddle = entries[4];
    const validOldest = entries[6];
    if (!validNewest || !wrongProject || !validMiddle || !validOldest) {
      throw new Error("Invalid stale-index test fixture");
    }
    await Promise.all([
      writeSavedReview(makeProjectReview(validNewest.id, validNewest.createdAt)),
      writeSavedReview(makeProjectReview(wrongProject.id, wrongProject.createdAt, "/proj/b")),
      writeSavedReview(makeProjectReview(validMiddle.id, validMiddle.createdAt)),
      writeSavedReview(makeProjectReview(validOldest.id, validOldest.createdAt)),
    ]);
    await writeCertifiedProjectIndex("/proj/a", entries);

    const actual = await vi.importActual<typeof import("node:fs/promises")>("node:fs/promises");
    const readFileSpy = vi.fn(actual.readFile);
    vi.doMock("node:fs/promises", () => ({ ...actual, readFile: readFileSpy }));

    try {
      const { listReviewPage } = await loadStorage();
      const seen: string[] = [];
      let cursor: string | undefined;
      do {
        const readsBefore = readFileSpy.mock.calls.length;
        const page = await listReviewPage("/proj/a", { cursor, limit: 2 });
        expect(page.ok).toBe(true);
        if (!page.ok) return;
        const reviewReads = readFileSpy.mock.calls
          .slice(readsBefore)
          .filter(
            ([filePath]) =>
              typeof filePath === "string" &&
              filePath.startsWith(`${reviewsDir()}/`) &&
              !filePath.startsWith(`${join(reviewsDir(), ".index")}/`) &&
              filePath.endsWith(".json"),
          );
        expect(reviewReads.length).toBeLessThanOrEqual(3);
        seen.push(...page.value.items.map((item) => item.id));
        cursor = page.value.nextCursor ?? undefined;
      } while (cursor);

      expect(seen).toEqual([validNewest.id, validMiddle.id, validOldest.id]);
      expect(new Set(seen).size).toBe(seen.length);
    } finally {
      vi.doUnmock("node:fs/promises");
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

  it("returns reviews through persisted files", async () => {
    await writeSavedReview(makeSavedReview());
    const { getReview } = await loadStorage();

    const readResult = await getReview(REVIEW_ID);
    expect(readResult.ok).toBe(true);
    if (readResult.ok) expect(readResult.value.metadata.id).toBe(REVIEW_ID);
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
      expect(result.value.warnings).toContainEqual({ kind: "index_build_failed" });
      expect(JSON.stringify(result.value.warnings)).not.toContain(tempHome);
    }
    expect(logSpy).toHaveBeenCalledWith(
      "warn",
      "reviews_index_build_failed",
      expect.objectContaining({ error: expect.any(Error) }),
    );

    writeSpy.mockRestore();
    logSpy.mockRestore();
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

  it("rebuilds a corrupted index between saves without hiding durable reviews", async () => {
    const projectPath = "/proj/corrupt-between-saves";
    const logModule = await import("../../../shared/lib/log.js");
    const logSpy = vi.spyOn(logModule, "log").mockImplementation(() => {});
    const { listReviews, saveReview } = await loadStorage();

    const first = await saveReview(makeSaveOptions({ reviewId: REVIEW_ID, projectPath }));
    expect(first.ok).toBe(true);
    await writeFile(projectIndexPath(projectPath), "{ malformed index", "utf-8");

    const second = await saveReview(makeSaveOptions({ reviewId: REVIEW_ID_2, projectPath }));
    expect(second.ok).toBe(true);

    const indexEntries = await readJson<ProjectIndexEntry[]>(projectIndexPath(projectPath));
    expect(indexEntries.map((entry) => entry.id)).toEqual(
      expect.arrayContaining([REVIEW_ID, REVIEW_ID_2]),
    );
    const listed = await listReviews(projectPath);
    expect(listed.ok).toBe(true);
    if (listed.ok) {
      expect(listed.value.items.map((item) => item.id)).toEqual(
        expect.arrayContaining([REVIEW_ID, REVIEW_ID_2]),
      );
    }
    expect(logSpy).toHaveBeenCalledWith("warn", "reviews_index_recovered", {
      reason: "parse-error",
    });

    logSpy.mockRestore();
  });

  it("opens and lists a 0.1.3-era review with invalid line numbers", async () => {
    const rawReview = {
      metadata: {
        ...makeSavedReview().metadata,
        id: REVIEW_ID,
        projectPath: "/legacy/proj",
      },
      result: {
        summary: "Legacy review",
        issues: [
          makeIssue({
            id: "ok",
            file: "a.ts",
            line_start: 4.7,
            line_end: 2,
            severity: "high",
            evidence: [
              {
                type: "code",
                title: "Legacy evidence",
                sourceId: "a.ts",
                range: { start: 0, end: 3 },
                excerpt: "retained legacy excerpt",
              },
            ],
          }),
          makeIssue({ id: "zero", file: "b.ts", line_start: 0, line_end: -3 }),
          // Unknown category — the lenient read drops this issue, not the whole record.
          { ...makeIssue({ id: "bad" }), category: "imaginary" },
        ],
      },
      gitContext: makeSavedReview().gitContext,
    };
    await mkdir(reviewsDir(), { recursive: true });
    await writeFile(reviewPath(REVIEW_ID), `${JSON.stringify(rawReview, null, 2)}\n`, "utf-8");
    // A genuinely JSON-corrupt file — surfaced as a warning, not salvaged.
    await writeFile(reviewPath(REVIEW_ID_2), "{ not json", "utf-8");

    const { getReview, listReviews } = await loadStorage();

    const read = await getReview(REVIEW_ID);
    expect(read.ok).toBe(true);
    if (read.ok) {
      expect(read.value.result).not.toHaveProperty("summary");
      const ids = read.value.result.issues.map((issue) => issue.id);
      expect(ids).toEqual(["ok", "zero"]);
      const first = read.value.result.issues[0];
      // Inverted float range floored and swapped to ascending.
      expect(first?.line_start).toBe(2);
      expect(first?.line_end).toBe(4);
      expect(first?.evidence).toEqual([
        expect.objectContaining({ excerpt: "retained legacy excerpt" }),
      ]);
      expect(first?.evidence[0]).not.toHaveProperty("range");
      const second = read.value.result.issues[1];
      // Non-positive line fields nulled.
      expect(second?.line_start).toBeNull();
      expect(second?.line_end).toBeNull();
    }

    const listed = await listReviews("/legacy/proj");
    expect(listed.ok).toBe(true);
    if (listed.ok) {
      expect(listed.value.items.map((item) => item.id)).toContain(REVIEW_ID);
    }
    const allListed = await listReviews();
    expect(allListed.ok).toBe(true);
    if (allListed.ok) {
      expect(allListed.value.warnings).toContainEqual({
        kind: "unreadable_review",
        reviewId: REVIEW_ID_2,
      });
    }
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

  it("reports exact salvage loss and keeps full-scan, indexed, and detail counts aligned", async () => {
    const projectPath = "/legacy/salvage-counts";
    const rawReview = {
      metadata: {
        ...makeSavedReview().metadata,
        projectPath,
        issueCount: 9,
        blockerCount: 1,
        highCount: 2,
        mediumCount: 3,
        lowCount: 1,
        nitCount: 2,
      },
      result: {
        summary: "Legacy review",
        issues: [
          makeIssue({ id: "kept-high", severity: "high" }),
          { ...makeIssue({ id: "dropped" }), category: "imaginary" },
          makeIssue({ id: "kept-nit", severity: "nit" }),
        ],
      },
      gitContext: makeSavedReview().gitContext,
    };
    const rawBytes = `${JSON.stringify(rawReview, null, 2)}\n`;
    await mkdir(reviewsDir(), { recursive: true });
    await writeFile(reviewPath(REVIEW_ID), rawBytes, "utf-8");
    const logModule = await import("../../../shared/lib/log.js");
    const logSpy = vi.spyOn(logModule, "log").mockImplementation(() => {});
    const { getReview, listReviewPage } = await loadStorage();
    const warning = {
      kind: "invalid_issues_dropped" as const,
      reviewId: REVIEW_ID,
      count: 1,
    };
    const expectedCounts = {
      issueCount: 2,
      blockerCount: 0,
      highCount: 1,
      mediumCount: 0,
      lowCount: 0,
      nitCount: 1,
    };

    const fromFullScan = await listReviewPage(projectPath, { limit: 10 });
    expect(fromFullScan.ok).toBe(true);
    if (!fromFullScan.ok) return;
    expect(fromFullScan.value.warnings).toEqual([warning]);
    expect(fromFullScan.value.items[0]).toMatchObject(expectedCounts);
    await expect(readFile(projectCursorMarkerPath(projectPath), "utf-8")).resolves.toBe(
      CURSOR_INDEX_MARKER,
    );

    const fromIndex = await listReviewPage(projectPath, { limit: 10 });
    expect(fromIndex.ok).toBe(true);
    if (!fromIndex.ok) return;
    expect(fromIndex.value.warnings).toEqual([warning]);
    expect(fromIndex.value.items[0]).toMatchObject(expectedCounts);

    const detail = await getReview(REVIEW_ID);
    expect(detail.ok).toBe(true);
    if (detail.ok) {
      expect(detail.value.metadata).toMatchObject(expectedCounts);
      expect(detail.value.result.issues.map((issue) => issue.id)).toEqual([
        "kept-high",
        "kept-nit",
      ]);
    }
    expect(logSpy).toHaveBeenCalledWith("warn", "review_issues_salvaged", {
      reviewId: REVIEW_ID,
      droppedIssueCount: 1,
    });

    await new Promise((resolve) => setTimeout(resolve, 50));
    await expect(readFile(reviewPath(REVIEW_ID), "utf-8")).resolves.toBe(rawBytes);
    logSpy.mockRestore();
  });

  it("serves a strict-valid review with denormalized line fields normalized", async () => {
    await writeSavedReview(
      makeSavedReview({
        result: {
          issues: [makeIssue({ id: "i1", line_start: 8.9, line_end: 4 })],
        },
      }),
    );

    const { getReview } = await loadStorage();
    const read = await getReview(REVIEW_ID);

    expect(read.ok).toBe(true);
    if (read.ok) {
      expect(read.value.result.issues[0]).toMatchObject({ line_start: 4, line_end: 8 });
    }
  });

  it("rekeys every durable review when the legacy source index is incomplete", async () => {
    await Promise.all([
      writeSavedReview(makeProjectReview(REVIEW_ID, "2025-01-01T00:00:00.000Z", "/old/path")),
      writeSavedReview(makeProjectReview(REVIEW_ID_2, "2024-01-01T00:00:00.000Z", "/old/path")),
    ]);
    await writeProjectIndexFile("/old/path", [REVIEW_ID]);

    const { listReviews, rekeyProjectReviews } = await loadStorage();

    await expect(rekeyProjectReviews("/old/path", "/new/path")).resolves.toBe(true);

    const underOld = await listReviews("/old/path");
    const underNew = await listReviews("/new/path");

    expect(underOld.ok).toBe(true);
    if (underOld.ok) expect(underOld.value.items).toEqual([]);
    expect(underNew.ok).toBe(true);
    if (underNew.ok) {
      expect(underNew.value.items.map((item) => item.id)).toEqual([REVIEW_ID, REVIEW_ID_2]);
    }

    await expect(readSavedReview(REVIEW_ID)).resolves.toMatchObject({
      metadata: { projectPath: "/new/path" },
    });
    await expect(readSavedReview(REVIEW_ID_2)).resolves.toMatchObject({
      metadata: { projectPath: "/new/path" },
    });
    await expect(stat(projectIndexPath("/old/path"))).rejects.toMatchObject({ code: "ENOENT" });
  });

  it("merges a rekey into an existing certified destination in canonical order", async () => {
    const movedId = makeReviewId(70);
    const existingId = makeReviewId(71);
    await Promise.all([
      writeSavedReview(makeProjectReview(movedId, "2027-01-01T00:00:00.000Z", "/old/path")),
      writeSavedReview(makeProjectReview(existingId, "2025-01-01T00:00:00.000Z", "/new/path")),
    ]);
    await writeCertifiedProjectIndex("/old/path", [
      { id: movedId, createdAt: "2027-01-01T00:00:00.000Z" },
    ]);
    await writeCertifiedProjectIndex("/new/path", [
      { id: existingId, createdAt: "2025-01-01T00:00:00.000Z" },
    ]);

    const { listReviewPage, rekeyProjectReviews } = await loadStorage();
    await expect(rekeyProjectReviews("/old/path", "/new/path")).resolves.toBe(true);
    const page = await listReviewPage("/new/path", { limit: 10 });

    expect(page.ok).toBe(true);
    if (!page.ok) return;
    expect(page.value.items.map((item) => item.id)).toEqual([movedId, existingId]);
    await expect(readProjectIndexIds("/new/path")).resolves.toEqual([movedId, existingId]);
    await expect(readFile(projectCursorMarkerPath("/new/path"), "utf-8")).resolves.toBe(
      CURSOR_INDEX_MARKER,
    );
  });

  it("retries a partial review-write migration idempotently before removing the source index", async () => {
    await Promise.all([
      writeSavedReview(makeProjectReview(REVIEW_ID, "2025-01-01T00:00:00.000Z", "/old/path")),
      writeSavedReview(makeProjectReview(REVIEW_ID_2, "2024-01-01T00:00:00.000Z", "/old/path")),
    ]);
    await writeCertifiedProjectIndex("/old/path", [
      { id: REVIEW_ID, createdAt: "2025-01-01T00:00:00.000Z" },
      { id: REVIEW_ID_2, createdAt: "2024-01-01T00:00:00.000Z" },
    ]);
    const atomicWrite = await import("../../../shared/lib/fs.js");
    const realAtomicWrite = atomicWrite.atomicWriteFile;
    let failSecondReview = true;
    const successfulReviewWrites = new Map<string, number>();
    const writeSpy = vi
      .spyOn(atomicWrite, "atomicWriteFile")
      .mockImplementation(async (filePath, content, mode) => {
        if (filePath === reviewPath(REVIEW_ID_2) && failSecondReview) {
          failSecondReview = false;
          throw new Error("injected review write failure");
        }
        const result = await realAtomicWrite(filePath, content, mode);
        if (filePath === reviewPath(REVIEW_ID) || filePath === reviewPath(REVIEW_ID_2)) {
          successfulReviewWrites.set(filePath, (successfulReviewWrites.get(filePath) ?? 0) + 1);
        }
        return result;
      });

    try {
      const { rekeyProjectReviews } = await loadStorage();
      await expect(rekeyProjectReviews("/old/path", "/new/path")).resolves.toBe(false);
      await expect(readProjectIndexIds("/old/path")).resolves.toEqual([REVIEW_ID, REVIEW_ID_2]);

      await expect(rekeyProjectReviews("/old/path", "/new/path")).resolves.toBe(true);

      await expect(readSavedReview(REVIEW_ID)).resolves.toMatchObject({
        metadata: { projectPath: "/new/path" },
      });
      await expect(readSavedReview(REVIEW_ID_2)).resolves.toMatchObject({
        metadata: { projectPath: "/new/path" },
      });
      expect(successfulReviewWrites.get(reviewPath(REVIEW_ID))).toBe(1);
      expect(successfulReviewWrites.get(reviewPath(REVIEW_ID_2))).toBe(1);
      await expect(stat(projectIndexPath("/old/path"))).rejects.toMatchObject({ code: "ENOENT" });
    } finally {
      writeSpy.mockRestore();
    }
  });

  it("invalidates a stale destination index when its rekey write fails", async () => {
    const movedId = makeReviewId(72);
    const existingId = makeReviewId(73);
    await Promise.all([
      writeSavedReview(makeProjectReview(movedId, "2027-01-01T00:00:00.000Z", "/old/path")),
      writeSavedReview(makeProjectReview(existingId, "2025-01-01T00:00:00.000Z", "/new/path")),
    ]);
    await writeCertifiedProjectIndex("/old/path", [
      { id: movedId, createdAt: "2027-01-01T00:00:00.000Z" },
    ]);
    await writeCertifiedProjectIndex("/new/path", [
      { id: existingId, createdAt: "2025-01-01T00:00:00.000Z" },
    ]);

    const atomicWrite = await import("../../../shared/lib/fs.js");
    const realAtomicWrite = atomicWrite.atomicWriteFile;
    let failDestinationWrite = true;
    const writeSpy = vi
      .spyOn(atomicWrite, "atomicWriteFile")
      .mockImplementation(async (filePath, content, mode) => {
        if (filePath === projectIndexPath("/new/path") && failDestinationWrite) {
          failDestinationWrite = false;
          throw new Error("destination index write failed");
        }
        return realAtomicWrite(filePath, content, mode);
      });
    const logModule = await import("../../../shared/lib/log.js");
    const logSpy = vi.spyOn(logModule, "log").mockImplementation(() => {});

    const { listReviews, rekeyProjectReviews } = await loadStorage();
    await expect(rekeyProjectReviews("/old/path", "/new/path")).resolves.toBe(false);

    await expect(stat(projectIndexPath("/new/path"))).rejects.toMatchObject({ code: "ENOENT" });
    await expect(readProjectIndexIds("/old/path")).resolves.toEqual([movedId]);
    expect(logSpy).toHaveBeenCalledWith(
      "warn",
      "reviews_rekeyed_destination_index_write_failed",
      expect.objectContaining({ error: expect.any(Error) }),
    );
    expect(logSpy).not.toHaveBeenCalledWith(
      "warn",
      "reviews_rekeyed_destination_index_invalidate_failed",
      expect.anything(),
    );

    await expect(rekeyProjectReviews("/old/path", "/new/path")).resolves.toBe(true);
    const listed = await listReviews("/new/path");
    expect(listed.ok).toBe(true);
    if (listed.ok) {
      expect(listed.value.items.map((item) => item.id)).toEqual([movedId, existingId]);
    }
    await expect(stat(projectIndexPath("/old/path"))).rejects.toMatchObject({ code: "ENOENT" });
    await expect(stat(projectReconcileMarkerPath("/new/path"))).rejects.toMatchObject({
      code: "ENOENT",
    });

    logSpy.mockRestore();
    writeSpy.mockRestore();
  });

  it("keeps a destination reconcile marker until a complete retry certifies the rekey", async () => {
    const movedId = makeReviewId(74);
    const existingId = makeReviewId(75);
    await Promise.all([
      writeSavedReview(makeProjectReview(movedId, "2027-01-01T00:00:00.000Z", "/old/path")),
      writeSavedReview(makeProjectReview(existingId, "2025-01-01T00:00:00.000Z", "/new/path")),
    ]);
    await writeCertifiedProjectIndex("/old/path", [
      { id: movedId, createdAt: "2027-01-01T00:00:00.000Z" },
    ]);
    await writeCertifiedProjectIndex("/new/path", [
      { id: existingId, createdAt: "2025-01-01T00:00:00.000Z" },
    ]);

    const destinationIndex = projectIndexPath("/new/path");
    const actualFs = await vi.importActual<typeof import("node:fs/promises")>("node:fs/promises");
    let failDestinationUnlink = true;
    vi.doMock("node:fs/promises", () => ({
      ...actualFs,
      unlink: async (filePath: string) => {
        if (filePath === destinationIndex && failDestinationUnlink) {
          failDestinationUnlink = false;
          throw new Error("destination index invalidation failed");
        }
        return actualFs.unlink(filePath);
      },
    }));
    const atomicWrite = await import("../../../shared/lib/fs.js");
    const realAtomicWrite = atomicWrite.atomicWriteFile;
    let failDestinationWrite = true;
    const writeSpy = vi
      .spyOn(atomicWrite, "atomicWriteFile")
      .mockImplementation(async (filePath, content, mode) => {
        if (filePath === destinationIndex && failDestinationWrite) {
          failDestinationWrite = false;
          throw new Error("destination index write failed");
        }
        return realAtomicWrite(filePath, content, mode);
      });
    const logModule = await import("../../../shared/lib/log.js");
    const logSpy = vi.spyOn(logModule, "log").mockImplementation(() => {});

    try {
      const { listReviews, rekeyProjectReviews } = await loadStorage();
      await expect(rekeyProjectReviews("/old/path", "/new/path")).resolves.toBe(false);

      await expect(stat(projectReconcileMarkerPath("/new/path"))).resolves.toBeDefined();
      await expect(readProjectIndexIds("/old/path")).resolves.toEqual([movedId]);
      expect(logSpy).toHaveBeenCalledWith(
        "warn",
        "reviews_rekeyed_destination_index_write_failed",
        expect.objectContaining({ error: expect.any(Error) }),
      );
      expect(logSpy).toHaveBeenCalledWith(
        "warn",
        "reviews_rekeyed_destination_index_invalidate_failed",
        expect.objectContaining({ error: expect.any(Error) }),
      );

      await expect(rekeyProjectReviews("/old/path", "/new/path")).resolves.toBe(true);
      const destinationListing = await listReviews("/new/path");
      expect(destinationListing.ok).toBe(true);
      if (destinationListing.ok) {
        expect(destinationListing.value.items.map((item) => item.id)).toEqual([
          movedId,
          existingId,
        ]);
      }
      await expect(stat(projectReconcileMarkerPath("/new/path"))).rejects.toMatchObject({
        code: "ENOENT",
      });
      await expect(stat(projectIndexPath("/old/path"))).rejects.toMatchObject({ code: "ENOENT" });
    } finally {
      logSpy.mockRestore();
      writeSpy.mockRestore();
      vi.doUnmock("node:fs/promises");
    }
  });

  it("logs reconcile-marker failure separately and retains the rekey retry index", async () => {
    const movedId = makeReviewId(76);
    const existingId = makeReviewId(77);
    await Promise.all([
      writeSavedReview(makeProjectReview(movedId, "2027-01-01T00:00:00.000Z", "/old/path")),
      writeSavedReview(makeProjectReview(existingId, "2025-01-01T00:00:00.000Z", "/new/path")),
    ]);
    await writeCertifiedProjectIndex("/old/path", [
      { id: movedId, createdAt: "2027-01-01T00:00:00.000Z" },
    ]);
    await writeCertifiedProjectIndex("/new/path", [
      { id: existingId, createdAt: "2025-01-01T00:00:00.000Z" },
    ]);

    const destinationIndex = projectIndexPath("/new/path");
    const reconcileMarker = projectReconcileMarkerPath("/new/path");
    const actualFs = await vi.importActual<typeof import("node:fs/promises")>("node:fs/promises");
    let failDestinationUnlink = true;
    vi.doMock("node:fs/promises", () => ({
      ...actualFs,
      unlink: async (filePath: string) => {
        if (filePath === destinationIndex && failDestinationUnlink) {
          failDestinationUnlink = false;
          throw new Error("destination index invalidation failed");
        }
        return actualFs.unlink(filePath);
      },
    }));
    const atomicWrite = await import("../../../shared/lib/fs.js");
    const realAtomicWrite = atomicWrite.atomicWriteFile;
    let failDestinationWrite = true;
    let failReconcileMarker = true;
    const writeSpy = vi
      .spyOn(atomicWrite, "atomicWriteFile")
      .mockImplementation(async (filePath, content, mode) => {
        if (filePath === destinationIndex && failDestinationWrite) {
          failDestinationWrite = false;
          throw new Error("destination index write failed");
        }
        if (filePath === reconcileMarker && failReconcileMarker) {
          failReconcileMarker = false;
          throw new Error("destination reconcile marker failed");
        }
        return realAtomicWrite(filePath, content, mode);
      });
    const logModule = await import("../../../shared/lib/log.js");
    const logSpy = vi.spyOn(logModule, "log").mockImplementation(() => {});

    try {
      const { rekeyProjectReviews } = await loadStorage();
      await expect(rekeyProjectReviews("/old/path", "/new/path")).resolves.toBe(false);

      expect(logSpy).toHaveBeenCalledWith(
        "warn",
        "reviews_rekeyed_destination_index_write_failed",
        expect.objectContaining({ error: expect.any(Error) }),
      );
      expect(logSpy).toHaveBeenCalledWith(
        "warn",
        "reviews_rekeyed_destination_index_invalidate_failed",
        expect.objectContaining({ error: expect.any(Error) }),
      );
      expect(logSpy).toHaveBeenCalledWith(
        "warn",
        "reviews_rekeyed_destination_index_mark_reconcile_failed",
        expect.objectContaining({ error: expect.any(Error) }),
      );
      await expect(stat(reconcileMarker)).rejects.toMatchObject({ code: "ENOENT" });
      await expect(readProjectIndexIds("/old/path")).resolves.toEqual([movedId]);

      await expect(rekeyProjectReviews("/old/path", "/new/path")).resolves.toBe(true);
      await expect(stat(projectIndexPath("/old/path"))).rejects.toMatchObject({ code: "ENOENT" });
    } finally {
      logSpy.mockRestore();
      writeSpy.mockRestore();
      vi.doUnmock("node:fs/promises");
    }
  });
});
