import { describe, it, expect } from "vitest";
import {
  GitFileStatusCodeSchema,
  GitFileEntrySchema,
  GitStatusFilesSchema,
  GitStatusSchema,
  GitErrorCodeSchema,
  GitErrorSchema,
  GitDiffSchema,
  GIT_FILE_STATUS_CODES,
  GIT_SPECIFIC_CODES,
  type GitFileEntry,
  type GitStatus,
} from "./git.js";

describe("GitFileStatusCodeSchema", () => {
  it.each([...GIT_FILE_STATUS_CODES])(
    "accepts valid status code: %s",
    (code) => {
      const result = GitFileStatusCodeSchema.safeParse(code);
      expect(result.success).toBe(true);
    }
  );

  it.each(["X", "Y", "Z", "", "MM", "modified"])(
    "rejects invalid status code: %s",
    (code) => {
      const result = GitFileStatusCodeSchema.safeParse(code);
      expect(result.success).toBe(false);
    }
  );
});

describe("GitFileEntrySchema", () => {
  it("accepts valid file entry with all status codes", () => {
    const result = GitFileEntrySchema.safeParse({
      path: "src/app.ts",
      indexStatus: "M",
      workTreeStatus: " ",
    });
    expect(result.success).toBe(true);
  });

  it("accepts file entry with same index and worktree status", () => {
    const result = GitFileEntrySchema.safeParse({
      path: "README.md",
      indexStatus: "A",
      workTreeStatus: "A",
    });
    expect(result.success).toBe(true);
  });

  it("accepts file entry with special characters in path", () => {
    const result = GitFileEntrySchema.safeParse({
      path: "src/utils/file-helper.test.ts",
      indexStatus: "M",
      workTreeStatus: "M",
    });
    expect(result.success).toBe(true);
  });

  it("rejects entry with missing fields", () => {
    expect(GitFileEntrySchema.safeParse({ path: "file.ts" }).success).toBe(false);
    expect(GitFileEntrySchema.safeParse({ indexStatus: "M", workTreeStatus: " " }).success).toBe(false);
  });

  it("rejects entry with invalid status codes", () => {
    const result = GitFileEntrySchema.safeParse({
      path: "file.ts",
      indexStatus: "X",
      workTreeStatus: "M",
    });
    expect(result.success).toBe(false);
  });

  it("provides correct type inference", () => {
    const entry: GitFileEntry = {
      path: "test.ts",
      indexStatus: "M",
      workTreeStatus: " ",
    };
    expect(GitFileEntrySchema.safeParse(entry).success).toBe(true);
  });
});

describe("GitStatusFilesSchema", () => {
  it("accepts valid status files with empty arrays", () => {
    const result = GitStatusFilesSchema.safeParse({
      staged: [],
      unstaged: [],
      untracked: [],
    });
    expect(result.success).toBe(true);
  });

  it("accepts status files with entries in all categories", () => {
    const result = GitStatusFilesSchema.safeParse({
      staged: [
        { path: "staged.ts", indexStatus: "A", workTreeStatus: " " },
      ],
      unstaged: [
        { path: "unstaged.ts", indexStatus: " ", workTreeStatus: "M" },
      ],
      untracked: [
        { path: "untracked.ts", indexStatus: "?", workTreeStatus: "?" },
      ],
    });
    expect(result.success).toBe(true);
  });

  it("accepts status files with multiple entries", () => {
    const result = GitStatusFilesSchema.safeParse({
      staged: [
        { path: "file1.ts", indexStatus: "M", workTreeStatus: " " },
        { path: "file2.ts", indexStatus: "A", workTreeStatus: " " },
      ],
      unstaged: [],
      untracked: [],
    });
    expect(result.success).toBe(true);
  });

  it("rejects status files with missing categories", () => {
    expect(GitStatusFilesSchema.safeParse({ staged: [], unstaged: [] }).success).toBe(false);
    expect(GitStatusFilesSchema.safeParse({ staged: [] }).success).toBe(false);
  });

  it("rejects status files with invalid entries", () => {
    const result = GitStatusFilesSchema.safeParse({
      staged: [{ path: "file.ts" }],
      unstaged: [],
      untracked: [],
    });
    expect(result.success).toBe(false);
  });
});

