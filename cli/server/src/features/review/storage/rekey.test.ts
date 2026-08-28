import { mkdtemp, readFile, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { assertTempHome } from "../../../shared/lib/testing/temp-home.js";
import {
  CURSOR_INDEX_MARKER,
  makeProjectReview,
  makeReviewId,
  REVIEW_ID,
  REVIEW_ID_2,
  reviewStorageFixtures,
} from "../testing/review-storage-fixtures.js";
import { drainReviewWrites } from "../testing/storage-drain.js";

let tempHome: string;

const {
  projectCursorMarkerPath,
  projectIndexPath,
  projectReconcileMarkerPath,
  readProjectIndexIds,
  readSavedReview,
  reviewPath,
  writeCertifiedProjectIndex,
  writeProjectIndexFile,
  writeSavedReview,
} = reviewStorageFixtures(() => tempHome);

async function loadStorage() {
  return import("./list-page.js");
}

async function loadRekey() {
  return import("./rekey.js");
}

beforeEach(async () => {
  tempHome = await mkdtemp(join(tmpdir(), "diffgazer-rekey-"));
  assertTempHome(tempHome);
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

describe("review project-path rekey", () => {
  it("rekeys every durable review when the legacy source index is incomplete", async () => {
    await Promise.all([
      writeSavedReview(makeProjectReview(REVIEW_ID, "2025-01-01T00:00:00.000Z", "/old/path")),
      writeSavedReview(makeProjectReview(REVIEW_ID_2, "2024-01-01T00:00:00.000Z", "/old/path")),
    ]);
    await writeProjectIndexFile("/old/path", [REVIEW_ID]);

    const { listReviewPage } = await loadStorage();
    const { rekeyProjectReviews } = await loadRekey();

    await expect(rekeyProjectReviews("/old/path", "/new/path")).resolves.toBe(true);

    await expect(stat(projectIndexPath("/old/path"))).rejects.toMatchObject({ code: "ENOENT" });

    const underOld = await listReviewPage("/old/path", { limit: 20 });
    const underNew = await listReviewPage("/new/path", { limit: 20 });

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

    const { listReviewPage } = await loadStorage();
    const { rekeyProjectReviews } = await loadRekey();
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
      const { rekeyProjectReviews } = await loadRekey();
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

  it("publishes the already-moved reviews when a review write aborts the rekey", async () => {
    const movedId = makeReviewId(76);
    const failedId = makeReviewId(77);
    const untouchedId = makeReviewId(78);
    const entries = [
      { id: movedId, createdAt: "2027-01-01T00:00:00.000Z" },
      { id: failedId, createdAt: "2026-01-01T00:00:00.000Z" },
      { id: untouchedId, createdAt: "2025-01-01T00:00:00.000Z" },
    ];
    await Promise.all(
      entries.map(({ id, createdAt }) =>
        writeSavedReview(makeProjectReview(id, createdAt, "/old/path")),
      ),
    );
    await writeCertifiedProjectIndex("/old/path", entries);

    const atomicWrite = await import("../../../shared/lib/fs.js");
    const realAtomicWrite = atomicWrite.atomicWriteFile;
    const writeSpy = vi
      .spyOn(atomicWrite, "atomicWriteFile")
      .mockImplementation(async (filePath, content, mode) => {
        if (filePath === reviewPath(failedId)) throw new Error("injected review write failure");
        return realAtomicWrite(filePath, content, mode);
      });

    try {
      const { listReviewPage } = await loadStorage();
      const { rekeyProjectReviews } = await loadRekey();
      await expect(rekeyProjectReviews("/old/path", "/new/path")).resolves.toBe(false);

      // The review whose file already points at the destination has to stay listable there.
      const listed = await listReviewPage("/new/path", { limit: 20 });
      expect(listed.ok).toBe(true);
      if (listed.ok) expect(listed.value.items.map((item) => item.id)).toEqual([movedId]);
      await expect(readProjectIndexIds("/new/path")).resolves.toEqual([movedId]);

      // The source index stays the durable retry set, and the failure stops the pass
      // instead of rewriting the reviews behind it.
      await expect(readProjectIndexIds("/old/path")).resolves.toEqual([
        movedId,
        failedId,
        untouchedId,
      ]);
      await expect(readSavedReview(untouchedId)).resolves.toMatchObject({
        metadata: { projectPath: "/old/path" },
      });
    } finally {
      writeSpy.mockRestore();
    }
  });

  it("skips unreadable reviews during a rekey instead of failing the whole move", async () => {
    const movedId = makeReviewId(79);
    const corruptId = makeReviewId(80);
    await writeSavedReview(makeProjectReview(movedId, "2027-01-01T00:00:00.000Z", "/old/path"));
    await writeFile(reviewPath(corruptId), "{ not json", "utf-8");
    await writeCertifiedProjectIndex("/old/path", [
      { id: movedId, createdAt: "2027-01-01T00:00:00.000Z" },
      { id: corruptId, createdAt: "2026-01-01T00:00:00.000Z" },
    ]);

    const logModule = await import("../../../shared/lib/log.js");
    const logSpy = vi.spyOn(logModule, "log").mockImplementation(() => {});

    try {
      const { rekeyProjectReviews } = await loadRekey();
      await expect(rekeyProjectReviews("/old/path", "/new/path")).resolves.toBe(true);

      expect(logSpy).toHaveBeenCalledWith("warn", "reviews_rekey_unreadable_review_skipped", {
        id: corruptId,
        code: "PARSE_ERROR",
      });
      await expect(readProjectIndexIds("/new/path")).resolves.toEqual([movedId]);
      await expect(stat(projectIndexPath("/old/path"))).rejects.toMatchObject({ code: "ENOENT" });
    } finally {
      logSpy.mockRestore();
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

    const { listReviewPage } = await loadStorage();
    const { rekeyProjectReviews } = await loadRekey();
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
    const listed = await listReviewPage("/new/path", { limit: 20 });
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
      const { listReviewPage } = await loadStorage();
      const { rekeyProjectReviews } = await loadRekey();
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
      const destinationListing = await listReviewPage("/new/path", { limit: 20 });
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
      const { rekeyProjectReviews } = await loadRekey();
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

  it("skips a deleted review file instead of failing the whole rekey", async () => {
    const survivingId = makeReviewId(78);
    const deletedId = makeReviewId(79);
    await writeSavedReview(makeProjectReview(survivingId, "2027-01-01T00:00:00.000Z", "/old/path"));
    await writeCertifiedProjectIndex("/old/path", [
      { id: survivingId, createdAt: "2027-01-01T00:00:00.000Z" },
      { id: deletedId, createdAt: "2026-01-01T00:00:00.000Z" },
    ]);

    const { listReviewPage } = await loadStorage();
    const { rekeyProjectReviews } = await loadRekey();
    await expect(rekeyProjectReviews("/old/path", "/new/path")).resolves.toBe(true);

    const listed = await listReviewPage("/new/path", { limit: 20 });
    expect(listed.ok).toBe(true);
    if (listed.ok) expect(listed.value.items.map((item) => item.id)).toEqual([survivingId]);
    await expect(readSavedReview(survivingId)).resolves.toMatchObject({
      metadata: { projectPath: "/new/path" },
    });
    await expect(stat(projectIndexPath("/old/path"))).rejects.toMatchObject({ code: "ENOENT" });
  });

  it("certifies a recovery rekey whose source index also lists another project's review", async () => {
    const recoveredId = makeReviewId(80);
    const foreignId = makeReviewId(81);
    await Promise.all([
      writeSavedReview(makeProjectReview(recoveredId, "2027-01-01T00:00:00.000Z", "/new/path")),
      writeSavedReview(makeProjectReview(foreignId, "2026-01-01T00:00:00.000Z", "/other/path")),
    ]);
    await writeCertifiedProjectIndex("/old/path", [
      { id: recoveredId, createdAt: "2027-01-01T00:00:00.000Z" },
      { id: foreignId, createdAt: "2026-01-01T00:00:00.000Z" },
    ]);

    const { listReviewPage } = await loadStorage();
    const { rekeyProjectReviews } = await loadRekey();
    await expect(rekeyProjectReviews("/old/path", "/new/path")).resolves.toBe(true);

    const listed = await listReviewPage("/new/path", { limit: 20 });
    expect(listed.ok).toBe(true);
    if (listed.ok) expect(listed.value.items.map((item) => item.id)).toEqual([recoveredId]);
    await expect(readSavedReview(foreignId)).resolves.toMatchObject({
      metadata: { projectPath: "/other/path" },
    });
    await expect(stat(projectReconcileMarkerPath("/new/path"))).rejects.toMatchObject({
      code: "ENOENT",
    });
    await expect(stat(projectIndexPath("/old/path"))).rejects.toMatchObject({ code: "ENOENT" });
  });
});
