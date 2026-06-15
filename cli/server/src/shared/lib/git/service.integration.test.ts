import { execFile } from "node:child_process";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
// No node:child_process mock here: this exercises safeEnv() against the REAL git
// CLI so a regression to F-001 (blanked GIT_DIR → `fatal: not a git repository: ''`)
// is caught end-to-end.
import { createGitService } from "./service.js";

const execFileAsync = promisify(execFile);

describe("createGitService (un-mocked git integration)", () => {
  let repoDir: string;

  beforeEach(async () => {
    repoDir = await mkdtemp(join(tmpdir(), "dg-git-"));
    await execFileAsync("git", ["init", "-q"], { cwd: repoDir });
    await execFileAsync("git", ["config", "user.email", "test@test.dev"], { cwd: repoDir });
    await execFileAsync("git", ["config", "user.name", "Test"], { cwd: repoDir });
  });

  afterEach(async () => {
    await rm(repoDir, { recursive: true, force: true });
  });

  it("runs real `git status` through safeEnv() even when GIT_DIR pollutes the parent env", async () => {
    await writeFile(join(repoDir, "file.ts"), "const x = 1;\n");
    await execFileAsync("git", ["add", "file.ts"], { cwd: repoDir });

    // A blanked (rather than deleted) GIT_DIR is exactly the F-001 break: git
    // reads it as an explicit git dir of '' and exits 128. safeEnv() must strip
    // the polluted parent value, so the service's status call still succeeds.
    process.env.GIT_DIR = "/some/polluted/git/dir";
    try {
      const git = createGitService({ cwd: repoDir });
      const result = await git.getStatus();

      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.value.isGitRepo).toBe(true);
      expect(result.value.files.staged.some((f) => f.path === "file.ts")).toBe(true);
    } finally {
      delete process.env.GIT_DIR;
    }
  });
});
