import { execFileSync } from "node:child_process";
import { mkdtempSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createGitService } from "./service.js";

describe("createGitService with real git porcelain output", () => {
  let repo: string;

  beforeEach(() => {
    repo = mkdtempSync(join(tmpdir(), "diffgazer-git-status-"));
    runGit("init", "--quiet", "--initial-branch=main");
    runGit("config", "user.name", "Diffgazer Test");
    runGit("config", "user.email", "diffgazer@example.invalid");
  });

  afterEach(() => {
    rmSync(repo, { recursive: true, force: true });
  });

  function runGit(...args: string[]): string {
    return execFileSync("git", args, { cwd: repo, encoding: "utf8", stdio: "pipe" });
  }

  function commitFile(path: string) {
    writeFileSync(join(repo, path), "before\n");
    runGit("add", "--", path);
    runGit("commit", "--quiet", "-m", "fixture");
  }

  function commitAll(message: string) {
    runGit("add", "-A");
    runGit("commit", "--quiet", "-m", message);
  }

  async function readConflictedPaths() {
    const result = await createGitService({ cwd: repo }).getStatus();

    expect(result.ok).toBe(true);
    return result.ok ? result.value.conflicted : [];
  }

  it("preserves special bytes in a modified path", async () => {
    const path = 'notes -> "quoted" \\ tab\tżółć\nline.txt';
    commitFile(path);
    writeFileSync(join(repo, path), "after\n");

    const result = await createGitService({ cwd: repo }).getStatus();

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.files.unstaged).toContainEqual({
      path,
      indexStatus: " ",
      workTreeStatus: "M",
    });
  });

  it("keeps the destination and source order for a rename with special bytes", async () => {
    const source = 'old -> "quoted" \\ tab\tżółć\nsource.txt';
    const destination = 'new -> "quoted" \\ tab\t漢字\nend.txt';
    commitFile(source);
    renameSync(join(repo, source), join(repo, destination));
    runGit("add", "-A");

    const result = await createGitService({ cwd: repo }).getStatus();

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.files.staged).toContainEqual({
      path: destination,
      previousPath: source,
      indexStatus: "R",
      workTreeStatus: " ",
    });
  });

  it("reports a real both-added merge conflict", async () => {
    commitFile("base.txt");
    runGit("checkout", "--quiet", "-b", "theirs");
    writeFileSync(join(repo, "conflicted.txt"), "theirs\n");
    commitAll("theirs adds file");
    runGit("checkout", "--quiet", "main");
    writeFileSync(join(repo, "conflicted.txt"), "ours\n");
    commitAll("ours adds file");

    expect(() => runGit("merge", "--no-edit", "theirs")).toThrow();

    expect(await readConflictedPaths()).toContain("conflicted.txt");
    expect(runGit("status", "--porcelain=v1")).toContain("AA conflicted.txt");
  });

  it("reports a real both-modified merge conflict", async () => {
    commitFile("conflicted.txt");
    runGit("checkout", "--quiet", "-b", "theirs");
    writeFileSync(join(repo, "conflicted.txt"), "theirs\n");
    commitAll("theirs modifies file");
    runGit("checkout", "--quiet", "main");
    writeFileSync(join(repo, "conflicted.txt"), "ours\n");
    commitAll("ours modifies file");

    expect(() => runGit("merge", "--no-edit", "theirs")).toThrow();

    expect(await readConflictedPaths()).toContain("conflicted.txt");
    expect(runGit("status", "--porcelain=v1")).toContain("UU conflicted.txt");
  });

  it("reports a real both-deleted three-tree merge index", async () => {
    commitFile("conflicted.txt");
    const base = runGit("rev-parse", "HEAD").trim();

    runGit("checkout", "--quiet", "-b", "ours");
    rmSync(join(repo, "conflicted.txt"));
    writeFileSync(join(repo, "ours.txt"), "ours\n");
    commitAll("ours deletes file");
    const ours = runGit("rev-parse", "HEAD").trim();

    runGit("checkout", "--quiet", "-b", "theirs", base);
    rmSync(join(repo, "conflicted.txt"));
    writeFileSync(join(repo, "theirs.txt"), "theirs\n");
    commitAll("theirs deletes file");
    const theirs = runGit("rev-parse", "HEAD").trim();

    runGit("read-tree", "-m", base, ours, theirs);

    expect(await readConflictedPaths()).toContain("conflicted.txt");
    expect(runGit("status", "--porcelain=v1")).toContain("DD conflicted.txt");
  });
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

  function runGitIn(repository: string, ...args: string[]): string {
    return execFileSync("git", args, {
      cwd: repository,
      encoding: "utf8",
      stdio: "pipe",
    });
  }

  function configureAuthor(repository: string): void {
    runGitIn(repository, "config", "user.name", "Diffgazer Test");
    runGitIn(repository, "config", "user.email", "diffgazer@example.invalid");
  }

  function commitFile(repository: string, contents: string, message: string): void {
    writeFileSync(join(repository, "tracked.txt"), contents);
    runGitIn(repository, "add", "--", "tracked.txt");
    runGitIn(repository, "commit", "--quiet", "-m", message);
  }

  it("reports the named branch in a real unborn repository", async () => {
    const repository = createRepository("diffgazer-unborn-branch-");
    runGitIn(repository, "init", "--quiet", "--initial-branch=trunk");

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
    runGitIn(repository, "init", "--quiet", "--initial-branch=main");
    configureAuthor(repository);
    commitFile(repository, "base\n", "base");
    runGitIn(repository, "checkout", "--quiet", "--detach", "HEAD");

    const result = await createGitService({ cwd: repository }).getStatus();

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.branch).toBeNull();
    expect(result.value.remoteBranch).toBeNull();
  });

  it("reads structured upstream ahead and behind counts", async () => {
    const remote = createRepository("diffgazer-upstream-remote-");
    runGitIn(remote, "init", "--bare", "--quiet", "--initial-branch=main");

    const local = createRepository("diffgazer-upstream-local-");
    runGitIn(local, "init", "--quiet", "--initial-branch=main");
    configureAuthor(local);
    commitFile(local, "base\n", "base");
    runGitIn(local, "remote", "add", "origin", remote);
    runGitIn(local, "push", "--quiet", "--set-upstream", "origin", "main");

    const peerParent = createRepository("diffgazer-upstream-peer-");
    const peer = join(peerParent, "repository");
    runGitIn(peerParent, "clone", "--quiet", remote, peer);
    configureAuthor(peer);
    commitFile(peer, "base\npeer\n", "peer");
    runGitIn(peer, "push", "--quiet", "origin", "main");

    commitFile(local, "base\nlocal\n", "local");
    runGitIn(local, "fetch", "--quiet", "origin");

    const result = await createGitService({ cwd: local }).getStatus();

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.branch).toBe("main");
    expect(result.value.remoteBranch).toBe("origin/main");
    expect(result.value.ahead).toBe(1);
    expect(result.value.behind).toBe(1);
  });
});
