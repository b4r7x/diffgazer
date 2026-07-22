import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { setReviewRekeyHandler } from "./shared/lib/config/store.js";
import { makeIssue } from "./shared/lib/testing/factories.js";

// Boundary mock: keyring is the OS keychain wrapper; report it unavailable so the re-key test avoids the native binding.
vi.mock("./shared/lib/config/keyring.js", () => ({
  isKeyringAvailable: vi.fn(() => false),
  readKeyringSecret: vi.fn(() => ({ ok: true, value: null })),
  writeKeyringSecret: vi.fn(() => ({ ok: true, value: undefined })),
  deleteKeyringSecret: vi.fn(() => ({ ok: true, value: true })),
}));

describe("review re-key wiring", () => {
  let diffgazerHome: string;
  let originalHome: string | undefined;

  const reviewId = "550e8400-e29b-41d4-a716-446655440000";

  beforeEach(() => {
    originalHome = process.env.DIFFGAZER_HOME;
    diffgazerHome = mkdtempSync(join(tmpdir(), "diffgazer-app-rekey-"));
    process.env.DIFFGAZER_HOME = diffgazerHome;
    vi.resetModules();
  });

  afterEach(() => {
    setReviewRekeyHandler(async () => true);
    if (originalHome === undefined) {
      delete process.env.DIFFGAZER_HOME;
    } else {
      process.env.DIFFGAZER_HOME = originalHome;
    }
    rmSync(diffgazerHome, { recursive: true, force: true });
  });

  it("re-keys a moved project's review listing through the createApp-registered handler", async () => {
    // Import after vi.resetModules so createApp, the config store, and the review
    // storage share one module instance (the rekey handler is module-level state).
    const { createApp: freshCreateApp } = await import("./app.js");
    const { saveReview, listReviews } = await import("./features/review/storage/reviews.js");
    const { createConfigStore } = await import("./shared/lib/config/store.js");

    const originalRoot = join(diffgazerHome, "original");
    const movedRoot = join(diffgazerHome, "moved");
    mkdirSync(join(movedRoot, ".diffgazer"), { recursive: true });
    // A .git dir makes the path an allowed project root.
    mkdirSync(join(movedRoot, ".git"), { recursive: true });
    // project.json still points at the original (pre-move) repoRoot.
    writeFileSync(
      join(movedRoot, ".diffgazer", "project.json"),
      JSON.stringify({
        projectId: "stable-id",
        repoRoot: originalRoot,
        createdAt: "2024-01-01T00:00:00.000Z",
      }),
    );

    // A review stored under the original path.
    const saved = await saveReview({
      reviewId,
      projectPath: originalRoot,
      mode: "unstaged",
      branch: "main",
      commit: "abc123",
      lenses: ["correctness"],
      diff: {
        totalStats: { filesChanged: 1, additions: 1, deletions: 0, totalSizeBytes: 100 },
        files: [],
      },
      result: {
        issues: [makeIssue({ id: "i1", title: "Bug", severity: "high", file: "a.ts" })],
      },
    });
    expect(saved.ok).toBe(true);

    // createApp wires the production rekey handler.
    freshCreateApp();

    // Resolving the moved project triggers the move path, which fires the handler.
    const store = createConfigStore();
    const info = store.getProjectInfo(movedRoot);
    expect(info.projectId).toBe("stable-id");

    // The handler is fire-and-forget; wait for the listing to move to the new path.
    await vi.waitFor(
      async () => {
        const underNew = await listReviews(movedRoot);
        if (!underNew.ok || underNew.value.items.length !== 1) {
          throw new Error("listing not yet re-keyed");
        }
        expect(underNew.value.items[0]?.id).toBe(reviewId);
      },
      { timeout: 3000, interval: 20 },
    );

    const underOld = await listReviews(originalRoot);
    expect(underOld.ok).toBe(true);
    if (underOld.ok) expect(underOld.value.items).toEqual([]);
  });

  it("keeps the old root after a review-write failure and commits it after the next retry", async () => {
    const { createApp: freshCreateApp } = await import("./app.js");
    const { saveReview, listReviews } = await import("./features/review/storage/reviews.js");
    const { createConfigStore } = await import("./shared/lib/config/store.js");
    const atomicWrite = await import("./shared/lib/fs.js");
    const originalRoot = join(diffgazerHome, "retry-original");
    const movedRoot = join(diffgazerHome, "retry-moved");
    const projectFilePath = join(movedRoot, ".diffgazer", "project.json");
    mkdirSync(join(movedRoot, ".diffgazer"), { recursive: true });
    mkdirSync(join(movedRoot, ".git"), { recursive: true });
    writeFileSync(
      projectFilePath,
      JSON.stringify({
        projectId: "stable-retry-id",
        repoRoot: originalRoot,
        createdAt: "2024-01-01T00:00:00.000Z",
      }),
    );
    const saved = await saveReview({
      reviewId,
      projectPath: originalRoot,
      mode: "unstaged",
      branch: "main",
      commit: "abc123",
      lenses: ["correctness"],
      diff: {
        totalStats: { filesChanged: 1, additions: 1, deletions: 0, totalSizeBytes: 100 },
        files: [],
      },
      result: {
        issues: [makeIssue({ id: "i1", title: "Bug", severity: "high", file: "a.ts" })],
      },
    });
    expect(saved.ok).toBe(true);

    const realAtomicWrite = atomicWrite.atomicWriteFile;
    let failReviewWrite = true;
    const writeSpy = vi
      .spyOn(atomicWrite, "atomicWriteFile")
      .mockImplementation(async (filePath, content, mode) => {
        if (filePath.includes(`${reviewId}.json`) && failReviewWrite) {
          failReviewWrite = false;
          throw new Error("injected review write failure");
        }
        return realAtomicWrite(filePath, content, mode);
      });

    try {
      freshCreateApp();
      createConfigStore().getProjectInfo(movedRoot);
      await vi.waitFor(() => expect(failReviewWrite).toBe(false));
      await new Promise((resolve) => setImmediate(resolve));
      expect(JSON.parse(readFileSync(projectFilePath, "utf-8"))).toMatchObject({
        repoRoot: originalRoot,
      });

      freshCreateApp();
      const retryStore = createConfigStore();
      await vi.waitFor(() => {
        retryStore.getProjectInfo(movedRoot);
        expect(JSON.parse(readFileSync(projectFilePath, "utf-8"))).toMatchObject({
          repoRoot: movedRoot,
        });
      });

      const underNew = await listReviews(movedRoot);
      const underOld = await listReviews(originalRoot);
      expect(underNew.ok && underNew.value.items.map((item) => item.id)).toEqual([reviewId]);
      expect(underOld.ok && underOld.value.items).toEqual([]);
    } finally {
      writeSpy.mockRestore();
    }
  });
});
