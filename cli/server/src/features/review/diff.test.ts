import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { err, ok } from "@diffgazer/core/result";
import { ReviewErrorCode } from "@diffgazer/core/schemas/review";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import type { z } from "zod";
import type { InitializedAIClient } from "../../shared/lib/ai/client/initialize.js";
import { createGitService } from "../../shared/lib/git/service.js";
import { makeFileDiff, makeParsedDiff } from "../../shared/lib/testing/factories.js";
import { filterDiffByFiles, resolveGitDiff } from "./diff.js";
import { resolveReviewDefaults } from "./pipeline.js";
import { CreateReviewBodySchema } from "./schemas.js";
import { buildReviewInputHash, createReviewSession } from "./service.js";
import {
  buildReviewConfigKey,
  buildScopeKey,
  cancelStaleSessionsForProjectMode,
  createSession,
  deleteSession,
  getActiveSessionForProject,
  getSession,
  markReady,
} from "./stream/store.js";

type GitService = ReturnType<typeof createGitService>;

const TWO_FILE_DIFF = [
  "diff --git a/src/index.ts b/src/index.ts",
  "index 1111111..2222222 100644",
  "--- a/src/index.ts",
  "+++ b/src/index.ts",
  "@@ -1 +1 @@",
  "-old",
  "+new",
  "diff --git a/README.md b/README.md",
  "index 3333333..4444444 100644",
  "--- a/README.md",
  "+++ b/README.md",
  "@@ -1 +1 @@",
  "-old",
  "+new",
  "",
].join("\n");

const SINGLE_FILE_DIFF = [
  "diff --git a/src/index.ts b/src/index.ts",
  "index 1111111..2222222 100644",
  "--- a/src/index.ts",
  "+++ b/src/index.ts",
  "@@ -1 +1 @@",
  "-old",
  "+new",
  "",
].join("\n");

function makeGitService(getDiff: GitService["getDiff"]): GitService {
  return { getDiff } as GitService;
}

function makeDiffTestFile(filePath: string, additions = 1, deletions = 0) {
  return makeFileDiff({
    filePath,
    rawDiff: "",
    stats: { additions, deletions, sizeBytes: 100 },
  });
}

