import { describe, it, expect } from "vitest";
import { parseDiff } from "./parser.js";

describe("parseDiff", () => {
  it("should parse a simple single-file diff with additions", () => {
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
    expect(result.files[0]!.filePath).toBe("file.ts");
    expect(result.files[0]!.operation).toBe("modify");
    expect(result.files[0]!.stats.additions).toBe(1);
    expect(result.files[0]!.stats.deletions).toBe(0);
  });

  it("should parse a diff with both additions and deletions", () => {
    const diff = `diff --git a/file.ts b/file.ts
--- a/file.ts
+++ b/file.ts
@@ -1,3 +1,3 @@
 line1
-old line
+new line
 line3`;

    const result = parseDiff(diff);

    expect(result.files[0]!.stats.additions).toBe(1);
    expect(result.files[0]!.stats.deletions).toBe(1);
  });

  it("should parse multiple files in a single diff", () => {
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
    expect(result.files[0]!.filePath).toBe("a.ts");
    expect(result.files[1]!.filePath).toBe("b.ts");
  });

  it("should detect new file (add operation)", () => {
    const diff = `diff --git a/new.ts b/new.ts
--- /dev/null
+++ b/new.ts
@@ -0,0 +1,3 @@
+line1
+line2
+line3`;

    const result = parseDiff(diff);

    expect(result.files[0]!.operation).toBe("add");
    expect(result.files[0]!.filePath).toBe("new.ts");
    expect(result.files[0]!.stats.additions).toBe(3);
    expect(result.files[0]!.stats.deletions).toBe(0);
  });

  it("should detect deleted file (delete operation)", () => {
    const diff = `diff --git a/old.ts b/old.ts
--- a/old.ts
+++ /dev/null
@@ -1,3 +0,0 @@
-line1
-line2
-line3`;

    const result = parseDiff(diff);

    expect(result.files[0]!.operation).toBe("delete");
    expect(result.files[0]!.stats.additions).toBe(0);
    expect(result.files[0]!.stats.deletions).toBe(3);
  });

  it("should detect rename operation", () => {
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

    expect(result.files[0]!.operation).toBe("rename");
    expect(result.files[0]!.filePath).toBe("new-name.ts");
    expect(result.files[0]!.previousPath).toBe("old-name.ts");
  });

  it("should parse hunk headers correctly", () => {
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
    const hunk = result.files[0]!.hunks[0]!;

    expect(hunk.oldStart).toBe(10);
    expect(hunk.oldCount).toBe(5);
    expect(hunk.newStart).toBe(10);
    expect(hunk.newCount).toBe(7);
  });

  it("should parse hunk header with single-line count (no comma)", () => {
    const diff = `diff --git a/file.ts b/file.ts
--- a/file.ts
+++ b/file.ts
@@ -1 +1,2 @@
 line1
+line2`;

    const result = parseDiff(diff);
    const hunk = result.files[0]!.hunks[0]!;

    expect(hunk.oldStart).toBe(1);
    expect(hunk.oldCount).toBe(1);
    expect(hunk.newStart).toBe(1);
    expect(hunk.newCount).toBe(2);
  });

  it("should handle multiple hunks in a single file", () => {
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

    expect(result.files[0]!.hunks).toHaveLength(2);
    expect(result.files[0]!.hunks[0]!.oldStart).toBe(1);
    expect(result.files[0]!.hunks[1]!.oldStart).toBe(10);
    expect(result.files[0]!.stats.additions).toBe(2);
  });

  it("should return empty files array for empty input", () => {
    const result = parseDiff("");

    expect(result.files).toHaveLength(0);
    expect(result.totalStats.filesChanged).toBe(0);
    expect(result.totalStats.additions).toBe(0);
    expect(result.totalStats.deletions).toBe(0);
  });

  it("should return empty files array for non-diff text", () => {
    const result = parseDiff("some random text\nwithout diff format");

    expect(result.files).toHaveLength(0);
  });

  it("should calculate total stats across all files", () => {
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

  it("should preserve raw diff per file", () => {
    const diff = `diff --git a/file.ts b/file.ts
--- a/file.ts
+++ b/file.ts
@@ -1,2 +1,3 @@
 line1
+added
 line2`;

    const result = parseDiff(diff);

    expect(result.files[0]!.rawDiff).toContain("diff --git a/file.ts b/file.ts");
    expect(result.files[0]!.rawDiff).toContain("+added");
  });

  it("should calculate sizeBytes for each file", () => {
    const diff = `diff --git a/file.ts b/file.ts
--- a/file.ts
+++ b/file.ts
@@ -1,2 +1,3 @@
 line1
+added
 line2`;

    const result = parseDiff(diff);

    expect(result.files[0]!.stats.sizeBytes).toBeGreaterThan(0);
    expect(result.totalStats.totalSizeBytes).toBeGreaterThan(0);
  });

  it("should handle context lines without marking as additions/deletions", () => {
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

    expect(result.files[0]!.stats.additions).toBe(1);
    expect(result.files[0]!.stats.deletions).toBe(0);
  });

  it("should handle no newline at end of file marker", () => {
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
    expect(result.files[0]!.stats.additions).toBe(1);
    expect(result.files[0]!.stats.deletions).toBe(1);
  });

  it("should handle binary file metadata without hunks", () => {
    const diff = `diff --git a/image.png b/image.png
index abc123..def456 100644
Binary files a/image.png and b/image.png differ`;

    const result = parseDiff(diff);

    // Binary files may not have standard --- / +++ headers
    // The parser should still create an entry for the file
    expect(result.files).toHaveLength(1);
    expect(result.files[0]!.filePath).toBe("image.png");
    expect(result.files[0]!.hunks).toHaveLength(0);
  });

  it("should set previousPath to null for modify operation", () => {
    const diff = `diff --git a/file.ts b/file.ts
--- a/file.ts
+++ b/file.ts
@@ -1,2 +1,3 @@
 line1
+added
 line2`;

    const result = parseDiff(diff);

    expect(result.files[0]!.operation).toBe("modify");
    expect(result.files[0]!.previousPath).toBeNull();
  });

  it("should handle file paths with spaces", () => {
    const diff = `diff --git a/path with spaces/file.ts b/path with spaces/file.ts
--- a/path with spaces/file.ts
+++ b/path with spaces/file.ts
@@ -1,2 +1,3 @@
 line1
+added
 line2`;

    const result = parseDiff(diff);

    expect(result.files[0]!.filePath).toBe("path with spaces/file.ts");
  });

  it("should handle deeply nested file paths", () => {
    const diff = `diff --git a/src/features/review/components/detail.tsx b/src/features/review/components/detail.tsx
--- a/src/features/review/components/detail.tsx
+++ b/src/features/review/components/detail.tsx
@@ -1,2 +1,3 @@
 line1
+added
 line2`;

    const result = parseDiff(diff);

    expect(result.files[0]!.filePath).toBe("src/features/review/components/detail.tsx");
  });

  it("should handle diff with index line between header and file markers", () => {
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
    expect(result.files[0]!.filePath).toBe("file.ts");
    expect(result.files[0]!.stats.additions).toBe(1);
  });

  it("should store hunk content including the header line", () => {
    const diff = `diff --git a/file.ts b/file.ts
--- a/file.ts
+++ b/file.ts
@@ -1,3 +1,4 @@
 line1
+added
 line2
 line3`;

    const result = parseDiff(diff);
    const content = result.files[0]!.hunks[0]!.content;

    expect(content).toContain("@@ -1,3 +1,4 @@");
    expect(content).toContain("+added");
    expect(content).toContain(" line1");
  });
});
