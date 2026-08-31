import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { ok } from "@diffgazer/core/result";
import { ReviewErrorCode } from "@diffgazer/core/schemas/review";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import type { z } from "zod";
import type { InitializedAIClient } from "../../shared/lib/ai/client/initialize.js";
import { createGitService } from "../../shared/lib/git/service.js";
import { LARGE_DIFF_ADVISORY_BYTES } from "./capacity.js";
import { resolveGitDiff } from "./diff.js";
import { resolveReviewDefaults } from "./pipeline.js";
import { CreateReviewBodySchema } from "./schemas.js";
import { buildReviewInputHash, createReviewSession } from "./service.js";
import { buildReviewConfigKey, buildScopeKey } from "./stream/scope-keys.js";
import {
  cancelStaleSessionsForProjectMode,
  createSession,
  deleteSessionForTests,
  getActiveSessionForProject,
  getSession,
  markReady,
} from "./stream/store.js";
import { drainReviewWrites } from "./testing/storage-drain.js";

// `storage/project-index.ts` freezes REVIEWS_DIR from DIFFGAZER_HOME the first time it is
// imported, and this file pulls it in transitively at module scope. A beforeAll would run
// far too late: the reviews these tests save would already be bound to — and land in — the
// developer's real ~/.diffgazer. vi.hoisted runs before the static imports evaluate.
const tempHome = await vi.hoisted(async () =>
  (await import("../../shared/lib/testing/temp-home.js")).claimTempHome(
    "diffgazer-review-session-identity-home-",
  ),
);

// The migration writes are fire-and-forget, so they are settled before `release` removes
// the temp home and restores DIFFGAZER_HOME.
afterAll(async () => {
  await drainReviewWrites(tempHome.path);
  await tempHome.release();
});

describe("createReviewSession canonical file-scoped identity", () => {
  let repository: string;
  const trackedSessionIds = new Set<string>();
  const sessionsWithRunners = new Set<string>();

  function makeAIClient(): InitializedAIClient {
    const generate: InitializedAIClient["generate"] = async <T extends z.ZodType>(
      _prompt: string,
      schema: T,
    ) => ok({ data: schema.parse({ issues: [] }) });

    return {
      provider: "openrouter",
      terminalExecutions: [],
      terminalDiagnostics: [],
      generate,
    };
  }

  beforeAll(async () => {
    // Proves the hoisted temp home won the race against the module-scope import above:
    // a real-home REVIEWS_DIR means every review this suite saves escapes to ~/.diffgazer.
    const { REVIEWS_DIR } = await import("./storage/project-index.js");
    expect(REVIEWS_DIR).toBe(join(tempHome.path, "triage-reviews"));

    writeFileSync(
      join(tempHome.path, "config.json"),
      JSON.stringify({
        schemaVersion: 2,
        settings: { defaultLenses: ["correctness"], agentExecution: "sequential" },
        selectedConfigurationId: null,
        configurations: [],
      }),
    );
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
    // These runners drive real git and a real review save, so the default 1s
    // waitFor budget is not enough when the suite runs under load.
    await vi.waitFor(
      () => {
        for (const id of sessionsWithRunners) {
          const session = getSession(id);
          if (session && !session.isComplete) throw new Error(`session ${id} not yet complete`);
        }
      },
      { timeout: 8_000 },
    );
    for (const id of trackedSessionIds) {
      deleteSessionForTests(id);
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

  it("starts a large review with an advisory on the response and on the stream", async () => {
    writeFileSync(
      join(repository, "src/index.ts"),
      `before\n${"const padding = 'x'.repeat(64);\n".repeat(20_000)}`,
    );

    const result = await createReviewSession(makeAIClient(), {
      mode: "unstaged",
      projectPath: repository,
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    trackedSessionIds.add(result.value.reviewId);
    sessionsWithRunners.add(result.value.reviewId);

    expect(result.value.outcome).toBe("running");
    const warningEvent = result.value.session.events.find(
      (event) => event.type === "review_size_warning",
    );
    expect(warningEvent?.warning.diffBytes).toBeGreaterThan(LARGE_DIFF_ADVISORY_BYTES);
    expect(warningEvent?.warning.estimatedInputTokens).toBeGreaterThan(0);
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
    const { getStore } = await import("../../shared/lib/config/store.js");
    const settingsResult = await getStore().readSettings();
    if (!settingsResult.ok) throw new Error(settingsResult.error.message);
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

    const reviewDefaults = resolveReviewDefaults({ settings: settingsResult.value });
    const reviewConfigKey = buildReviewConfigKey({
      lenses: reviewDefaults.activeLenses,
      profile: reviewDefaults.effectiveProfileId,
      minSeverity: reviewDefaults.severityFilter?.minSeverity,
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
      deleteSessionForTests(sessionId);
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