describe("resolveGitDiff", () => {
  it("rejects files mode without pathspecs before invoking git", async () => {
    let getDiffCalls = 0;
    const result = await resolveGitDiff({
      gitService: makeGitService(async () => {
        getDiffCalls += 1;
        return ok(SINGLE_FILE_DIFF);
      }),
      mode: "files",
      emit: async () => undefined,
      reviewId: "review-1",
    });

    expect(result).toEqual({
      ok: false,
      error: {
        code: ReviewErrorCode.GENERATION_FAILED,
        kind: "review_abort",
        message: "files[] must be non-empty when mode is 'files'",
        step: "diff",
      },
    });
    expect(getDiffCalls).toBe(0);
  });

  it("maps a git timeout diff failure to a non-GIT_NOT_FOUND error code", async () => {
    const result = await resolveGitDiff({
      gitService: makeGitService(async () => err({ message: "git diff operation timed out" })),
      mode: "unstaged",
      emit: async () => undefined,
      reviewId: "review-1",
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe(ReviewErrorCode.GENERATION_FAILED);
      expect(result.error.code).not.toBe(ReviewErrorCode.GIT_NOT_FOUND);
      expect(result.error.message).toContain("timed out");
    }
  });

  it("keeps missing git diff failures mapped to GIT_NOT_FOUND", async () => {
    const result = await resolveGitDiff({
      gitService: makeGitService(async () => err({ message: "spawn git ENOENT" })),
      mode: "unstaged",
      emit: async () => undefined,
      reviewId: "review-1",
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe(ReviewErrorCode.GIT_NOT_FOUND);
    }
  });

  it("uses readable no-diff copy for files mode", async () => {
    const result = await resolveGitDiff({
      gitService: makeGitService(async () => ok(SINGLE_FILE_DIFF)),
      mode: "files",
      files: ["src/missing.ts"],
      emit: async () => undefined,
      reviewId: "review-1",
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.message).toBe("None of the specified files have changes");
    }
  });

  it("returns NO_DIFF without success events when only internal files changed", async () => {
    const events: Array<{ type: string }> = [];
    const internalDiff = SINGLE_FILE_DIFF.replaceAll("src/index.ts", ".diffgazer/config.json");

    const result = await resolveGitDiff({
      gitService: makeGitService(async () => ok(internalDiff)),
      mode: "unstaged",
      emit: async (event) => {
        events.push({ type: event.type });
      },
      reviewId: "internal-only",
    });

    expect(result).toMatchObject({
      ok: false,
      error: { code: ReviewErrorCode.NO_DIFF, step: "diff" },
    });
    expect(events).toEqual([{ type: "step_start" }]);
  });

  it("emits review_started after file filtering", async () => {
    const events: unknown[] = [];

    const result = await resolveGitDiff({
      gitService: makeGitService(async () => ok(TWO_FILE_DIFF)),
      mode: "unstaged",
      files: ["src/index.ts"],
      emit: async (event) => {
        events.push(event);
      },
      reviewId: "review-1",
    });

    expect(result.ok).toBe(true);
    expect(events).toMatchObject([
      { type: "step_start", step: "diff" },
      { type: "step_complete", step: "diff" },
      { type: "review_started", filesTotal: 1 },
    ]);
  });

  it("does not emit review_started when file filtering removes every diff file", async () => {
    const events: unknown[] = [];

    const result = await resolveGitDiff({
      gitService: makeGitService(async () => ok(TWO_FILE_DIFF)),
      mode: "unstaged",
      files: ["missing.ts"],
      emit: async (event) => {
        events.push(event);
      },
      reviewId: "review-1",
    });

    expect(result.ok).toBe(false);
    expect(events).toMatchObject([{ type: "step_start", step: "diff" }]);
  });
});

describe("filterDiffByFiles", () => {
  const parsed = makeParsedDiff([
    makeDiffTestFile("src/index.ts"),
    makeDiffTestFile("src/utils.ts"),
    makeDiffTestFile("README.md"),
  ]);

  it("returns all files when no filter is provided", () => {
    const result = filterDiffByFiles(parsed, []);
    expect(result.files).toHaveLength(3);
  });

  it("matches canonical paths and recalculates totals for included files", () => {
    const result = filterDiffByFiles(parsed, ["src/index.ts", "src/utils.ts"]);
    expect(result.files).toHaveLength(2);
    expect(result.files.map((f) => f.filePath)).toEqual(["src/index.ts", "src/utils.ts"]);
    expect(result.totalStats).toEqual({
      filesChanged: 2,
      additions: 2,
      deletions: 0,
      totalSizeBytes: 200,
    });
  });

  it("returns empty totals when no files match", () => {
    const result = filterDiffByFiles(parsed, ["nonexistent.ts"]);
    expect(result.files).toHaveLength(0);
    expect(result.totalStats.filesChanged).toBe(0);
  });
});

describe("createReviewSession canonical file-scoped identity", () => {
  let repository: string;
  let originalDiffgazerHome: string | undefined;
  let tempHome: string;
  const trackedSessionIds = new Set<string>();
  const sessionsWithRunners = new Set<string>();

  function makeAIClient(): InitializedAIClient {
    const generate: InitializedAIClient["generate"] = async <T extends z.ZodType>(
      _prompt: string,
      schema: T,
    ) => ok(schema.parse({ issues: [] }));

    return {
      provider: "openrouter",
      executionFingerprint: { provider: "openrouter", model: "test-model" },
      generate,
    };
  }

  beforeAll(() => {
    originalDiffgazerHome = process.env.DIFFGAZER_HOME;
    tempHome = mkdtempSync(join(tmpdir(), "diffgazer-review-diff-home-"));
    writeFileSync(
      join(tempHome, "config.json"),
      JSON.stringify({
        settings: { defaultLenses: ["correctness"], agentExecution: "sequential" },
      }),
    );
    process.env.DIFFGAZER_HOME = tempHome;
  });

  afterAll(() => {
    rmSync(tempHome, { recursive: true, force: true });
    if (originalDiffgazerHome === undefined) {
      delete process.env.DIFFGAZER_HOME;
    } else {
      process.env.DIFFGAZER_HOME = originalDiffgazerHome;
    }
  });

  beforeEach(() => {
    repository = mkdtempSync(join(tmpdir(), "diffgazer-review-diff-repo-"));
    const runGit = (...args: string[]) =>
      execFileSync("git", args, { cwd: repository, encoding: "utf8", stdio: "pipe" });
    runGit("init", "--quiet", "--initial-branch=main");
    runGit("config", "user.name", "Diffgazer Test");
    runGit("config", "user.email", "diffgazer@example.invalid");
    mkdirSync(join(repository, "src"), { recursive: true });
    writeFileSync(join(repository, "src/index.ts"), "before\n");
    runGit("add", "--", "src/index.ts");
    runGit("commit", "--quiet", "-m", "fixture");
    writeFileSync(join(repository, "src/index.ts"), "before\nafter\n");
  });

  afterEach(async () => {
    for (const id of trackedSessionIds) {
      getSession(id)?.controller.abort("test_cleanup");
    }
    await vi.waitFor(() => {
      for (const id of sessionsWithRunners) {
        const session = getSession(id);
        if (session && !session.isComplete) throw new Error(`session ${id} not yet complete`);
      }
    });
    for (const id of trackedSessionIds) {
      deleteSession(id);
    }
    trackedSessionIds.clear();
    sessionsWithRunners.clear();
    rmSync(repository, { recursive: true, force: true });
  });

  it("forwards a canonicalized alias/duplicate/separator/dot-segment request body's files to createReviewSession", async () => {
    const body = CreateReviewBodySchema.parse({
      mode: "files",
      files: ["src/index.ts", "./src/index.ts", "src\\index.ts", "src/./index.ts", "src/index.ts/"],
    });
    expect(body.files).toEqual(["src/index.ts"]);

    const result = await createReviewSession(makeAIClient(), {
      mode: body.mode ?? "unstaged",
      files: body.files,
      lenses: body.lenses,
      profile: body.profile,
      projectPath: repository,
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    trackedSessionIds.add(result.value.reviewId);
    sessionsWithRunners.add(result.value.reviewId);
    expect(result.value.session.events).toContainEqual(
      expect.objectContaining({ type: "review_started", filesTotal: 1 }),
    );
  });

  it("reuses the active session and forwards the canonical git path across equivalent duplicate/separator request bodies", async () => {
    const firstRequest = CreateReviewBodySchema.parse({
      mode: "files",
      files: ["src/./index.ts", "src/index.ts", "./src/index.ts"],
    });
    const secondRequest = CreateReviewBodySchema.parse({
      mode: "files",
      files: ["src//index.ts", "src/index.ts"],
    });
    expect(firstRequest.files).toEqual(secondRequest.files);
    const canonicalFiles = firstRequest.files;
    expect(canonicalFiles).toEqual(["src/index.ts"]);
    if (!canonicalFiles) return;

    const aiClient = makeAIClient();
    const gitService = createGitService({ cwd: repository });
    const [headCommitResult, statusHashResult] = await Promise.all([
      gitService.getHeadCommit(),
      gitService.getStatusHash(),
    ]);
    expect(headCommitResult.ok).toBe(true);
    expect(statusHashResult.kind).toBe("full");
    if (!headCommitResult.ok || statusHashResult.kind !== "full") return;

    const diff = await resolveGitDiff({
      gitService,
      mode: "files",
      files: canonicalFiles,
      emit: async () => undefined,
      reviewId: "seed-canonical-files",
    });
    expect(diff.ok).toBe(true);
    if (!diff.ok) return;
    expect(diff.value.files.map((file) => file.filePath)).toEqual(["src/index.ts"]);

    const reviewDefaults = resolveReviewDefaults({});
    const reviewConfigKey = buildReviewConfigKey({
      lenses: reviewDefaults.activeLenses,
      profile: reviewDefaults.effectiveProfileId,
      minSeverity: reviewDefaults.severityFilter?.minSeverity,
      executionFingerprint: aiClient.executionFingerprint,
    });
    const reviewInputHash = buildReviewInputHash({
      headCommit: headCommitResult.value,
      reviewConfigKey,
      parsed: diff.value,
    });

    const seedReviewId = "seeded-canonical-session";
    const seededSession = createSession(seedReviewId, {
      projectPath: repository,
      headCommit: headCommitResult.value,
      statusHash: statusHashResult.hash,
      statusHashKind: "full",
      mode: "files",
      scopeKey: buildScopeKey({ files: canonicalFiles }),
      reviewConfigKey,
      reviewInputHash,
      provider: aiClient.provider,
    });
    trackedSessionIds.add(seedReviewId);
    markReady(seedReviewId);

    const result = await createReviewSession(aiClient, {
      mode: secondRequest.mode ?? "unstaged",
      files: secondRequest.files,
      projectPath: repository,
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.reviewId).toBe(seedReviewId);
    expect(result.value.session).toBe(seededSession);
  });
});

describe(".diffgazer rename destination identity", () => {
  const repositories: string[] = [];
  const sessionIds: string[] = [];

  afterEach(() => {
    for (const sessionId of sessionIds.splice(0)) {
      deleteSession(sessionId);
    }
    for (const repository of repositories.splice(0)) {
      rmSync(repository, { recursive: true, force: true });
    }
  });

  function createRepository(initialPath: string) {
    const repository = mkdtempSync(join(tmpdir(), "diffgazer-review-rename-"));
    repositories.push(repository);
    const runGit = (...args: string[]) =>
      execFileSync("git", args, { cwd: repository, encoding: "utf8", stdio: "pipe" });
    runGit("init", "--quiet", "--initial-branch=main");
    runGit("config", "user.name", "Diffgazer Test");
    runGit("config", "user.email", "diffgazer@example.invalid");
    mkdirSync(join(repository, dirname(initialPath)), { recursive: true });
    writeFileSync(join(repository, initialPath), "before\n");
    runGit("add", "--", initialPath);
    runGit("commit", "--quiet", "-m", "fixture");
    return { repository, runGit };
  }

  function cacheActiveSession(projectPath: string, headCommit: string, statusHash: string) {
    const reviewId = `rename-session-${sessionIds.length + 1}`;
    sessionIds.push(reviewId);
    const session = createSession(reviewId, {
      projectPath,
      headCommit,
      statusHash,
      statusHashKind: "full",
      mode: "staged",
    });
    markReady(reviewId);
    return session;
  }

  function getCachedSession(projectPath: string, headCommit: string, statusHash: string) {
    return getActiveSessionForProject(projectPath, {
      headCommit,
      statusHash,
      statusHashKind: "full",
      mode: "staged",
    });
  }

  it("rekeys an active session when an internal-to-external rename changes content", async () => {
    const source = ".diffgazer/context.ts";
    const destination = "src/context.ts";
    const { repository, runGit } = createRepository(source);
    mkdirSync(join(repository, "src"), { recursive: true });
    renameSync(join(repository, source), join(repository, destination));
    runGit("add", "-A");
    const gitService = createGitService({ cwd: repository });

    const status = await gitService.getStatus();
    expect(status.ok && status.value.files.staged).toContainEqual(
      expect.objectContaining({ path: destination, previousPath: source }),
    );

    const firstHash = await gitService.getStatusHash();
    expect(firstHash.kind).toBe("full");
    expect(firstHash.kind === "full" ? firstHash.hash : "").not.toBe("");
    const headCommit = runGit("rev-parse", "HEAD").trim();
    if (firstHash.kind !== "full") return;
    const firstSession = cacheActiveSession(repository, headCommit, firstHash.hash);
    expect(getCachedSession(repository, headCommit, firstHash.hash)).toBe(firstSession);

    const diff = await resolveGitDiff({
      gitService,
      mode: "staged",
      emit: async () => undefined,
      reviewId: "rename-to-external",
    });
    expect(diff.ok && diff.value.files.map((file) => file.filePath)).toEqual([destination]);

    writeFileSync(join(repository, destination), "before\nafter\n");
    runGit("add", "--", destination);
    const nextHash = await gitService.getStatusHash();
    expect(nextHash.kind).toBe("full");
    if (nextHash.kind !== "full") return;
    expect(nextHash.hash).not.toBe(firstHash.hash);
    expect(getCachedSession(repository, headCommit, nextHash.hash)).toBeUndefined();

    cancelStaleSessionsForProjectMode(repository, "staged", headCommit, nextHash.hash, "full");
    expect(firstSession.isComplete).toBe(true);

    const nextSession = cacheActiveSession(repository, headCommit, nextHash.hash);
    expect(getCachedSession(repository, headCommit, nextHash.hash)).toBe(nextSession);
    expect(getCachedSession(repository, headCommit, firstHash.hash)).toBeUndefined();
  });

  it("keeps an external-to-internal rename excluded from review and session identity", async () => {
    const source = "src/context.ts";
    const destination = ".diffgazer/context.ts";
    const { repository, runGit } = createRepository(source);
    mkdirSync(join(repository, ".diffgazer"), { recursive: true });
    renameSync(join(repository, source), join(repository, destination));
    runGit("add", "-A");
    const gitService = createGitService({ cwd: repository });

    const status = await gitService.getStatus();
    expect(status.ok && status.value.files.staged).toEqual([]);
    expect(await gitService.getStatusHash()).toEqual({ kind: "full", hash: "" });
    const headCommit = runGit("rev-parse", "HEAD").trim();
    const session = cacheActiveSession(repository, headCommit, "");

    const diff = await resolveGitDiff({
      gitService,
      mode: "staged",
      emit: async () => undefined,
      reviewId: "rename-to-internal",
    });
    expect(diff).toMatchObject({ ok: false, error: { code: ReviewErrorCode.NO_DIFF } });

    writeFileSync(join(repository, destination), "before\nignored change\n");
    expect(await gitService.getStatusHash()).toEqual({ kind: "full", hash: "" });
    expect(getCachedSession(repository, headCommit, "")).toBe(session);
  });
});
