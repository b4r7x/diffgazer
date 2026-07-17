import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { err, ok } from "@diffgazer/core/result";
import type { SettingsConfig } from "@diffgazer/core/schemas/config";
import type { FullReviewStreamEvent } from "@diffgazer/core/schemas/events";
import { LENS_IDS, ReviewErrorCode } from "@diffgazer/core/schemas/review";
import { createDeferred } from "@diffgazer/core/testing/deferred";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createGitService } from "../../shared/lib/git/service.js";
import { makeFileDiff, makeIssue, makeParsedDiff } from "../../shared/lib/testing/factories.js";
import { filterDiffByFiles, resolveGitDiff } from "./diff.js";

const saveReview = vi.fn();
// Boundary mock: filesystem storage - saveReview is the durable-write boundary finalizeReview gates the report step on.
vi.mock("./storage/reviews.js", () => ({
  saveReview: (...args: unknown[]) => saveReview(...args),
}));

import { executeReview, finalizeReview, resolveReviewDefaults } from "./pipeline.js";
import {
  addEvent,
  cancelSessionForUser,
  cleanupStaleSessions,
  createSession,
  deleteSession,
  getSession,
} from "./stream/store.js";

function makePipelineFile(filePath: string, additions = 1, deletions = 0) {
  return makeFileDiff({
    filePath,
    rawDiff: "",
    stats: { additions, deletions, sizeBytes: 100 },
  });
}

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

function makeGitService(diff: string): ReturnType<typeof createGitService> {
  return {
    getDiff: async () => ok(diff),
  } as ReturnType<typeof createGitService>;
}

const makePipelineIssue = (
  id: string,
  file: string,
  severity: "blocker" | "high" | "medium" | "low" | "nit",
) =>
  makeIssue({
    id,
    file,
    severity,
    title: `Issue ${id}`,
    rationale: "test",
    recommendation: "fix",
    symptom: "broken",
    whyItMatters: "matters",
    line_start: 1,
    line_end: 5,
  });

describe("structured git branch status", () => {
  const repositories: string[] = [];

  afterEach(() => {
    for (const repository of repositories.splice(0)) {
      rmSync(repository, { recursive: true, force: true });
    }
  });

  function createRepository(prefix: string): string {
    const repository = mkdtempSync(join(tmpdir(), prefix));
    repositories.push(repository);
    return repository;
  }

  function runGit(repository: string, ...args: string[]): string {
    return execFileSync("git", args, {
      cwd: repository,
      encoding: "utf8",
      stdio: "pipe",
    });
  }

  function configureAuthor(repository: string): void {
    runGit(repository, "config", "user.name", "Diffgazer Test");
    runGit(repository, "config", "user.email", "diffgazer@example.invalid");
  }

  function commitFile(repository: string, contents: string, message: string): void {
    writeFileSync(join(repository, "tracked.txt"), contents);
    runGit(repository, "add", "--", "tracked.txt");
    runGit(repository, "commit", "--quiet", "-m", message);
  }

  it("reports the named branch in a real unborn repository", async () => {
    const repository = createRepository("diffgazer-unborn-branch-");
    runGit(repository, "init", "--quiet", "--initial-branch=trunk");

    const result = await createGitService({ cwd: repository }).getStatus();

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.branch).toBe("trunk");
    expect(result.value.remoteBranch).toBeNull();
    expect(result.value.ahead).toBe(0);
    expect(result.value.behind).toBe(0);
  });

  it("represents a real detached HEAD without inventing a branch name", async () => {
    const repository = createRepository("diffgazer-detached-branch-");
    runGit(repository, "init", "--quiet", "--initial-branch=main");
    configureAuthor(repository);
    commitFile(repository, "base\n", "base");
    runGit(repository, "checkout", "--quiet", "--detach", "HEAD");

    const result = await createGitService({ cwd: repository }).getStatus();

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.branch).toBeNull();
    expect(result.value.remoteBranch).toBeNull();
  });

  it("reads structured upstream ahead and behind counts", async () => {
    const remote = createRepository("diffgazer-upstream-remote-");
    runGit(remote, "init", "--bare", "--quiet", "--initial-branch=main");

    const local = createRepository("diffgazer-upstream-local-");
    runGit(local, "init", "--quiet", "--initial-branch=main");
    configureAuthor(local);
    commitFile(local, "base\n", "base");
    runGit(local, "remote", "add", "origin", remote);
    runGit(local, "push", "--quiet", "--set-upstream", "origin", "main");

    const peerParent = createRepository("diffgazer-upstream-peer-");
    const peer = join(peerParent, "repository");
    runGit(peerParent, "clone", "--quiet", remote, peer);
    configureAuthor(peer);
    commitFile(peer, "base\npeer\n", "peer");
    runGit(peer, "push", "--quiet", "origin", "main");

    commitFile(local, "base\nlocal\n", "local");
    runGit(local, "fetch", "--quiet", "origin");

    const result = await createGitService({ cwd: local }).getStatus();

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.branch).toBe("main");
    expect(result.value.remoteBranch).toBe("origin/main");
    expect(result.value.ahead).toBe(1);
    expect(result.value.behind).toBe(1);
  });
});

