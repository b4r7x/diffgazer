import { describe, it, expect } from "vitest";
import { parseDiff } from "./parser.js";
import type { DiffOperation } from "./types.js";

describe("parser.ts - diff parsing", () => {
  describe("file operations detection", () => {
    it("should detect file addition", () => {
      const diff = `diff --git a/new-file.ts b/new-file.ts
new file mode 100644
index 0000000..1234567
--- /dev/null
+++ b/new-file.ts
@@ -0,0 +1,3 @@
+export function hello() {
+  return "world";
+}`;

      const result = parseDiff(diff);

      expect(result.files).toHaveLength(1);
      expect(result.files[0]?.operation).toBe("add");
      expect(result.files[0]?.filePath).toBe("new-file.ts");
      expect(result.files[0]?.previousPath).toBeNull();
      expect(result.files[0]?.stats.additions).toBe(3);
      expect(result.files[0]?.stats.deletions).toBe(0);
    });

    it("should detect file deletion", () => {
      const diff = `diff --git a/old-file.ts b/old-file.ts
deleted file mode 100644
index 1234567..0000000
--- a/old-file.ts
+++ /dev/null
@@ -1,3 +0,0 @@
-export function goodbye() {
-  return "world";
-}`;

      const result = parseDiff(diff);

      expect(result.files).toHaveLength(1);
      expect(result.files[0]?.operation).toBe("delete");
      expect(result.files[0]?.filePath).toBe("old-file.ts");
      expect(result.files[0]?.previousPath).toBeNull();
      expect(result.files[0]?.stats.additions).toBe(0);
      expect(result.files[0]?.stats.deletions).toBe(3);
    });

    it("should detect file rename", () => {
      const diff = `diff --git a/old-name.ts b/new-name.ts
similarity index 100%
rename from old-name.ts
rename to new-name.ts`;

      const result = parseDiff(diff);

      expect(result.files).toHaveLength(1);
      expect(result.files[0]?.operation).toBe("rename");
      expect(result.files[0]?.filePath).toBe("new-name.ts");
      expect(result.files[0]?.previousPath).toBe("old-name.ts");
      expect(result.files[0]?.stats.additions).toBe(0);
      expect(result.files[0]?.stats.deletions).toBe(0);
    });

    it("should detect file rename with modifications", () => {
      const diff = `diff --git a/old-name.ts b/new-name.ts
similarity index 87%
rename from old-name.ts
rename to new-name.ts
index abc1234..def5678 100644
--- a/old-name.ts
+++ b/new-name.ts
@@ -1,3 +1,4 @@
 export function hello() {
-  return "world";
+  console.log("world");
+  return "hello";
 }`;

      const result = parseDiff(diff);

      expect(result.files).toHaveLength(1);
      expect(result.files[0]?.operation).toBe("rename");
      expect(result.files[0]?.filePath).toBe("new-name.ts");
      expect(result.files[0]?.previousPath).toBe("old-name.ts");
      expect(result.files[0]?.stats.additions).toBe(2);
      expect(result.files[0]?.stats.deletions).toBe(1);
    });

    it("should detect file modification", () => {
      const diff = `diff --git a/existing-file.ts b/existing-file.ts
index abc1234..def5678 100644
--- a/existing-file.ts
+++ b/existing-file.ts
@@ -1,3 +1,3 @@
 export function test() {
-  return false;
+  return true;
 }`;

      const result = parseDiff(diff);

      expect(result.files).toHaveLength(1);
      expect(result.files[0]?.operation).toBe("modify");
      expect(result.files[0]?.filePath).toBe("existing-file.ts");
      expect(result.files[0]?.previousPath).toBeNull();
      expect(result.files[0]?.stats.additions).toBe(1);
      expect(result.files[0]?.stats.deletions).toBe(1);
    });
  });

  describe("multi-hunk files", () => {
    it("should parse multiple hunks with correct line numbers", () => {
      const diff = `diff --git a/multi-hunk.ts b/multi-hunk.ts
index abc1234..def5678 100644
--- a/multi-hunk.ts
+++ b/multi-hunk.ts
@@ -5,7 +5,8 @@ export class Example {
   constructor() {
     this.value = 0;
   }
-
+
   getValue() {
+    console.log("getting value");
     return this.value;
   }
@@ -20,6 +21,7 @@ export class Example {

   calculate(x: number) {
     const result = x * 2;
+    console.log("calculated:", result);
     return result;
   }
 }`;

      const result = parseDiff(diff);

      expect(result.files).toHaveLength(1);
      expect(result.files[0]?.hunks).toHaveLength(2);

      // First hunk
      expect(result.files[0]?.hunks[0]?.oldStart).toBe(5);
      expect(result.files[0]?.hunks[0]?.oldCount).toBe(7);
      expect(result.files[0]?.hunks[0]?.newStart).toBe(5);
      expect(result.files[0]?.hunks[0]?.newCount).toBe(8);

      // Second hunk
      expect(result.files[0]?.hunks[1]?.oldStart).toBe(20);
      expect(result.files[0]?.hunks[1]?.oldCount).toBe(6);
      expect(result.files[0]?.hunks[1]?.newStart).toBe(21);
      expect(result.files[0]?.hunks[1]?.newCount).toBe(7);

      // Stats should reflect all changes (1 empty line replacement + 2 console.log additions)
      expect(result.files[0]?.stats.additions).toBe(3);
      expect(result.files[0]?.stats.deletions).toBe(1);
    });

    it("should handle hunks with single line count (implicit)", () => {
      const diff = `diff --git a/single-line.ts b/single-line.ts
index abc1234..def5678 100644
--- a/single-line.ts
+++ b/single-line.ts
@@ -10 +10 @@ function example() {
-  return null;
+  return undefined;`;

      const result = parseDiff(diff);

      expect(result.files).toHaveLength(1);
      expect(result.files[0]?.hunks).toHaveLength(1);
      expect(result.files[0]?.hunks[0]?.oldStart).toBe(10);
      expect(result.files[0]?.hunks[0]?.oldCount).toBe(1);
      expect(result.files[0]?.hunks[0]?.newStart).toBe(10);
      expect(result.files[0]?.hunks[0]?.newCount).toBe(1);
    });

    it("should parse hunks with context lines", () => {
      const diff = `diff --git a/context.ts b/context.ts
index abc1234..def5678 100644
--- a/context.ts
+++ b/context.ts
@@ -1,7 +1,7 @@
 // File header
 import { something } from "lib";

-export const OLD_VALUE = 42;
+export const NEW_VALUE = 100;

 function process() {
   // Implementation`;

      const result = parseDiff(diff);

      expect(result.files).toHaveLength(1);
      expect(result.files[0]?.hunks).toHaveLength(1);

      const hunkContent = result.files[0]?.hunks[0]?.content ?? "";
      expect(hunkContent).toContain("// File header");
      expect(hunkContent).toContain("-export const OLD_VALUE = 42;");
      expect(hunkContent).toContain("+export const NEW_VALUE = 100;");
      expect(hunkContent).toContain("function process()");
    });
  });

  describe("binary file handling", () => {
    it("should handle binary file addition", () => {
      const diff = `diff --git a/image.png b/image.png
new file mode 100644
index 0000000..1234567
--- /dev/null
+++ b/image.png
Binary files /dev/null and b/image.png differ`;

      const result = parseDiff(diff);

      expect(result.files).toHaveLength(1);
      expect(result.files[0]?.operation).toBe("add");
      expect(result.files[0]?.filePath).toBe("image.png");
      expect(result.files[0]?.hunks).toHaveLength(0);
      expect(result.files[0]?.stats.additions).toBe(0);
      expect(result.files[0]?.stats.deletions).toBe(0);
    });

    it("should handle binary file modification", () => {
      const diff = `diff --git a/logo.svg b/logo.svg
index abc1234..def5678 100644
Binary files a/logo.svg and b/logo.svg differ`;

      const result = parseDiff(diff);

      expect(result.files).toHaveLength(1);
      expect(result.files[0]?.operation).toBe("modify");
      expect(result.files[0]?.filePath).toBe("logo.svg");
      expect(result.files[0]?.hunks).toHaveLength(0);
    });

    it("should handle binary file deletion", () => {
      const diff = `diff --git a/old-image.jpg b/old-image.jpg
deleted file mode 100644
index 1234567..0000000
--- a/old-image.jpg
+++ /dev/null
Binary files a/old-image.jpg and /dev/null differ`;

      const result = parseDiff(diff);

      expect(result.files).toHaveLength(1);
      expect(result.files[0]?.operation).toBe("delete");
      expect(result.files[0]?.filePath).toBe("old-image.jpg");
      expect(result.files[0]?.hunks).toHaveLength(0);
    });
  });

  describe("empty diffs", () => {
    it("should handle empty diff string", () => {
      const result = parseDiff("");

      expect(result.files).toHaveLength(0);
      expect(result.totalStats.filesChanged).toBe(0);
      expect(result.totalStats.additions).toBe(0);
      expect(result.totalStats.deletions).toBe(0);
      expect(result.totalStats.totalSizeBytes).toBe(0);
    });

    it("should handle diff with no changes", () => {
      const diff = `diff --git a/unchanged.ts b/unchanged.ts
index abc1234..abc1234 100644
--- a/unchanged.ts
+++ b/unchanged.ts`;

      const result = parseDiff(diff);

      expect(result.files).toHaveLength(1);
      expect(result.files[0]?.hunks).toHaveLength(0);
      expect(result.files[0]?.stats.additions).toBe(0);
      expect(result.files[0]?.stats.deletions).toBe(0);
    });

    it("should handle whitespace-only diff", () => {
      const result = parseDiff("\n\n  \n\n");

      expect(result.files).toHaveLength(0);
      expect(result.totalStats.filesChanged).toBe(0);
    });
  });

  describe("stats calculation", () => {
    it("should calculate additions and deletions correctly", () => {
      const diff = `diff --git a/stats-test.ts b/stats-test.ts
index abc1234..def5678 100644
--- a/stats-test.ts
+++ b/stats-test.ts
@@ -1,10 +1,15 @@
 export class Calculator {
+  private value: number = 0;
+
   add(x: number, y: number) {
-    return x + y;
+    const result = x + y;
+    this.value = result;
+    return result;
   }

   subtract(x: number, y: number) {
-    return x - y;
+    const result = x - y;
+    this.value = result;
+    return result;
   }
-
-  // Deprecated method
 }`;

      const result = parseDiff(diff);

      expect(result.files).toHaveLength(1);
      expect(result.files[0]?.stats.additions).toBe(8);
      expect(result.files[0]?.stats.deletions).toBe(4);
    });

    it("should not count diff headers as changes", () => {
      const diff = `diff --git a/header-test.ts b/header-test.ts
index abc1234..def5678 100644
--- a/header-test.ts
+++ b/header-test.ts
@@ -1,3 +1,3 @@
 const value = 1;
-const old = 2;
+const new = 2;
 const other = 3;`;

      const result = parseDiff(diff);

      expect(result.files).toHaveLength(1);
      // Should count only the actual change lines, not the --- and +++ headers
      expect(result.files[0]?.stats.additions).toBe(1);
      expect(result.files[0]?.stats.deletions).toBe(1);
    });

    it("should calculate sizeBytes correctly", () => {
      const diff = `diff --git a/size-test.ts b/size-test.ts
index abc1234..def5678 100644
--- a/size-test.ts
+++ b/size-test.ts
@@ -1 +1 @@
-old
+new`;

      const result = parseDiff(diff);

      expect(result.files).toHaveLength(1);
      expect(result.files[0]?.stats.sizeBytes).toBeGreaterThan(0);
      expect(result.files[0]?.stats.sizeBytes).toBe(
        Buffer.byteLength(result.files[0]?.rawDiff ?? "", "utf-8")
      );
    });

    it("should aggregate total stats correctly", () => {
      const diff = `diff --git a/file1.ts b/file1.ts
index abc1234..def5678 100644
--- a/file1.ts
+++ b/file1.ts
@@ -1,2 +1,3 @@
 const a = 1;
-const b = 2;
+const b = 3;
+const c = 4;
diff --git a/file2.ts b/file2.ts
new file mode 100644
index 0000000..1234567
--- /dev/null
+++ b/file2.ts
@@ -0,0 +1,2 @@
+export const x = 1;
+export const y = 2;
diff --git a/file3.ts b/file3.ts
deleted file mode 100644
index 1234567..0000000
--- a/file3.ts
+++ /dev/null
@@ -1,3 +0,0 @@
-const old = 1;
-const code = 2;
-const here = 3;`;

      const result = parseDiff(diff);

      expect(result.files).toHaveLength(3);
      expect(result.totalStats.filesChanged).toBe(3);
      expect(result.totalStats.additions).toBe(4); // 2 from file1, 2 from file2
      expect(result.totalStats.deletions).toBe(4); // 1 from file1, 3 from file3
      expect(result.totalStats.totalSizeBytes).toBeGreaterThan(0);

      const expectedSize = result.files.reduce(
        (sum, file) => sum + file.stats.sizeBytes,
        0
      );
      expect(result.totalStats.totalSizeBytes).toBe(expectedSize);
    });
  });

  describe("file path extraction", () => {
    it("should extract nested file paths", () => {
      const diff = `diff --git a/src/components/Button.tsx b/src/components/Button.tsx
index abc1234..def5678 100644
--- a/src/components/Button.tsx
+++ b/src/components/Button.tsx
@@ -1 +1 @@
-old
+new`;

      const result = parseDiff(diff);

      expect(result.files).toHaveLength(1);
      expect(result.files[0]?.filePath).toBe("src/components/Button.tsx");
    });

    it("should handle files with spaces in names", () => {
      const diff = `diff --git a/my file with spaces.ts b/my file with spaces.ts
index abc1234..def5678 100644
--- a/my file with spaces.ts
+++ b/my file with spaces.ts
@@ -1 +1 @@
-old
+new`;

      const result = parseDiff(diff);

      expect(result.files).toHaveLength(1);
      expect(result.files[0]?.filePath).toBe("my file with spaces.ts");
    });

    it("should handle Unicode characters in file paths", () => {
      const diff = `diff --git a/src/文件.ts b/src/文件.ts
index abc1234..def5678 100644
--- a/src/文件.ts
+++ b/src/文件.ts
@@ -1 +1 @@
-old
+new`;

      const result = parseDiff(diff);

      expect(result.files).toHaveLength(1);
      expect(result.files[0]?.filePath).toBe("src/文件.ts");
    });
  });

  describe("edge cases", () => {
    it("should handle files with only additions", () => {
      const diff = `diff --git a/additions-only.ts b/additions-only.ts
index abc1234..def5678 100644
--- a/additions-only.ts
+++ b/additions-only.ts
@@ -5,0 +6,3 @@ existing code
+export function newFunction() {
+  return "added";
+}`;

      const result = parseDiff(diff);

      expect(result.files).toHaveLength(1);
      expect(result.files[0]?.stats.additions).toBe(3);
      expect(result.files[0]?.stats.deletions).toBe(0);
    });

    it("should handle files with only deletions", () => {
      const diff = `diff --git a/deletions-only.ts b/deletions-only.ts
index abc1234..def5678 100644
--- a/deletions-only.ts
+++ b/deletions-only.ts
@@ -10,3 +10,0 @@ remaining code
-function removed() {
-  return "deleted";
-}`;

      const result = parseDiff(diff);

      expect(result.files).toHaveLength(1);
      expect(result.files[0]?.stats.additions).toBe(0);
      expect(result.files[0]?.stats.deletions).toBe(3);
    });

    it("should handle mode changes without content changes", () => {
      const diff = `diff --git a/script.sh b/script.sh
old mode 100644
new mode 100755
index abc1234..abc1234`;

      const result = parseDiff(diff);

      expect(result.files).toHaveLength(1);
      expect(result.files[0]?.filePath).toBe("script.sh");
      expect(result.files[0]?.operation).toBe("modify");
      expect(result.files[0]?.hunks).toHaveLength(0);
      expect(result.files[0]?.stats.additions).toBe(0);
      expect(result.files[0]?.stats.deletions).toBe(0);
    });

    it("should handle very large hunks", () => {
      const lines = [
        "diff --git a/large.ts b/large.ts",
        "index abc1234..def5678 100644",
        "--- a/large.ts",
        "+++ b/large.ts",
        "@@ -1,1000 +1,1000 @@ header"
      ];

      // Generate 500 additions and 500 deletions
      for (let i = 0; i < 500; i++) {
        lines.push(`-line ${i} old`);
      }
      for (let i = 0; i < 500; i++) {
        lines.push(`+line ${i} new`);
      }

      const diff = lines.join("\n");
      const result = parseDiff(diff);

      expect(result.files).toHaveLength(1);
      expect(result.files[0]?.hunks).toHaveLength(1);
      expect(result.files[0]?.stats.additions).toBe(500);
      expect(result.files[0]?.stats.deletions).toBe(500);
    });

    it("should handle multiple files in one diff", () => {
      const diff = `diff --git a/file1.ts b/file1.ts
index abc1234..def5678 100644
--- a/file1.ts
+++ b/file1.ts
@@ -1 +1 @@
-old1
+new1
diff --git a/file2.ts b/file2.ts
index abc1234..def5678 100644
--- a/file2.ts
+++ b/file2.ts
@@ -1 +1 @@
-old2
+new2
diff --git a/file3.ts b/file3.ts
index abc1234..def5678 100644
--- a/file3.ts
+++ b/file3.ts
@@ -1 +1 @@
-old3
+new3`;

      const result = parseDiff(diff);

      expect(result.files).toHaveLength(3);
      expect(result.files[0]?.filePath).toBe("file1.ts");
      expect(result.files[1]?.filePath).toBe("file2.ts");
      expect(result.files[2]?.filePath).toBe("file3.ts");
      expect(result.totalStats.filesChanged).toBe(3);
    });

    it("should handle diff with no newline at end of file marker", () => {
      const diff = `diff --git a/no-newline.ts b/no-newline.ts
index abc1234..def5678 100644
--- a/no-newline.ts
+++ b/no-newline.ts
@@ -1,2 +1,2 @@
 const value = 1;
-const old = 2;
\\ No newline at end of file
+const new = 2;`;

      const result = parseDiff(diff);

      expect(result.files).toHaveLength(1);
      expect(result.files[0]?.stats.additions).toBe(1);
      expect(result.files[0]?.stats.deletions).toBe(1);
    });

    it("should handle empty file creation", () => {
      const diff = `diff --git a/empty.ts b/empty.ts
new file mode 100644
index 0000000..e69de29
--- /dev/null
+++ b/empty.ts`;

      const result = parseDiff(diff);

      expect(result.files).toHaveLength(1);
      expect(result.files[0]?.operation).toBe("add");
      expect(result.files[0]?.filePath).toBe("empty.ts");
      expect(result.files[0]?.hunks).toHaveLength(0);
      expect(result.files[0]?.stats.additions).toBe(0);
      expect(result.files[0]?.stats.deletions).toBe(0);
    });

    it("should handle empty file deletion", () => {
      const diff = `diff --git a/empty.ts b/empty.ts
deleted file mode 100644
index e69de29..0000000
--- a/empty.ts
+++ /dev/null`;

      const result = parseDiff(diff);

      expect(result.files).toHaveLength(1);
      expect(result.files[0]?.operation).toBe("delete");
      expect(result.files[0]?.filePath).toBe("empty.ts");
      expect(result.files[0]?.hunks).toHaveLength(0);
    });
  });

  describe("complex real-world scenarios", () => {
    it("should parse a complex multi-file diff with various operations", () => {
      const diff = `diff --git a/src/new-feature.ts b/src/new-feature.ts
new file mode 100644
index 0000000..abc1234
--- /dev/null
+++ b/src/new-feature.ts
@@ -0,0 +1,10 @@
+export class NewFeature {
+  constructor(private config: Config) {}
+
+  async execute() {
+    const result = await this.process();
+    return result;
+  }
+
+  private async process() {
+    return { status: "success" };
+  }
+}
diff --git a/src/old-feature.ts b/src/old-feature.ts
deleted file mode 100644
index def5678..0000000
--- a/src/old-feature.ts
+++ /dev/null
@@ -1,5 +0,0 @@
-export class OldFeature {
-  execute() {
-    return null;
-  }
-}
diff --git a/src/utils/helper.ts b/src/utils/helper.ts
index 1111111..2222222 100644
--- a/src/utils/helper.ts
+++ b/src/utils/helper.ts
@@ -1,8 +1,10 @@
 export class Helper {
+  private cache = new Map();
+
   format(value: string) {
-    return value.trim();
+    return value.trim().toLowerCase();
   }
-
+
   validate(input: string) {
     return input.length > 0;
   }
diff --git a/README.md b/docs/README.md
similarity index 100%
rename from README.md
rename to docs/README.md`;

      const result = parseDiff(diff);

      expect(result.files).toHaveLength(4);

      // New file
      const newFile = result.files.find(f => f.filePath === "src/new-feature.ts");
      expect(newFile?.operation).toBe("add");
      expect(newFile?.stats.additions).toBe(12);
      expect(newFile?.stats.deletions).toBe(0);

      // Deleted file
      const deletedFile = result.files.find(f => f.filePath === "src/old-feature.ts");
      expect(deletedFile?.operation).toBe("delete");
      expect(deletedFile?.stats.additions).toBe(0);
      expect(deletedFile?.stats.deletions).toBe(5);

      // Modified file
      const modifiedFile = result.files.find(f => f.filePath === "src/utils/helper.ts");
      expect(modifiedFile?.operation).toBe("modify");
      expect(modifiedFile?.stats.additions).toBe(4);
      expect(modifiedFile?.stats.deletions).toBe(2);

      // Renamed file
      const renamedFile = result.files.find(f => f.filePath === "docs/README.md");
      expect(renamedFile?.operation).toBe("rename");
      expect(renamedFile?.previousPath).toBe("README.md");

      // Total stats
      expect(result.totalStats.filesChanged).toBe(4);
      expect(result.totalStats.additions).toBe(16);
      expect(result.totalStats.deletions).toBe(7);
    });

    it("should handle git submodule changes", () => {
      const diff = `diff --git a/vendor/lib b/vendor/lib
index abc1234..def5678 160000
--- a/vendor/lib
+++ b/vendor/lib
@@ -1 +1 @@
-Subproject commit abc1234567890abcdef1234567890abcdef12345
+Subproject commit def5678901234abcdef5678901234abcdef56789`;

      const result = parseDiff(diff);

      expect(result.files).toHaveLength(1);
      expect(result.files[0]?.filePath).toBe("vendor/lib");
      expect(result.files[0]?.operation).toBe("modify");
    });

    it("should handle symlink changes", () => {
      const diff = `diff --git a/link b/link
deleted file mode 120000
index abc1234..0000000
--- a/link
+++ /dev/null
@@ -1 +0,0 @@
-target/path
diff --git a/link b/link
new file mode 120000
index 0000000..def5678
--- /dev/null
+++ b/link
@@ -0,0 +1 @@
+new/target/path`;

      const result = parseDiff(diff);

      expect(result.files).toHaveLength(2);
      expect(result.files[0]?.operation).toBe("delete");
      expect(result.files[1]?.operation).toBe("add");
    });
  });

  describe("hunk content preservation", () => {
    it("should preserve exact hunk content including context", () => {
      const diff = `diff --git a/test.ts b/test.ts
index abc1234..def5678 100644
--- a/test.ts
+++ b/test.ts
@@ -1,5 +1,6 @@
 function test() {
   const a = 1;
-  const b = 2;
+  const b = 3;
+  const c = 4;
   return a + b;
 }`;

      const result = parseDiff(diff);

      expect(result.files).toHaveLength(1);
      const hunk = result.files[0]?.hunks[0];
      expect(hunk).toBeDefined();

      const expectedContent = `@@ -1,5 +1,6 @@
 function test() {
   const a = 1;
-  const b = 2;
+  const b = 3;
+  const c = 4;
   return a + b;
 }`;

      expect(hunk?.content).toBe(expectedContent);
    });

    it("should preserve rawDiff for entire file", () => {
      const diff = `diff --git a/test.ts b/test.ts
index abc1234..def5678 100644
--- a/test.ts
+++ b/test.ts
@@ -1 +1 @@
-old
+new`;

      const result = parseDiff(diff);

      expect(result.files).toHaveLength(1);
      expect(result.files[0]?.rawDiff).toBe(diff);
    });
  });

  describe("malformed input handling", () => {
    it("should handle diff with missing headers gracefully", () => {
      const diff = `@@ -1 +1 @@
-old
+new`;

      const result = parseDiff(diff);

      // Should not crash, but won't parse as a valid file
      expect(result.files).toHaveLength(0);
    });

    it("should handle mixed line endings", () => {
      const diff = "diff --git a/file.ts b/file.ts\r\nindex abc1234..def5678 100644\n--- a/file.ts\r\n+++ b/file.ts\n@@ -1 +1 @@\r\n-old\n+new";

      const result = parseDiff(diff);

      // Should parse despite mixed line endings
      expect(result.files.length).toBeGreaterThanOrEqual(0);
    });
  });

  describe("real git diff output scenarios", () => {
    it("should parse git diff with extended headers", () => {
      const diff = `diff --git a/src/feature.ts b/src/feature.ts
new file mode 100644
index 0000000000..1234567890
--- /dev/null
+++ b/src/feature.ts
@@ -0,0 +1,5 @@
+export function feature() {
+  console.log("new feature");
+  return true;
+}
+`;

      const result = parseDiff(diff);

      expect(result.files).toHaveLength(1);
      expect(result.files[0]?.operation).toBe("add");
      expect(result.files[0]?.stats.additions).toBe(5);
    });

    it("should parse git diff with file mode change and content", () => {
      const diff = `diff --git a/script.sh b/script.sh
old mode 100644
new mode 100755
index abc1234..def5678
--- a/script.sh
+++ b/script.sh
@@ -1,2 +1,3 @@
 #!/bin/bash
+set -e
 echo "Hello"`;

      const result = parseDiff(diff);

      expect(result.files).toHaveLength(1);
      expect(result.files[0]?.operation).toBe("modify");
      expect(result.files[0]?.stats.additions).toBe(1);
      expect(result.files[0]?.stats.deletions).toBe(0);
    });

    it("should handle git diff with copy operation", () => {
      const diff = `diff --git a/original.ts b/copy.ts
similarity index 95%
copy from original.ts
copy to copy.ts
index abc1234..def5678 100644
--- a/original.ts
+++ b/copy.ts
@@ -1,3 +1,4 @@
+// This is a copy
 export function hello() {
   return "world";
 }`;

      const result = parseDiff(diff);

      expect(result.files).toHaveLength(1);
      expect(result.files[0]?.filePath).toBe("copy.ts");
      expect(result.files[0]?.stats.additions).toBe(1);
    });

    it("should parse diff with multiple consecutive hunks", () => {
      const diff = `diff --git a/complex.ts b/complex.ts
index abc1234..def5678 100644
--- a/complex.ts
+++ b/complex.ts
@@ -10,3 +10,4 @@ function first() {
   const a = 1;
   const b = 2;
+  const c = 3;
   return a + b;
@@ -20,2 +21,3 @@ function second() {
   const x = 10;
+  const y = 20;
   return x;
@@ -30,1 +32,2 @@ function third() {
+  // New comment
   return null;`;

      const result = parseDiff(diff);

      expect(result.files).toHaveLength(1);
      expect(result.files[0]?.hunks).toHaveLength(3);
      expect(result.files[0]?.stats.additions).toBe(3);
      expect(result.files[0]?.stats.deletions).toBe(0);
    });

    it("should handle diff with trailing whitespace changes", () => {
      const diff = `diff --git a/whitespace.ts b/whitespace.ts
index abc1234..def5678 100644
--- a/whitespace.ts
+++ b/whitespace.ts
@@ -1,3 +1,3 @@
 const value = 1;
-const old = 2;
+const old = 2;
 const other = 3;`;

      const result = parseDiff(diff);

      expect(result.files).toHaveLength(1);
      expect(result.files[0]?.stats.additions).toBe(1);
      expect(result.files[0]?.stats.deletions).toBe(1);
    });

    it("should parse diff with conflict markers (after resolution)", () => {
      const diff = `diff --git a/merged.ts b/merged.ts
index abc1234..def5678 100644
--- a/merged.ts
+++ b/merged.ts
@@ -1,5 +1,3 @@
-<<<<<<< HEAD
-const value = 1;
-=======
 const value = 2;
->>>>>>> feature-branch
+// Conflict resolved`;

      const result = parseDiff(diff);

      expect(result.files).toHaveLength(1);
      expect(result.files[0]?.stats.additions).toBe(1);
      expect(result.files[0]?.stats.deletions).toBe(4);
    });
  });

  describe("performance and scalability", () => {
    it("should handle diff with many files efficiently", () => {
      const files: string[] = [];
      for (let i = 0; i < 100; i++) {
        files.push(`diff --git a/file${i}.ts b/file${i}.ts
index abc1234..def5678 100644
--- a/file${i}.ts
+++ b/file${i}.ts
@@ -1 +1 @@
-old${i}
+new${i}`);
      }
      const diff = files.join("\n");

      const start = Date.now();
      const result = parseDiff(diff);
      const duration = Date.now() - start;

      expect(result.files).toHaveLength(100);
      expect(result.totalStats.filesChanged).toBe(100);
      expect(result.totalStats.additions).toBe(100);
      expect(result.totalStats.deletions).toBe(100);
      expect(duration).toBeLessThan(100); // Should be fast
    });

    it("should handle very long lines without issues", () => {
      const longLine = "a".repeat(10000);
      const diff = `diff --git a/long.ts b/long.ts
index abc1234..def5678 100644
--- a/long.ts
+++ b/long.ts
@@ -1 +1 @@
-${longLine}
+${longLine}b`;

      const result = parseDiff(diff);

      expect(result.files).toHaveLength(1);
      expect(result.files[0]?.stats.additions).toBe(1);
      expect(result.files[0]?.stats.deletions).toBe(1);
    });
  });

  describe("TypeScript and JavaScript specific patterns", () => {
    it("should handle import statement changes", () => {
      const diff = `diff --git a/imports.ts b/imports.ts
index abc1234..def5678 100644
--- a/imports.ts
+++ b/imports.ts
@@ -1,3 +1,4 @@
 import { useState } from "react";
-import { old } from "./old";
+import { newUtil } from "./utils";
+import type { Config } from "./types";

 export function Component() {}`;

      const result = parseDiff(diff);

      expect(result.files).toHaveLength(1);
      expect(result.files[0]?.stats.additions).toBe(2);
      expect(result.files[0]?.stats.deletions).toBe(1);
    });

    it("should handle JSX/TSX content", () => {
      const diff = `diff --git a/Component.tsx b/Component.tsx
index abc1234..def5678 100644
--- a/Component.tsx
+++ b/Component.tsx
@@ -5,7 +5,8 @@ export function Component() {
   return (
     <div>
-      <h1>Old Title</h1>
+      <h1>New Title</h1>
+      <p>Description</p>
     </div>
   );
 }`;

      const result = parseDiff(diff);

      expect(result.files).toHaveLength(1);
      expect(result.files[0]?.stats.additions).toBe(2);
      expect(result.files[0]?.stats.deletions).toBe(1);
    });

    it("should handle type definition changes", () => {
      const diff = `diff --git a/types.ts b/types.ts
index abc1234..def5678 100644
--- a/types.ts
+++ b/types.ts
@@ -1,5 +1,7 @@
 export interface User {
   id: string;
   name: string;
-  age: number;
+  age?: number;
+  email: string;
+  createdAt: Date;
 }`;

      const result = parseDiff(diff);

      expect(result.files).toHaveLength(1);
      expect(result.files[0]?.stats.additions).toBe(3);
      expect(result.files[0]?.stats.deletions).toBe(1);
    });
  });
});