describe("GitStatusSchema", () => {
  it("accepts minimal valid git status", () => {
    const result = GitStatusSchema.safeParse({
      isGitRepo: true,
      branch: "main",
      remoteBranch: "origin/main",
      ahead: 0,
      behind: 0,
      files: {
        staged: [],
        unstaged: [],
        untracked: [],
      },
      hasChanges: false,
      conflicted: [],
    });
    expect(result.success).toBe(true);
  });

  it("accepts status with null branches", () => {
    const result = GitStatusSchema.safeParse({
      isGitRepo: true,
      branch: null,
      remoteBranch: null,
      ahead: 0,
      behind: 0,
      files: {
        staged: [],
        unstaged: [],
        untracked: [],
      },
      hasChanges: false,
      conflicted: [],
    });
    expect(result.success).toBe(true);
  });

  it("accepts status with changes and ahead/behind counts", () => {
    const result = GitStatusSchema.safeParse({
      isGitRepo: true,
      branch: "feature/test",
      remoteBranch: "origin/main",
      ahead: 3,
      behind: 2,
      files: {
        staged: [{ path: "file.ts", indexStatus: "M", workTreeStatus: " " }],
        unstaged: [],
        untracked: [],
      },
      hasChanges: true,
      conflicted: [],
    });
    expect(result.success).toBe(true);
  });

  it("accepts status with conflicted files", () => {
    const result = GitStatusSchema.safeParse({
      isGitRepo: true,
      branch: "main",
      remoteBranch: "origin/main",
      ahead: 0,
      behind: 0,
      files: {
        staged: [],
        unstaged: [],
        untracked: [],
      },
      hasChanges: true,
      conflicted: ["src/app.ts", "src/config.ts"],
    });
    expect(result.success).toBe(true);
  });

  it("accepts non-git-repo status", () => {
    const result = GitStatusSchema.safeParse({
      isGitRepo: false,
      branch: null,
      remoteBranch: null,
      ahead: 0,
      behind: 0,
      files: {
        staged: [],
        unstaged: [],
        untracked: [],
      },
      hasChanges: false,
      conflicted: [],
    });
    expect(result.success).toBe(true);
  });

  it("rejects status with missing required fields", () => {
    expect(GitStatusSchema.safeParse({ isGitRepo: true }).success).toBe(false);
    expect(GitStatusSchema.safeParse({ isGitRepo: true, branch: "main" }).success).toBe(false);
  });

  it("rejects status with invalid field types", () => {
    expect(GitStatusSchema.safeParse({
      isGitRepo: "true",
      branch: "main",
      remoteBranch: "origin/main",
      ahead: 0,
      behind: 0,
      files: {
        staged: [],
        unstaged: [],
        untracked: [],
      },
      hasChanges: false,
      conflicted: [],
    }).success).toBe(false);
  });

  it("provides correct type inference", () => {
    const status: GitStatus = {
      isGitRepo: true,
      branch: "main",
      remoteBranch: null,
      ahead: 0,
      behind: 0,
      files: {
        staged: [],
        unstaged: [],
        untracked: [],
      },
      hasChanges: false,
      conflicted: [],
    };
    expect(GitStatusSchema.safeParse(status).success).toBe(true);
  });
});

describe("GitErrorCodeSchema", () => {
  it.each([
    ...GIT_SPECIFIC_CODES,
    "INTERNAL_ERROR",
    "UNKNOWN",
  ] as const)("accepts valid error code: %s", (code) => {
    const result = GitErrorCodeSchema.safeParse(code);
    expect(result.success).toBe(true);
  });

  it("rejects invalid error code", () => {
    const result = GitErrorCodeSchema.safeParse("INVALID_CODE");
    expect(result.success).toBe(false);
  });
});

describe("GitErrorSchema", () => {
  it("accepts error with message and code", () => {
    const result = GitErrorSchema.safeParse({
      message: "Not a git repository",
      code: "NOT_GIT_REPO",
    });
    expect(result.success).toBe(true);
  });

  it("accepts error with details", () => {
    const result = GitErrorSchema.safeParse({
      message: "Git command failed",
      code: "COMMAND_FAILED",
      details: "fatal: not a git repository",
    });
    expect(result.success).toBe(true);
  });

  it("rejects error with missing required fields", () => {
    expect(GitErrorSchema.safeParse({ message: "Error" }).success).toBe(false);
    expect(GitErrorSchema.safeParse({ code: "NOT_GIT_REPO" }).success).toBe(false);
  });

  it("rejects error with invalid code", () => {
    const result = GitErrorSchema.safeParse({
      message: "Error",
      code: "INVALID_CODE",
    });
    expect(result.success).toBe(false);
  });
});

describe("GitDiffSchema", () => {
  it("accepts diff with staged flag true", () => {
    const result = GitDiffSchema.safeParse({
      diff: "diff --git a/file.ts b/file.ts\n+added line",
      staged: true,
    });
    expect(result.success).toBe(true);
  });

  it("accepts diff with staged flag false", () => {
    const result = GitDiffSchema.safeParse({
      diff: "diff --git a/file.ts b/file.ts\n-removed line",
      staged: false,
    });
    expect(result.success).toBe(true);
  });

  it("accepts empty diff", () => {
    const result = GitDiffSchema.safeParse({
      diff: "",
      staged: false,
    });
    expect(result.success).toBe(true);
  });

  it("accepts multiline diff", () => {
    const result = GitDiffSchema.safeParse({
      diff: `diff --git a/file.ts b/file.ts
index 1234567..abcdefg 100644
--- a/file.ts
+++ b/file.ts
@@ -1,3 +1,4 @@
 export function test() {
+  console.log('test');
   return true;
 }`,
      staged: true,
    });
    expect(result.success).toBe(true);
  });

  it("rejects diff with missing fields", () => {
    expect(GitDiffSchema.safeParse({ diff: "test diff" }).success).toBe(false);
    expect(GitDiffSchema.safeParse({ staged: true }).success).toBe(false);
  });

  it("rejects diff with invalid types", () => {
    expect(GitDiffSchema.safeParse({
      diff: 123,
      staged: true,
    }).success).toBe(false);
    expect(GitDiffSchema.safeParse({
      diff: "test",
      staged: "true",
    }).success).toBe(false);
  });
});
