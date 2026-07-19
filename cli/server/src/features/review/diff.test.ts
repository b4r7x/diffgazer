import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { err, ok } from "@diffgazer/core/result";
import {
  LENS_IDS,
  LensReviewResultSchema,
  MAX_REVIEW_ISSUES,
  MAX_REVIEW_ISSUES_PER_LENS,
  ReviewErrorCode,
  type ReviewIssue,
  ReviewResultSchema,
} from "@diffgazer/core/schemas/review";
import { makeIssue } from "@diffgazer/core/testing/factories";
import { afterEach, describe, expect, it } from "vitest";
import { createGitService } from "../../shared/lib/git/service.js";
import { makeParsedDiff } from "../../shared/lib/testing/factories.js";
import { MAX_DIFF_SIZE_BYTES, resolveGitDiff } from "./diff.js";
import {
  createIssueEvidenceResolver,
  MAX_SYNTHESIZED_EVIDENCE_JSON_BYTES,
  MAX_SYNTHESIZED_EVIDENCE_JSON_BYTES_PER_REVIEW,
  MAX_SYNTHESIZED_EVIDENCE_LINES,
} from "./engine/issues.js";
import { CreateReviewBodySchema } from "./schemas.js";
import { lenientReadSavedReview } from "./storage/lenient-read.js";
import {
  buildScopeKey,
  cancelStaleSessionsForProjectMode,
  createSession,
  deleteSession,
  getActiveSessionForProject,
  markReady,
} from "./stream/store.js";

type GitService = ReturnType<typeof createGitService>;

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

function makeNearLimitSingleLineDiff(): string {
  const prefix = [
    "diff --git a/src/large.ts b/src/large.ts",
    "index 1111111..2222222 100644",
    "--- a/src/large.ts",
    "+++ b/src/large.ts",
    "@@ -1 +1 @@",
    "-old",
    "+",
  ].join("\n");
  const suffix = "\n";
  const lineBytes =
    MAX_DIFF_SIZE_BYTES - Buffer.byteLength(prefix, "utf8") - Buffer.byteLength(suffix, "utf8");
  return `${prefix}${"\\".repeat(lineBytes)}${suffix}`;
}

function serializedEvidenceExcerptBytes(issues: ReviewIssue[]): number {
  const evidence = issues.map((issue) => issue.evidence);
  const withoutExcerpts = evidence.map((refs) =>
    refs.map((reference) => ({ ...reference, excerpt: "" })),
  );
  return (
    Buffer.byteLength(JSON.stringify(evidence, null, 2), "utf8") -
    Buffer.byteLength(JSON.stringify(withoutExcerpts, null, 2), "utf8")
  );
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
});

