import { describe, expect, it } from "vitest";
import { requireValue } from "../../../../testing/assertions.js";
import { parseDiff } from "./parser.js";

describe("parseDiff", () => {
  it("counts additions for a single-file diff that only adds lines", () => {
    const diff = `diff --git a/file.ts b/file.ts
--- a/file.ts
+++ b/file.ts
@@ -1,3 +1,4 @@
 line1
+added
 line2
 line3`;

    const result = parseDiff(diff);

    expect(result.files).toHaveLength(1);
    expect(result.files[0]?.filePath).toBe("file.ts");
    expect(result.files[0]?.operation).toBe("modify");
    expect(result.files[0]?.stats.additions).toBe(1);
    expect(result.files[0]?.stats.deletions).toBe(0);
  });

  it("counts both additions and deletions for a modified hunk", () => {
    const diff = `diff --git a/file.ts b/file.ts
--- a/file.ts
+++ b/file.ts
@@ -1,3 +1,3 @@
 line1
-old line
+new line
 line3`;

    const result = parseDiff(diff);

    expect(result.files[0]?.stats.additions).toBe(1);
    expect(result.files[0]?.stats.deletions).toBe(1);
  });

  it("counts added content lines that begin with plus signs", () => {
    const diff = `diff --git a/file.ts b/file.ts
--- a/file.ts
+++ b/file.ts
@@ -1 +1,2 @@
 line1
+++content`;

    const result = parseDiff(diff);

    expect(result.files[0]?.stats.additions).toBe(1);
    expect(result.files[0]?.stats.deletions).toBe(0);
  });

  it("counts deleted content lines that begin with minus signs", () => {
    const diff = `diff --git a/file.ts b/file.ts
--- a/file.ts
+++ b/file.ts
@@ -1,2 +1 @@
 line1
---content`;

    const result = parseDiff(diff);

    expect(result.files[0]?.stats.additions).toBe(0);
    expect(result.files[0]?.stats.deletions).toBe(1);
  });

  it("splits a multi-file diff into one entry per file", () => {
    const diff = `diff --git a/a.ts b/a.ts
--- a/a.ts
+++ b/a.ts
@@ -1,2 +1,3 @@
 line1
+added in a
 line2
diff --git a/b.ts b/b.ts
--- a/b.ts
+++ b/b.ts
@@ -1,2 +1,3 @@
 line1
+added in b
 line2`;

    const result = parseDiff(diff);

    expect(result.files).toHaveLength(2);
    expect(result.files[0]?.filePath).toBe("a.ts");
    expect(result.files[1]?.filePath).toBe("b.ts");
  });

  it.each([
    {
      operation: "add" as const,
      diff: `diff --git a/new.ts b/new.ts
--- /dev/null
+++ b/new.ts
@@ -0,0 +1,3 @@
+line1
+line2
+line3`,
      filePath: "new.ts",
      additions: 3,
      deletions: 0,
    },
    {
      operation: "delete" as const,
      diff: `diff --git a/old.ts b/old.ts
--- a/old.ts
+++ /dev/null
@@ -1,3 +0,0 @@
-line1
-line2
-line3`,
      filePath: "old.ts",
      additions: 0,
      deletions: 3,
    },
  ])("classifies the file as $operation when one side is /dev/null", ({
    diff,
    operation,
    filePath,
    additions,
    deletions,
  }) => {
    const result = parseDiff(diff);

    expect(result.files[0]?.operation).toBe(operation);
    expect(result.files[0]?.filePath).toBe(filePath);
    expect(result.files[0]?.stats.additions).toBe(additions);
    expect(result.files[0]?.stats.deletions).toBe(deletions);
  });

  it("classifies a renamed file and records the previous path", () => {
    const diff = `diff --git a/old-name.ts b/new-name.ts
rename from old-name.ts
rename to new-name.ts
--- a/old-name.ts
+++ b/new-name.ts
@@ -1,2 +1,2 @@
 line1
-old
+new`;

    const result = parseDiff(diff);

    expect(result.files[0]?.operation).toBe("rename");
    expect(result.files[0]?.filePath).toBe("new-name.ts");
    expect(result.files[0]?.previousPath).toBe("old-name.ts");
  });

  it("parses hunk headers with explicit start and count", () => {
    const diff = `diff --git a/file.ts b/file.ts
--- a/file.ts
+++ b/file.ts
@@ -10,5 +10,7 @@
 context
+added1
+added2
 context
 context
 context`;

    const result = parseDiff(diff);
    const file = requireValue(result.files[0], "parsed file");
    const hunk = requireValue(file.hunks[0], "parsed hunk");

    expect(hunk.oldStart).toBe(10);
    expect(hunk.oldCount).toBe(5);
    expect(hunk.newStart).toBe(10);
    expect(hunk.newCount).toBe(7);
  });

  it("treats a missing comma in the hunk header as a single-line range", () => {
    const diff = `diff --git a/file.ts b/file.ts
--- a/file.ts
+++ b/file.ts
@@ -1 +1,2 @@
 line1
+line2`;

    const result = parseDiff(diff);
    const file = requireValue(result.files[0], "parsed file");
    const hunk = requireValue(file.hunks[0], "parsed hunk");

    expect(hunk.oldStart).toBe(1);
    expect(hunk.oldCount).toBe(1);
    expect(hunk.newStart).toBe(1);
    expect(hunk.newCount).toBe(2);
  });

  it("splits multiple hunks within a single file", () => {
    const diff = `diff --git a/file.ts b/file.ts
--- a/file.ts
+++ b/file.ts
@@ -1,3 +1,4 @@
 line1
+added1
 line2
 line3
@@ -10,3 +11,4 @@
 line10
+added2
 line11
 line12`;

    const result = parseDiff(diff);

    expect(result.files[0]?.hunks).toHaveLength(2);
    expect(result.files[0]?.hunks[0]?.oldStart).toBe(1);
    expect(result.files[0]?.hunks[1]?.oldStart).toBe(10);
    expect(result.files[0]?.stats.additions).toBe(2);
  });

  it.each([
    { description: "empty input", input: "" },
    {
      description: "text that is not in diff format",
      input: "some random text\nwithout diff format",
    },
  ])("returns no files for $description", ({ input }) => {
    const result = parseDiff(input);

    expect(result.files).toHaveLength(0);
    if (input === "") {
      expect(result.totalStats.filesChanged).toBe(0);
      expect(result.totalStats.additions).toBe(0);
      expect(result.totalStats.deletions).toBe(0);
    }
  });

  it("aggregates totalStats across every file in the diff", () => {
    const diff = `diff --git a/a.ts b/a.ts
--- a/a.ts
+++ b/a.ts
@@ -1,2 +1,3 @@
 line1
+added
 line2
diff --git a/b.ts b/b.ts
--- a/b.ts
+++ b/b.ts
@@ -1,3 +1,2 @@
 line1
-deleted
 line3`;

    const result = parseDiff(diff);

    expect(result.totalStats.filesChanged).toBe(2);
    expect(result.totalStats.additions).toBe(1);
    expect(result.totalStats.deletions).toBe(1);
  });

  it("retains the raw diff text for each file", () => {
    const diff = `diff --git a/file.ts b/file.ts
--- a/file.ts
+++ b/file.ts
@@ -1,2 +1,3 @@
 line1
+added
 line2`;

    const result = parseDiff(diff);

    expect(result.files[0]?.rawDiff).toContain("diff --git a/file.ts b/file.ts");
    expect(result.files[0]?.rawDiff).toContain("+added");
  });

  it("records a non-zero sizeBytes for each file and rolls it into totalStats", () => {
    const diff = `diff --git a/file.ts b/file.ts
--- a/file.ts
+++ b/file.ts
@@ -1,2 +1,3 @@
 line1
+added
 line2`;

    const result = parseDiff(diff);

    expect(result.files[0]?.stats.sizeBytes).toBeGreaterThan(0);
    expect(result.totalStats.totalSizeBytes).toBeGreaterThan(0);
  });

  it("does not count context lines as additions or deletions", () => {
    const diff = `diff --git a/file.ts b/file.ts
--- a/file.ts
+++ b/file.ts
@@ -1,5 +1,6 @@
 context1
 context2
+added
 context3
 context4
 context5`;

    const result = parseDiff(diff);

    expect(result.files[0]?.stats.additions).toBe(1);
    expect(result.files[0]?.stats.deletions).toBe(0);
  });

  it("ignores the no-newline marker while still counting the surrounding lines", () => {
    const diff = `diff --git a/file.ts b/file.ts
--- a/file.ts
+++ b/file.ts
@@ -1,2 +1,2 @@
 line1
-old
\\ No newline at end of file
+new
\\ No newline at end of file`;

    const result = parseDiff(diff);

    expect(result.files).toHaveLength(1);
    expect(result.files[0]?.stats.additions).toBe(1);
    expect(result.files[0]?.stats.deletions).toBe(1);
  });

  it("records a binary-file entry without any hunks", () => {
    const diff = `diff --git a/image.png b/image.png
index abc123..def456 100644
Binary files a/image.png and b/image.png differ`;

    const result = parseDiff(diff);

    expect(result.files).toHaveLength(1);
    expect(result.files[0]?.filePath).toBe("image.png");
    expect(result.files[0]?.hunks).toHaveLength(0);
  });

  it("leaves previousPath null for a plain modify operation", () => {
    const diff = `diff --git a/file.ts b/file.ts
--- a/file.ts
+++ b/file.ts
@@ -1,2 +1,3 @@
 line1
+added
 line2`;

    const result = parseDiff(diff);

    expect(result.files[0]?.operation).toBe("modify");
    expect(result.files[0]?.previousPath).toBeNull();
  });

  it.each([
    { description: "spaces", path: "path with spaces/file.ts" },
    { description: "deep nesting", path: "src/features/review/components/detail.tsx" },
  ])("preserves $description in the file path", ({ path }) => {
    const diff = `diff --git a/${path} b/${path}
--- a/${path}
+++ b/${path}
@@ -1,2 +1,3 @@
 line1
+added
 line2`;

    const result = parseDiff(diff);

    expect(result.files[0]?.filePath).toBe(path);
  });

  it("parses correctly when an index line sits between the diff header and the file markers", () => {
    const diff = `diff --git a/file.ts b/file.ts
index abc1234..def5678 100644
--- a/file.ts
+++ b/file.ts
@@ -1,2 +1,3 @@
 line1
+added
 line2`;

    const result = parseDiff(diff);

    expect(result.files).toHaveLength(1);
    expect(result.files[0]?.filePath).toBe("file.ts");
    expect(result.files[0]?.stats.additions).toBe(1);
  });

  it("includes the hunk header inside the captured hunk content", () => {
    const diff = `diff --git a/file.ts b/file.ts
--- a/file.ts
+++ b/file.ts
@@ -1,3 +1,4 @@
 line1
+added
 line2
 line3`;

    const result = parseDiff(diff);
    const content = result.files[0]?.hunks[0]?.content;

    expect(content).toContain("@@ -1,3 +1,4 @@");
    expect(content).toContain("+added");
    expect(content).toContain(" line1");
  });

  it("parses Git quoted paths with C-style escapes", () => {
    const diff = `diff --git "a/path with \\"quotes\\".ts" "b/path with \\"quotes\\".ts"
--- "a/path with \\"quotes\\".ts"
+++ "b/path with \\"quotes\\".ts"
@@ -1,2 +1,3 @@
 line1
+added
 line2`;

    const result = parseDiff(diff);

    expect(result.files).toHaveLength(1);
    expect(result.files[0]?.filePath).toBe('path with "quotes".ts');
    expect(result.files[0]?.operation).toBe("modify");
    expect(result.files[0]?.stats.additions).toBe(1);
  });

  it("parses Git quoted paths with tab escapes", () => {
    const diff = `diff --git "a/dir\\twith\\ttabs/file.ts" "b/dir\\twith\\ttabs/file.ts"
--- "a/dir\\twith\\ttabs/file.ts"
+++ "b/dir\\twith\\ttabs/file.ts"
@@ -1,2 +1,3 @@
 line1
+added
 line2`;

    const result = parseDiff(diff);

    expect(result.files).toHaveLength(1);
    expect(result.files[0]?.filePath).toBe("dir\twith\ttabs/file.ts");
  });

  it("handles quoted rename paths", () => {
    const diff = `diff --git "a/old \\"name\\".ts" "b/new \\"name\\".ts"
rename from "old \\"name\\".ts"
rename to "new \\"name\\".ts"
--- "a/old \\"name\\".ts"
+++ "b/new \\"name\\".ts"
@@ -1,2 +1,2 @@
 line1
-old
+new`;

    const result = parseDiff(diff);

    expect(result.files[0]?.operation).toBe("rename");
    expect(result.files[0]?.filePath).toBe('new "name".ts');
    expect(result.files[0]?.previousPath).toBe('old "name".ts');
  });

  it("decodes a git-quoted multi-byte UTF-8 path", () => {
    // git quotes `żółć/plik.ts` as octal bytes under default core.quotepath.
    const quoted = "\\305\\274\\303\\263\\305\\202\\304\\207/plik.ts";
    const diff = `diff --git "a/${quoted}" "b/${quoted}"
--- "a/${quoted}"
+++ "b/${quoted}"
@@ -1,2 +1,3 @@
 line1
+added
 line2`;

    const result = parseDiff(diff);

    expect(result.files).toHaveLength(1);
    expect(result.files[0]?.filePath).toBe("żółć/plik.ts");
    expect(result.files[0]?.stats.additions).toBe(1);
  });
});
