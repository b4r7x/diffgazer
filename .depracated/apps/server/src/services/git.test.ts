import { describe, it, expect, vi, beforeEach } from "vitest";
import type { GitStatus } from "@repo/schemas/git";

const mockExecFileAsync = vi.hoisted(() => vi.fn());

vi.mock("node:util", async () => ({
  ...(await vi.importActual<object>("node:util")),
  promisify: () => mockExecFileAsync,
}));

let createGitService: typeof import("./git.js").createGitService;

describe("Git Service", () => {
  beforeEach(async () => {
    vi.resetModules();
    vi.clearAllMocks();
    const gitMod = await import("./git.js");
    createGitService = gitMod.createGitService;
  });

  describe("createGitService", () => {
    it("creates service with default options", () => {
      const service = createGitService();
      expect(service).toHaveProperty("getStatus");
      expect(service).toHaveProperty("getDiff");
      expect(service).toHaveProperty("isGitInstalled");
    });

    it("accepts custom cwd and timeout", () => {
      const service = createGitService({ cwd: "/custom/path", timeout: 5000 });
      expect(service).toHaveProperty("getStatus");
    });
  });

  describe("isGitInstalled", () => {
    it("returns true when git is installed", async () => {
      mockExecFileAsync.mockResolvedValue({ stdout: "git version 2.39.0", stderr: "" });

      const service = createGitService();
      const result = await service.isGitInstalled();
      expect(result).toBe(true);
      expect(mockExecFileAsync).toHaveBeenCalledWith(
        "git",
        ["--version"],
        expect.objectContaining({ timeout: 10000 })
      );
    });

    it("returns false when git is not installed", async () => {
      mockExecFileAsync.mockRejectedValue(new Error("ENOENT: git not found"));

      const service = createGitService();
      const result = await service.isGitInstalled();
      expect(result).toBe(false);
    });
  });

  describe("getStatus", () => {
    it("parses basic status with branch", async () => {
      const gitOutput = `## main
M  modified-file.ts
A  new-file.ts
D  deleted-file.ts`;

      mockExecFileAsync.mockResolvedValue({ stdout: gitOutput, stderr: "" });

      const service = createGitService();
      const status = await service.getStatus();

      expect(status.isGitRepo).toBe(true);
      expect(status.branch).toBe("main");
      expect(status.remoteBranch).toBeNull();
      expect(status.ahead).toBe(0);
      expect(status.behind).toBe(0);
      expect(status.hasChanges).toBe(true);
      expect(status.files.staged).toHaveLength(3);
      expect(status.files.unstaged).toHaveLength(0);
      expect(status.files.untracked).toHaveLength(0);
    });

    it("parses branch with remote tracking", async () => {
      const gitOutput = `## feature-branch...origin/feature-branch [ahead 2, behind 1]`;

      mockExecFileAsync.mockResolvedValue({ stdout: gitOutput, stderr: "" });

      const service = createGitService();
      const status = await service.getStatus();

      expect(status.branch).toBe("feature-branch");
      expect(status.remoteBranch).toBe("origin/feature-branch");
      expect(status.ahead).toBe(2);
      expect(status.behind).toBe(1);
    });

    it("parses untracked files", async () => {
      const gitOutput = `## main
?? untracked-file.ts
?? another-untracked.ts`;

      mockExecFileAsync.mockResolvedValue({ stdout: gitOutput, stderr: "" });

      const service = createGitService();
      const status = await service.getStatus();

      expect(status.files.untracked).toHaveLength(2);
      expect(status.files.untracked[0]?.path).toBe("untracked-file.ts");
      expect(status.files.untracked[0]?.indexStatus).toBe("?");
      expect(status.files.untracked[0]?.workTreeStatus).toBe("?");
      expect(status.hasChanges).toBe(true);
    });

    it("parses unstaged changes", async () => {
      const gitOutput = `## main
 M modified-unstaged.ts
 D deleted-unstaged.ts`;

      mockExecFileAsync.mockResolvedValue({ stdout: gitOutput, stderr: "" });

      const service = createGitService();
      const status = await service.getStatus();

      expect(status.files.unstaged).toHaveLength(2);
      expect(status.files.staged).toHaveLength(0);
      expect(status.files.unstaged[0]?.path).toBe("modified-unstaged.ts");
      expect(status.files.unstaged[0]?.indexStatus).toBe(" ");
      expect(status.files.unstaged[0]?.workTreeStatus).toBe("M");
    });

    it("parses mixed staged and unstaged changes", async () => {
      const gitOutput = `## main
MM both-modified.ts
M  staged-only.ts
 M unstaged-only.ts`;

      mockExecFileAsync.mockResolvedValue({ stdout: gitOutput, stderr: "" });

      const service = createGitService();
      const status = await service.getStatus();

      expect(status.files.staged).toHaveLength(2);
      expect(status.files.unstaged).toHaveLength(2);
    });

    it("parses conflicted files", async () => {
      const gitOutput = `## main
UU conflicted-file.ts
DU another-conflict.ts`;

      mockExecFileAsync.mockResolvedValue({ stdout: gitOutput, stderr: "" });

      const service = createGitService();
      const status = await service.getStatus();

      expect(status.conflicted).toHaveLength(2);
      expect(status.conflicted).toContain("conflicted-file.ts");
      expect(status.conflicted).toContain("another-conflict.ts");
    });

    it("parses renamed files", async () => {
      const gitOutput = `## main
R  old-name.ts -> new-name.ts`;

      mockExecFileAsync.mockResolvedValue({ stdout: gitOutput, stderr: "" });

      const service = createGitService();
      const status = await service.getStatus();

      expect(status.files.staged).toHaveLength(1);
      expect(status.files.staged[0]?.path).toBe("old-name.ts -> new-name.ts");
      expect(status.files.staged[0]?.indexStatus).toBe("R");
    });

    it("parses copied files", async () => {
      const gitOutput = `## main
C  original.ts -> copy.ts`;

      mockExecFileAsync.mockResolvedValue({ stdout: gitOutput, stderr: "" });

      const service = createGitService();
      const status = await service.getStatus();

      expect(status.files.staged).toHaveLength(1);
      expect(status.files.staged[0]?.indexStatus).toBe("C");
    });

    it("returns empty status when no changes", async () => {
      const gitOutput = `## main`;

      mockExecFileAsync.mockResolvedValue({ stdout: gitOutput, stderr: "" });

      const service = createGitService();
      const status = await service.getStatus();

      expect(status.hasChanges).toBe(false);
      expect(status.files.staged).toHaveLength(0);
      expect(status.files.unstaged).toHaveLength(0);
      expect(status.files.untracked).toHaveLength(0);
    });

    it("returns empty status on git error", async () => {
      mockExecFileAsync.mockRejectedValue(new Error("fatal: not a git repository"));

      const service = createGitService();
      const status = await service.getStatus();

      expect(status.isGitRepo).toBe(false);
      expect(status.branch).toBeNull();
      expect(status.hasChanges).toBe(false);
    });

    it("calls git status with correct args", async () => {
      mockExecFileAsync.mockResolvedValue({ stdout: "## main", stderr: "" });

      const service = createGitService({ cwd: "/test/project", timeout: 5000 });
      await service.getStatus();

      expect(mockExecFileAsync).toHaveBeenCalledWith(
        "git",
        ["status", "--porcelain=v1", "-b"],
        expect.objectContaining({
          cwd: "/test/project",
          timeout: 5000,
        })
      );
    });
  });

  describe("getDiff", () => {
    it("returns unstaged diff by default", async () => {
      const diffOutput = `diff --git a/file.ts b/file.ts
index 1234567..abcdefg 100644
--- a/file.ts
+++ b/file.ts
@@ -1,3 +1,3 @@
-old line
+new line`;

      mockExecFileAsync.mockResolvedValue({ stdout: diffOutput, stderr: "" });

      const service = createGitService();
      const diff = await service.getDiff();

      expect(diff).toBe(diffOutput);
      expect(mockExecFileAsync).toHaveBeenCalledWith(
        "git",
        ["diff"],
        expect.any(Object)
      );
    });

    it("returns staged diff when mode is 'staged'", async () => {
      const diffOutput = "staged diff content";

      mockExecFileAsync.mockResolvedValue({ stdout: diffOutput, stderr: "" });

      const service = createGitService();
      const diff = await service.getDiff("staged");

      expect(diff).toBe(diffOutput);
      expect(mockExecFileAsync).toHaveBeenCalledWith(
        "git",
        ["diff", "--cached"],
        expect.any(Object)
      );
    });

    it("calls git diff with maxBuffer for large diffs", async () => {
      mockExecFileAsync.mockResolvedValue({ stdout: "diff content", stderr: "" });

      const service = createGitService({ cwd: "/test/project", timeout: 5000 });
      await service.getDiff();

      expect(mockExecFileAsync).toHaveBeenCalledWith(
        "git",
        ["diff"],
        expect.objectContaining({
          cwd: "/test/project",
          timeout: 5000,
          maxBuffer: 5 * 1024 * 1024,
        })
      );
    });

    it("throws error on git failure", async () => {
      mockExecFileAsync.mockRejectedValue(new Error("git diff failed"));

      const service = createGitService();
      await expect(service.getDiff()).rejects.toThrow("git diff failed");
    });
  });

  describe("edge cases", () => {
    it("handles empty git output", async () => {
      mockExecFileAsync.mockResolvedValue({ stdout: "", stderr: "" });

      const service = createGitService();
      const status = await service.getStatus();

      expect(status.isGitRepo).toBe(true);
      expect(status.branch).toBeNull();
      expect(status.hasChanges).toBe(false);
    });

    it("handles branch name without remote info", async () => {
      const gitOutput = `## feature-branch`;

      mockExecFileAsync.mockResolvedValue({ stdout: gitOutput, stderr: "" });

      const service = createGitService();
      const status = await service.getStatus();

      expect(status.branch).toBe("feature-branch");
      expect(status.remoteBranch).toBeNull();
      expect(status.ahead).toBe(0);
      expect(status.behind).toBe(0);
    });

    it("handles branch ahead only", async () => {
      const gitOutput = `## main...origin/main [ahead 3]`;

      mockExecFileAsync.mockResolvedValue({ stdout: gitOutput, stderr: "" });

      const service = createGitService();
      const status = await service.getStatus();

      expect(status.ahead).toBe(3);
      expect(status.behind).toBe(0);
    });

    it("handles branch behind only", async () => {
      const gitOutput = `## main...origin/main [behind 2]`;

      mockExecFileAsync.mockResolvedValue({ stdout: gitOutput, stderr: "" });

      const service = createGitService();
      const status = await service.getStatus();

      expect(status.ahead).toBe(0);
      expect(status.behind).toBe(2);
    });

    it("handles malformed status lines", async () => {
      const gitOutput = `## main
M
XY invalid-file.ts`;

      mockExecFileAsync.mockResolvedValue({ stdout: gitOutput, stderr: "" });

      const service = createGitService();
      const status = await service.getStatus();

      expect(status.files.staged).toHaveLength(0);
      expect(status.files.unstaged).toHaveLength(0);
    });

    it("handles files with spaces in path", async () => {
      const gitOutput = `## main
M  file with spaces.ts
?? another file.ts`;

      mockExecFileAsync.mockResolvedValue({ stdout: gitOutput, stderr: "" });

      const service = createGitService();
      const status = await service.getStatus();

      expect(status.files.staged[0]?.path).toBe("file with spaces.ts");
      expect(status.files.untracked[0]?.path).toBe("another file.ts");
    });
  });
});