describe("canonical file-scoped review identity", () => {
  it("canonicalizes aliases, duplicates, separators, dot segments, and permutations once", async () => {
    const requests = [
      ["src/index.ts", "./src/index.ts", "src\\index.ts", "src/./index.ts", "src/index.ts/"],
      ["src/./index.ts", "src/index.ts", "./src/index.ts"],
      ["src//index.ts", "src/index.ts"],
    ].map((files) => CreateReviewBodySchema.parse({ mode: "files", files }));

    expect(requests.map((request) => request.files)).toEqual([
      ["src/index.ts"],
      ["src/index.ts"],
      ["src/index.ts"],
    ]);

    const scopeKeys = requests.map((request) => buildScopeKey({ files: request.files }));
    expect(new Set(scopeKeys)).toHaveLength(1);
    const canonicalFiles = requests[0]?.files;
    const scopeKey = scopeKeys[0];
    expect(canonicalFiles).toEqual(["src/index.ts"]);
    expect(scopeKey).toBeTypeOf("string");
    if (!canonicalFiles || scopeKey === undefined) return;

    let receivedFiles: readonly string[] | undefined;
    const gitService = makeGitService(async (_mode, files) => {
      receivedFiles = files;
      return ok(SINGLE_FILE_DIFF);
    });
    const result = await resolveGitDiff({
      gitService,
      mode: "files",
      files: canonicalFiles,
      emit: async () => undefined,
      reviewId: "canonical-files",
    });

    expect(result.ok).toBe(true);
    expect(receivedFiles).toEqual(["src/index.ts"]);
    expect(result.ok && result.value.files.map((file) => file.filePath)).toEqual(["src/index.ts"]);

    const reviewId = "canonical-files-session";
    const session = createSession(reviewId, {
      projectPath: "/canonical-files",
      headCommit: "head",
      statusHash: "status",
      statusHashKind: "full",
      mode: "files",
      scopeKey,
    });
    try {
      markReady(reviewId);
      for (const scopeKey of scopeKeys) {
        expect(
          getActiveSessionForProject("/canonical-files", {
            headCommit: "head",
            statusHash: "status",
            statusHashKind: "full",
            mode: "files",
            scopeKey,
          }),
        ).toBe(session);
      }
    } finally {
      deleteSession(reviewId);
    }
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

describe("synthesized issue evidence envelope", () => {
  it("caps one lens and the closed five-lens final result without dropping aggregate findings", () => {
    const issue = makeIssue();
    const lensIssues = Array.from({ length: MAX_REVIEW_ISSUES_PER_LENS }, () => issue);
    const finalIssues = Array.from({ length: MAX_REVIEW_ISSUES }, () => issue);

    expect(MAX_REVIEW_ISSUES).toBe(LENS_IDS.length * MAX_REVIEW_ISSUES_PER_LENS);
    expect(LensReviewResultSchema.safeParse({ issues: lensIssues }).success).toBe(true);
    expect(LensReviewResultSchema.safeParse({ issues: [...lensIssues, issue] }).success).toBe(
      false,
    );
    expect(ReviewResultSchema.safeParse({ issues: finalIssues }).success).toBe(true);
    expect(ReviewResultSchema.safeParse({ issues: [...finalIssues, issue] }).success).toBe(false);

    const oversizedStoredIssues = [...finalIssues, issue];
    const legacyReview = lenientReadSavedReview({
      metadata: {
        id: "550e8400-e29b-41d4-a716-446655440000",
        projectPath: "/repo",
        createdAt: "2026-01-01T00:00:00.000Z",
        mode: "unstaged",
        branch: "main",
        profile: null,
        lenses: ["correctness"],
        issueCount: oversizedStoredIssues.length,
        fileCount: 1,
      },
      result: { summary: "legacy", issues: oversizedStoredIssues },
      gitContext: {
        branch: "main",
        commit: null,
        fileCount: 1,
        additions: 0,
        deletions: 0,
      },
    });
    expect(legacyReview?.item.result.issues).toHaveLength(oversizedStoredIssues.length);
    expect(legacyReview?.item.result).not.toHaveProperty("summary");
  });

  it("bounds a near-limit physical line once for 256 evidence-empty issues", async () => {
    const rawDiff = makeNearLimitSingleLineDiff();
    const diffResult = await resolveGitDiff({
      gitService: makeGitService(async () => ok(rawDiff)),
      mode: "unstaged",
      emit: async () => undefined,
      reviewId: "review-envelope",
    });

    expect(diffResult.ok).toBe(true);
    if (!diffResult.ok) return;
    expect(diffResult.value.totalStats.totalSizeBytes).toBe(MAX_DIFF_SIZE_BYTES);

    const hunk = diffResult.value.files[0]?.hunks[0];
    expect(hunk).toBeDefined();
    if (!hunk) return;
    const hunkContent = hunk.content;
    let hunkContentReads = 0;
    Object.defineProperty(hunk, "content", {
      configurable: true,
      enumerable: true,
      get: () => {
        hunkContentReads++;
        return hunkContent;
      },
    });

    const resolveEvidence = createIssueEvidenceResolver(diffResult.value);
    const issues = LensReviewResultSchema.parse({
      issues: Array.from({ length: MAX_REVIEW_ISSUES_PER_LENS }, (_, index) =>
        makeIssue({
          id: `issue-${index}`,
          file: "src/large.ts",
          line_start: 1,
          line_end: 1,
          evidence: [],
        }),
      ),
    }).issues;
    const processed = issues.map(resolveEvidence);

    const perIssueBytes = Math.max(
      ...processed.map((issue) => serializedEvidenceExcerptBytes([issue])),
    );
    const perLensBytes = serializedEvidenceExcerptBytes(processed);
    const perLensEnvelope = MAX_REVIEW_ISSUES_PER_LENS * MAX_SYNTHESIZED_EVIDENCE_JSON_BYTES;

    expect(hunkContentReads).toBe(1);
    expect(perIssueBytes).toBeLessThanOrEqual(MAX_SYNTHESIZED_EVIDENCE_JSON_BYTES);
    expect(perLensBytes).toBeLessThanOrEqual(perLensEnvelope);
    expect(MAX_SYNTHESIZED_EVIDENCE_JSON_BYTES_PER_REVIEW).toBe(LENS_IDS.length * perLensEnvelope);
    expect(processed[0]?.evidence[0]).toMatchObject({
      range: { start: 1, end: 1 },
    });
    expect(processed[0]?.evidence[0]?.excerpt.startsWith("\\")).toBe(true);
    expect(processed[0]?.evidence[0]?.excerpt).toMatch(/\[evidence truncated\]$/);
  }, 30_000);

  it("caps source lines while retaining the full evidence range", async () => {
    const rawDiff = [
      "diff --git a/src/many-lines.ts b/src/many-lines.ts",
      "new file mode 100644",
      "--- /dev/null",
      "+++ b/src/many-lines.ts",
      "@@ -0,0 +1,6 @@",
      ...Array.from({ length: 6 }, (_, index) => `+line-${index + 1}`),
      "",
    ].join("\n");
    const diffResult = await resolveGitDiff({
      gitService: makeGitService(async () => ok(rawDiff)),
      mode: "unstaged",
      emit: async () => undefined,
      reviewId: "review-lines",
    });

    expect(diffResult.ok).toBe(true);
    if (!diffResult.ok) return;
    const issue = makeIssue({
      file: "src/many-lines.ts",
      line_start: 1,
      line_end: 6,
      evidence: [],
    });
    const result = createIssueEvidenceResolver(diffResult.value)(issue);
    const evidence = result.evidence[0];

    expect(evidence?.range).toEqual({ start: 1, end: 6 });
    expect(evidence?.excerpt.split("\n")).toHaveLength(MAX_SYNTHESIZED_EVIDENCE_LINES);
    expect(evidence?.excerpt).toMatch(/\[evidence truncated\]$/);
    expect(serializedEvidenceExcerptBytes([result])).toBeLessThanOrEqual(
      MAX_SYNTHESIZED_EVIDENCE_JSON_BYTES,
    );
  });

  it("caps fallback rationale by line count and JSON byte size", () => {
    const rationale = Array.from({ length: 8 }, (_, index) => `rationale-${index + 1}`).join("\n");
    const issue = makeIssue({ file: "missing.ts", line_start: null, evidence: [], rationale });
    const result = createIssueEvidenceResolver(makeParsedDiff([]))(issue);
    const excerpt = result.evidence[0]?.excerpt;

    expect(excerpt).toBeDefined();
    if (excerpt === undefined) return;
    expect(excerpt.split("\n")).toHaveLength(MAX_SYNTHESIZED_EVIDENCE_LINES);
    expect(excerpt).toMatch(/\[evidence truncated\]$/);
    expect(Buffer.byteLength(JSON.stringify(excerpt), "utf8")).toBeLessThanOrEqual(
      MAX_SYNTHESIZED_EVIDENCE_JSON_BYTES,
    );
  });

  it("leaves provider-supplied evidence unchanged", () => {
    const excerpt = Array.from({ length: 8 }, (_, index) => `provider-${index + 1}`).join("\n");
    const issue = makeIssue({
      evidence: [
        {
          type: "code",
          title: "Provider evidence",
          sourceId: "provider",
          file: "src/provider.ts",
          excerpt,
        },
      ],
    });

    const result = createIssueEvidenceResolver(makeParsedDiff([]))(issue);

    expect(result).toBe(issue);
    expect(result.evidence[0]?.excerpt).toBe(excerpt);
    expect(result.evidence[0]?.excerpt.split("\n")).toHaveLength(8);
  });
});
