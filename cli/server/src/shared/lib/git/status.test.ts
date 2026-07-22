import { describe, expect, it } from "vitest";
import { parseGitStatusOutput, parseHashableStatusFiles } from "./status.js";

function porcelainOutput(...records: string[]): string {
  return records.length > 0 ? `${records.join("\0")}\0` : "";
}

describe("parseGitStatusOutput", () => {
  it("reports a clean repo with branch and remote tracking", () => {
    const parsed = parseGitStatusOutput(porcelainOutput("## main...origin/main"));

    expect(parsed.branch).toBe("main");
    expect(parsed.remoteBranch).toBe("origin/main");
    expect(parsed.ahead).toBe(0);
    expect(parsed.behind).toBe(0);
    expect(parsed.files.staged).toEqual([]);
    expect(parsed.files.unstaged).toEqual([]);
    expect(parsed.files.untracked).toEqual([]);
  });

  it.each([
    {
      scenario: "ahead and behind counts",
      output: ["## feature...origin/feature [ahead 3, behind 2]"],
      branch: "feature",
      remoteBranch: "origin/feature",
      ahead: 3,
      behind: 2,
    },
    {
      scenario: "only ahead count",
      output: ["## main...origin/main [ahead 5]"],
      branch: "main",
      remoteBranch: "origin/main",
      ahead: 5,
      behind: 0,
    },
    {
      scenario: "no remote tracking",
      output: ["## feature-branch"],
      branch: "feature-branch",
      remoteBranch: null,
      ahead: 0,
      behind: 0,
    },
  ])("parses branch header with $scenario", ({ output, branch, remoteBranch, ahead, behind }) => {
    const parsed = parseGitStatusOutput(porcelainOutput(...output));

    expect(parsed.branch).toBe(branch);
    expect(parsed.remoteBranch).toBe(remoteBranch);
    expect(parsed.ahead).toBe(ahead);
    expect(parsed.behind).toBe(behind);
  });

  it.each([
    {
      kind: "staged modified",
      output: ["## main", "M  src/file.ts"],
      path: "src/file.ts",
      indexStatus: "M",
    },
    {
      kind: "staged added",
      output: ["## main", "A  new-file.ts"],
      path: "new-file.ts",
      indexStatus: "A",
    },
    {
      kind: "staged deleted",
      output: ["## main", "D  old-file.ts"],
      path: "old-file.ts",
      indexStatus: "D",
    },
  ])("places $kind file in the staged bucket", ({ output, path, indexStatus }) => {
    const parsed = parseGitStatusOutput(porcelainOutput(...output));

    expect(parsed.files.staged).toHaveLength(1);
    expect(parsed.files.staged[0]?.path).toBe(path);
    expect(parsed.files.staged[0]?.indexStatus).toBe(indexStatus);
  });

  it("places worktree-only changes in the unstaged bucket", () => {
    const parsed = parseGitStatusOutput(porcelainOutput("## main", " M src/file.ts"));

    expect(parsed.files.unstaged).toHaveLength(1);
    expect(parsed.files.unstaged[0]?.path).toBe("src/file.ts");
    expect(parsed.files.unstaged[0]?.workTreeStatus).toBe("M");
  });

  it("places ?? files in the untracked bucket", () => {
    const parsed = parseGitStatusOutput(porcelainOutput("## main", "?? new-file.ts"));

    expect(parsed.files.untracked).toHaveLength(1);
    expect(parsed.files.untracked[0]?.path).toBe("new-file.ts");
  });

  it.each([
    ["DD", "both deleted"],
    ["AU", "added by us"],
    ["UD", "deleted by them"],
    ["UA", "added by them"],
    ["DU", "deleted by us"],
    ["AA", "both added"],
    ["UU", "both modified"],
  ])("reports %s (%s) entries as conflicted files", (status) => {
    const parsed = parseGitStatusOutput(porcelainOutput("## main", `${status} conflicted.ts`));

    expect(parsed.conflicted).toEqual(["conflicted.ts"]);
  });

  it("intentionally excludes .diffgazer conflicts while reporting external conflicts", () => {
    // .diffgazer is a server-managed cache dir, so its merge-conflict entries are
    // filtered out of conflicted alongside every other internal-path bucket.
    const parsed = parseGitStatusOutput(
      porcelainOutput("## main", "UU .diffgazer/state.json", "UU src/app.ts"),
    );

    expect(parsed.conflicted).toEqual(["src/app.ts"]);
  });

  it("splits mixed-status entries into the correct buckets", () => {
    const output = [
      "## main...origin/main",
      "M  staged.ts",
      " M unstaged.ts",
      "?? untracked.ts",
      "A  added.ts",
    ];
    const parsed = parseGitStatusOutput(porcelainOutput(...output));

    expect(parsed.files.staged).toHaveLength(2);
    expect(parsed.files.unstaged).toHaveLength(1);
    expect(parsed.files.untracked).toHaveLength(1);
  });

  it("reports no file changes for an empty porcelain output", () => {
    const parsed = parseGitStatusOutput(porcelainOutput());

    expect(parsed.files.staged).toEqual([]);
    expect(parsed.files.unstaged).toEqual([]);
    expect(parsed.files.untracked).toEqual([]);
    expect(parsed.branch).toBeNull();
  });

  it("ignores porcelain records shorter than the status prefix", () => {
    const parsed = parseGitStatusOutput(porcelainOutput("## main", "XY"));

    expect(parsed.files.staged).toEqual([]);
    expect(parsed.files.unstaged).toEqual([]);
  });

  it("preserves a non-ASCII porcelain path", () => {
    const parsed = parseGitStatusOutput(porcelainOutput("## main", " M żółć/plik.ts"));

    expect(parsed.files.unstaged[0]?.path).toBe("żółć/plik.ts");
  });

  it("parses a staged rename into path and previousPath", () => {
    const parsed = parseGitStatusOutput(porcelainOutput("## main", "R  new.txt", "old.txt"));

    expect(parsed.files.staged[0]).toMatchObject({
      path: "new.txt",
      previousPath: "old.txt",
      indexStatus: "R",
      workTreeStatus: " ",
    });
  });

  it("parses a rename with spaces", () => {
    const parsed = parseGitStatusOutput(porcelainOutput("## main", "R  c d.txt", "a b.txt"));

    expect(parsed.files.staged[0]?.path).toBe("c d.txt");
    expect(parsed.files.staged[0]?.previousPath).toBe("a b.txt");
  });

  it("preserves a leading/trailing space in a filename", () => {
    const parsed = parseGitStatusOutput(porcelainOutput("## main", " M  report .md "));

    expect(parsed.files.unstaged[0]?.path).toBe(" report .md ");
  });

  it("preserves a leading/trailing space in a rename's paths", () => {
    const parsed = parseGitStatusOutput(porcelainOutput("## main", "R  new.txt ", " old.txt"));

    expect(parsed.files.staged[0]?.path).toBe("new.txt ");
    expect(parsed.files.staged[0]?.previousPath).toBe(" old.txt");
  });

  it("excludes a .diffgazer non-ASCII path from status results", () => {
    const parsed = parseGitStatusOutput(
      porcelainOutput("## main", " M .diffgazer/ż.json", " M src/app.ts"),
    );

    expect(parsed.files.unstaged).toHaveLength(1);
    expect(parsed.files.unstaged[0]?.path).toBe("src/app.ts");
  });

  it("excludes .diffgazer/ files from status results", () => {
    const parsed = parseGitStatusOutput(
      porcelainOutput("## main", "?? .diffgazer/project.json", " M src/app.ts"),
    );

    expect(parsed.files.untracked).toHaveLength(0);
    expect(parsed.files.unstaged).toHaveLength(1);
    expect(parsed.files.unstaged[0]?.path).toBe("src/app.ts");
  });

  it("omits .diffgazer-only changes from all buckets", () => {
    const parsed = parseGitStatusOutput(
      porcelainOutput("## main", "?? .diffgazer/context.md", "A  .diffgazer/project.json"),
    );

    expect(parsed.files.staged).toHaveLength(0);
    expect(parsed.files.untracked).toHaveLength(0);
  });

  it("keeps non-.diffgazer files with similar names", () => {
    const parsed = parseGitStatusOutput(
      porcelainOutput("## main", "?? .diffgazer-backup/config.json"),
    );

    expect(parsed.files.untracked).toHaveLength(1);
  });
});

describe("parseHashableStatusFiles", () => {
  it("excludes untracked and internal .diffgazer paths", () => {
    const files = parseHashableStatusFiles(
      porcelainOutput(" M src/app.ts", "?? .diffgazer/context.md", "?? untracked.ts"),
    );

    expect(files).toHaveLength(1);
    expect(files[0]?.entry.path).toBe("src/app.ts");
  });

  it("includes similarly named top-level directories", () => {
    const files = parseHashableStatusFiles(porcelainOutput(" M .diffgazer-backup/config.json"));

    expect(files).toHaveLength(1);
    expect(files[0]?.entry.path).toBe(".diffgazer-backup/config.json");
  });

  it("includes nested .diffgazer directories outside the internal root", () => {
    const files = parseHashableStatusFiles(porcelainOutput(" M src/.diffgazer/config.json"));

    expect(files).toHaveLength(1);
    expect(files[0]?.entry.path).toBe("src/.diffgazer/config.json");
  });
});
