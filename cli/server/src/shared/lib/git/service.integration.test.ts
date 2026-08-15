import { execFile } from "node:child_process";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
// No node:child_process mock here: this exercises safeEnv() against the REAL git
// CLI so a blanked-GIT_DIR regression (→ `fatal: not a git repository: ''`)
// is caught end-to-end.
import { createGitService } from "./service.js";

const execFileAsync = promisify(execFile);

describe("createGitService (un-mocked git integration)", () => {
  let repoDir: string;

  beforeEach(async () => {
    repoDir = await mkdtemp(join(tmpdir(), "dg-git-"));
    await execFileAsync("git", ["init", "-q"], { cwd: repoDir });
    // safeEnv() deletes GIT_CONFIG_GLOBAL/GIT_CONFIG_SYSTEM, so the contributor's
    // ~/.gitconfig can only be neutralized in this repo's local config.
    await execFileAsync("git", ["config", "user.email", "test@test.dev"], { cwd: repoDir });
    await execFileAsync("git", ["config", "user.name", "Test"], { cwd: repoDir });
    await execFileAsync("git", ["config", "commit.gpgsign", "false"], { cwd: repoDir });
    await execFileAsync("git", ["config", "status.renames", "true"], { cwd: repoDir });
    await execFileAsync("git", ["config", "core.hooksPath", join(repoDir, "absent-hooks")], {
      cwd: repoDir,
    });
  });

  afterEach(async () => {
    await rm(repoDir, { recursive: true, force: true });
  });

  it("runs real `git status` through safeEnv() even when GIT_DIR pollutes the parent env", async () => {
    await writeFile(join(repoDir, "file.ts"), "const x = 1;\n");
    await execFileAsync("git", ["add", "file.ts"], { cwd: repoDir });

    // A blanked (rather than deleted) GIT_DIR is exactly the break: git
    // reads it as an explicit git dir of '' and exits 128. safeEnv() must strip
    // the polluted parent value, so the service's status call still succeeds.
    const originalGitDir = process.env.GIT_DIR;
    process.env.GIT_DIR = "/some/polluted/git/dir";
    try {
      const git = createGitService({ cwd: repoDir });
      const result = await git.getStatus();

      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.value.isGitRepo).toBe(true);
      expect(result.value.files.staged.some((f) => f.path === "file.ts")).toBe(true);
    } finally {
      if (originalGitDir === undefined) {
        delete process.env.GIT_DIR;
      } else {
        process.env.GIT_DIR = originalGitDir;
      }
    }
  });

  it("classifies a non-repository through pinned English fatal text under a non-C locale", async () => {
    const outsideRepo = await mkdtemp(join(tmpdir(), "dg-git-outside-"));
    const originalLang = process.env.LANG;
    const originalLcAll = process.env.LC_ALL;
    process.env.LANG = "de_DE.UTF-8";
    process.env.LC_ALL = "de_DE.UTF-8";
    try {
      const git = createGitService({ cwd: outsideRepo });
      const result = await git.getStatus();
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.value.isGitRepo).toBe(false);
    } finally {
      if (originalLang === undefined) delete process.env.LANG;
      else process.env.LANG = originalLang;
      if (originalLcAll === undefined) delete process.env.LC_ALL;
      else process.env.LC_ALL = originalLcAll;
      await rm(outsideRepo, { recursive: true, force: true });
    }
  });
});