describe("resolveReviewDefaults", () => {
  const baseSettings: SettingsConfig = {
    theme: "auto",
    secretsStorage: null,
    defaultLenses: ["correctness", "security"],
    defaultProfile: null,
    severityThreshold: "low",
    agentExecution: "sequential",
  };

  it("applies defaultProfile from settings when no explicit profile is provided", () => {
    const defaults = resolveReviewDefaults({
      settings: { ...baseSettings, defaultProfile: "strict" },
    });

    expect(defaults.effectiveProfileId).toBe("strict");
    expect(defaults.activeLenses).toEqual(["correctness", "security", "tests"]);
  });

  it("applies severityThreshold from settings when the profile filter is looser", () => {
    const defaults = resolveReviewDefaults({
      settings: { ...baseSettings, defaultProfile: "perf", severityThreshold: "high" },
    });

    expect(defaults.severityFilter).toEqual({ minSeverity: "high" });
  });

  it("deduplicates default lenses before review orchestration", () => {
    const defaults = resolveReviewDefaults({
      settings: {
        ...baseSettings,
        defaultLenses: ["correctness", "correctness", "correctness"],
      },
    });

    expect(defaults.activeLenses).toEqual(["correctness"]);
  });

  it("deduplicates explicit lenses in first-seen order and keeps at most the closed lens set", () => {
    const defaults = resolveReviewDefaults({
      lensIds: [
        "tests",
        "security",
        "correctness",
        "tests",
        "performance",
        "simplicity",
        "security",
      ],
      settings: baseSettings,
    });

    expect(defaults.activeLenses).toEqual([
      "tests",
      "security",
      "correctness",
      "performance",
      "simplicity",
    ]);
    expect(defaults.activeLenses).toHaveLength(LENS_IDS.length);
  });

  it("captures execution concurrency with the resolved defaults", () => {
    const defaults = resolveReviewDefaults({
      settings: { ...baseSettings, agentExecution: "parallel" },
    });

    expect(defaults.concurrency).toBe(defaults.activeLenses.length);
  });
});

describe("filterDiffByFiles", () => {
  const parsed = makeParsedDiff([
    makePipelineFile("src/index.ts"),
    makePipelineFile("src/utils.ts"),
    makePipelineFile("README.md"),
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

describe("resolveGitDiff", () => {
  it("emits review_started after file filtering", async () => {
    const events: unknown[] = [];

    const result = await resolveGitDiff({
      gitService: makeGitService(TWO_FILE_DIFF),
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
      gitService: makeGitService(TWO_FILE_DIFF),
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

describe("executeReview", () => {
  it("preserves a classified orchestration error instead of collapsing it to AI_ERROR", async () => {
    const result = await executeReview({
      aiClient: {
        provider: "openrouter",
        generate: async () => err({ code: "MODEL_ERROR", message: "not called" }),
      },
      parsed: makeParsedDiff([]),
      config: {
        activeLenses: ["correctness"],
        effectiveProfileId: undefined,
        profile: undefined,
        severityFilter: undefined,
        concurrency: 1,
        projectContext: "",
      },
      emit: async () => undefined,
    });

    expect(result).toMatchObject({
      ok: false,
      error: { code: "NO_DIFF", step: "review" },
    });
  });
});

describe("finalizeReview", () => {
  const auxiliarySessionIds = new Set<string>();

  afterEach(() => {
    saveReview.mockReset();
    deleteSession("review-1");
    for (const reviewId of auxiliarySessionIds) deleteSession(reviewId);
    auxiliarySessionIds.clear();
  });

  function runFinalize(
    events: FullReviewStreamEvent[],
    onEmit?: (event: FullReviewStreamEvent) => void,
    monotonicNow?: () => number,
  ) {
    const session = createSession("review-1", {
      projectPath: "/project",
      headCommit: "snapshot-head",
      statusHash: "status",
      statusHashKind: "full",
      mode: "unstaged",
      ...(monotonicNow ? { monotonicNow } : {}),
    });
    return finalizeReview({
      outcome: { issues: [makePipelineIssue("1", "a.ts", "high")] },
      emit: async (event) => {
        events.push(event);
        addEvent("review-1", event);
        onEmit?.(event);
      },
      reviewId: "review-1",
      projectPath: "/project",
      mode: "unstaged",
      parsed: makeParsedDiff([makePipelineFile("a.ts")]),
      activeLenses: ["correctness"],
      durationMs: 42.5,
      branch: "snapshot-branch",
      headCommit: "snapshot-head",
      signal: session.controller.signal,
    });
  }

  function stepNames(events: FullReviewStreamEvent[], type: string): string[] {
    return events
      .filter(
        (e): e is Extract<FullReviewStreamEvent, { type: "step_start" | "step_complete" }> =>
          e.type === type && "step" in e,
      )
      .map((e) => e.step);
  }

  it("aborts with INTERNAL_ERROR and emits no report-complete when the save fails", async () => {
    saveReview.mockResolvedValue(err({ code: "WRITE_ERROR", message: "disk full" }));
    const events: FullReviewStreamEvent[] = [];

    const result = await runFinalize(events);

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toMatchObject({ kind: "review_abort", code: "INTERNAL_ERROR" });
    // The report step starts, but a save failure must never complete it — so the
    // client's View Results gate (and the absence of a terminal complete) holds.
    expect(stepNames(events, "step_start")).toContain("report");
    expect(stepNames(events, "step_complete")).not.toContain("report");
  });

  it("completes the report step only after a successful save", async () => {
    let savedBeforeReportComplete = false;
    saveReview.mockImplementation(async () => {
      // At save time the report step has started but must not yet be complete.
      savedBeforeReportComplete = capturedEvents.every(
        (e) => !(e.type === "step_complete" && "step" in e && e.step === "report"),
      );
      return ok({ id: "review-1" });
    });
    const capturedEvents: FullReviewStreamEvent[] = [];

    const result = await runFinalize(capturedEvents);

    expect(result.ok).toBe(true);
    expect(savedBeforeReportComplete).toBe(true);
    expect(saveReview).toHaveBeenCalledWith(expect.objectContaining({ durationMs: 42.5 }));
    expect(saveReview).toHaveBeenCalledWith(
      expect.objectContaining({ branch: "snapshot-branch", commit: "snapshot-head" }),
    );
    expect(stepNames(capturedEvents, "step_complete")).toContain("report");
    expect(capturedEvents.filter((event) => event.type === "complete")).toHaveLength(1);
    expect(getSession("review-1")?.persistenceState).toBe("committed");
  });

  it("cancels before committing without saving a History entry", async () => {
    const events: FullReviewStreamEvent[] = [];

    const finalizing = runFinalize(events, (event) => {
      if (event.type === "step_start" && event.step === "report") {
        expect(cancelSessionForUser("review-1")).toBe("cancelled");
      }
    });

    await expect(finalizing).rejects.toBe("user_cancelled");
    expect(saveReview).not.toHaveBeenCalled();
    expect(getSession("review-1")?.events).toMatchObject([
      { type: "step_start", step: "report" },
      { type: "error", error: { code: ReviewErrorCode.CANCELLED } },
    ]);
    expect(
      getSession("review-1")?.events.filter((event) => event.type === "complete"),
    ).toHaveLength(0);
  });

  it("does not cancel after committing starts and emits one committed terminal outcome", async () => {
    const save = createDeferred<ReturnType<typeof ok<{ id: string }>>>();
    saveReview.mockReturnValue(save.promise);
    const events: FullReviewStreamEvent[] = [];
    const cancellationResults: string[] = [];

    const finalizing = runFinalize(events, (event) => {
      if (event.type === "step_complete" && event.step === "report") {
        cancellationResults.push(cancelSessionForUser("review-1"));
      }
    });
    await vi.waitFor(() => expect(saveReview).toHaveBeenCalledTimes(1));

    expect(getSession("review-1")?.persistenceState).toBe("committing");
    expect(cancelSessionForUser("review-1")).toBe("already-committed");
    expect(getSession("review-1")?.events.filter((event) => event.type === "error")).toHaveLength(
      0,
    );

    save.resolve(ok({ id: "review-1" }));
    await expect(finalizing).resolves.toMatchObject({ ok: true });

    expect(cancellationResults).toEqual(["already-committed"]);
    const terminalEvents = events.filter(
      (event) => event.type === "complete" || event.type === "error",
    );
    expect(terminalEvents).toHaveLength(1);
    expect(terminalEvents[0]).toMatchObject({ type: "complete", reviewId: "review-1" });
    expect(getSession("review-1")).toMatchObject({
      isComplete: true,
      persistenceState: "committed",
    });
  });

  it("keeps a committing save addressable under eviction pressure", async () => {
    const save = createDeferred<ReturnType<typeof ok<{ id: string }>>>();
    saveReview.mockReturnValue(save.promise);
    const events: FullReviewStreamEvent[] = [];
    const finalizing = runFinalize(events);
    await vi.waitFor(() => expect(saveReview).toHaveBeenCalledTimes(1));

    for (let index = 0; index < 50; index += 1) {
      const reviewId = `pressure-${index}`;
      auxiliarySessionIds.add(reviewId);
      createSession(reviewId, {
        projectPath: "/project",
        headCommit: "snapshot-head",
        statusHash: `status-${index}`,
        statusHashKind: "full",
        mode: "unstaged",
      });
    }

    expect(getSession("review-1")).toMatchObject({ persistenceState: "committing" });
    expect(getSession("review-1")?.events.filter((event) => event.type === "error")).toHaveLength(
      0,
    );
    expect(getSession("pressure-0")).toBeUndefined();

    save.resolve(ok({ id: "review-1" }));
    await expect(finalizing).resolves.toMatchObject({ ok: true });

    expect(saveReview).toHaveBeenCalledTimes(1);
    expect(events.filter((event) => event.type === "complete")).toHaveLength(1);
    expect(events.filter((event) => event.type === "error")).toHaveLength(0);
    expect(getSession("review-1")?.persistenceState).toBe("committed");
  });

  it("keeps a committing save addressable past the idle timeout", async () => {
    let activityTick = 0;
    const save = createDeferred<ReturnType<typeof ok<{ id: string }>>>();
    saveReview.mockReturnValue(save.promise);
    const events: FullReviewStreamEvent[] = [];
    const finalizing = runFinalize(events, undefined, () => activityTick);
    await vi.waitFor(() => expect(saveReview).toHaveBeenCalledTimes(1));

    activityTick = 30 * 60 * 1000 + 1;
    cleanupStaleSessions();

    expect(getSession("review-1")).toMatchObject({ persistenceState: "committing" });
    expect(events.filter((event) => event.type === "error")).toHaveLength(0);

    save.resolve(ok({ id: "review-1" }));
    await expect(finalizing).resolves.toMatchObject({ ok: true });

    expect(saveReview).toHaveBeenCalledTimes(1);
    expect(events.filter((event) => event.type === "complete")).toHaveLength(1);
    expect(events.filter((event) => event.type === "error")).toHaveLength(0);
    expect(getSession("review-1")?.persistenceState).toBe("committed");
  });
});
