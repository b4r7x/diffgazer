import { describe, it, expect } from "vitest";
import { parseDiff } from "./parser.js";

describe("parseDiff", () => {
  describe("file operations", () => {
    it("detects add, delete, modify, and rename operations", () => {
      const addDiff = `diff --git a/new.ts b/new.ts
new file mode 100644
index 0000000..1234567
--- /dev/null
+++ b/new.ts
@@ -0,0 +1,2 @@
+export function hello() {
+  return "world";
+}`;

      const deleteDiff = `diff --git a/old.ts b/old.ts
deleted file mode 100644
index 1234567..0000000
--- a/old.ts
+++ /dev/null
@@ -1,2 +0,0 @@
-export function goodbye() {
-  return "world";
-}`;

      const modifyDiff = `diff --git a/file.ts b/file.ts
index abc1234..def5678 100644
--- a/file.ts
+++ b/file.ts
@@ -1,2 +1,2 @@
 export function test() {
-  return false;
+  return true;
 }`;

      const renameDiff = `diff --git a/old-name.ts b/new-name.ts
similarity index 87%
rename from old-name.ts
rename to new-name.ts
index abc1234..def5678 100644
--- a/old-name.ts
+++ b/new-name.ts
@@ -1,2 +1,3 @@
 export function hello() {
-  return "world";
+  console.log("world");
+  return "hello";
 }`;

      expect(parseDiff(addDiff).files[0]?.operation).toBe("add");
      expect(parseDiff(deleteDiff).files[0]?.operation).toBe("delete");
      expect(parseDiff(modifyDiff).files[0]?.operation).toBe("modify");

      const renameResult = parseDiff(renameDiff).files[0];
      expect(renameResult?.operation).toBe("rename");
      expect(renameResult?.filePath).toBe("new-name.ts");
      expect(renameResult?.previousPath).toBe("old-name.ts");
    });
  });

  describe("hunks", () => {
    it("parses multiple hunks with correct line numbers", () => {
      const diff = `diff --git a/multi.ts b/multi.ts
index abc1234..def5678 100644
--- a/multi.ts
+++ b/multi.ts
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
      expect(result.files[0]?.hunks).toHaveLength(2);
      expect(result.files[0]?.hunks[0]).toMatchObject({
        oldStart: 5,
        oldCount: 7,
        newStart: 5,
        newCount: 8
      });
      expect(result.files[0]?.hunks[1]).toMatchObject({
        oldStart: 20,
        oldCount: 6,
        newStart: 21,
        newCount: 7
      });
    });

    it("preserves exact hunk content with context", () => {
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

      const hunk = parseDiff(diff).files[0]?.hunks[0];
      expect(hunk?.content).toContain("function test()");
      expect(hunk?.content).toContain("-  const b = 2;");
      expect(hunk?.content).toContain("+  const b = 3;");
      expect(hunk?.content).toContain("+  const c = 4;");
    });
  });

  describe("stats calculation", () => {
    it("calculates additions and deletions correctly", () => {
      const diff = `diff --git a/file.ts b/file.ts
index abc1234..def5678 100644
--- a/file.ts
+++ b/file.ts
@@ -1,5 +1,7 @@
 export class Calculator {
+  private value: number = 0;
+
   add(x: number, y: number) {
-    return x + y;
+    const result = x + y;
+    return result;
   }
-
-  // Deprecated
 }`;

      const file = parseDiff(diff).files[0];
      expect(file?.stats.additions).toBe(4);
      expect(file?.stats.deletions).toBe(3);
    });

    it("aggregates total stats for multiple files", () => {
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
      expect(result.totalStats).toMatchObject({
        filesChanged: 3,
        additions: 4,
        deletions: 4
      });
    });

    it("calculates sizeBytes from rawDiff", () => {
      const diff = `diff --git a/size.ts b/size.ts
index abc1234..def5678 100644
--- a/size.ts
+++ b/size.ts
@@ -1 +1 @@
-old
+new`;

      const file = parseDiff(diff).files[0];
      expect(file?.stats.sizeBytes).toBe(Buffer.byteLength(diff, "utf-8"));
    });
  });

  describe("binary files", () => {
    it("handles binary files with no content hunks", () => {
      const diff = `diff --git a/image.png b/image.png
new file mode 100644
index 0000000..1234567
--- /dev/null
+++ b/image.png
Binary files /dev/null and b/image.png differ`;

      const file = parseDiff(diff).files[0];
      expect(file?.operation).toBe("add");
      expect(file?.hunks).toHaveLength(0);
      expect(file?.stats.additions).toBe(0);
    });
  });

  describe("edge cases", () => {
    it("handles empty diff", () => {
      expect(parseDiff("").files).toHaveLength(0);
      expect(parseDiff("\n\n  \n\n").files).toHaveLength(0);
    });

    it("handles file paths with spaces and unicode", () => {
      const spaceDiff = `diff --git a/my file.ts b/my file.ts
index abc..def 100644
--- a/my file.ts
+++ b/my file.ts
@@ -1 +1 @@
-old
+new`;

      const unicodeDiff = `diff --git a/文件.ts b/文件.ts
index abc..def 100644
--- a/文件.ts
+++ b/文件.ts
@@ -1 +1 @@
-old
+new`;

      expect(parseDiff(spaceDiff).files[0]?.filePath).toBe("my file.ts");
      expect(parseDiff(unicodeDiff).files[0]?.filePath).toBe("文件.ts");
    });

    it("handles mode changes without content", () => {
      const diff = `diff --git a/script.sh b/script.sh
old mode 100644
new mode 100755
index abc1234..abc1234`;

      const file = parseDiff(diff).files[0];
      expect(file?.operation).toBe("modify");
      expect(file?.hunks).toHaveLength(0);
    });

    it("handles no newline at end of file marker", () => {
      const diff = `diff --git a/file.ts b/file.ts
index abc1234..def5678 100644
--- a/file.ts
+++ b/file.ts
@@ -1,2 +1,2 @@
 const value = 1;
-const old = 2;
\\ No newline at end of file
+const new = 2;`;

      const file = parseDiff(diff).files[0];
      expect(file?.stats.additions).toBe(1);
      expect(file?.stats.deletions).toBe(1);
    });

    it("handles malformed input gracefully", () => {
      expect(parseDiff("@@ -1 +1 @@\n-old\n+new").files).toHaveLength(0);
    });
  });

  describe("complex scenarios", () => {
    it("parses multi-file diff with various operations", () => {
      const diff = `diff --git a/new.ts b/new.ts
new file mode 100644
index 0000000..abc1234
--- /dev/null
+++ b/new.ts
@@ -0,0 +1,5 @@
+export class NewFeature {
+  async execute() {
+    return { status: "success" };
+  }
+}
diff --git a/old.ts b/old.ts
deleted file mode 100644
index def5678..0000000
--- a/old.ts
+++ /dev/null
@@ -1,3 +0,0 @@
-export class OldFeature {
-  execute() {}
-}
diff --git a/helper.ts b/helper.ts
index 1111111..2222222 100644
--- a/helper.ts
+++ b/helper.ts
@@ -1,3 +1,4 @@
 export class Helper {
+  private cache = new Map();
   format(value: string) {
-    return value.trim();
+    return value.trim().toLowerCase();
   }
diff --git a/README.md b/docs/README.md
similarity index 100%
rename from README.md
rename to docs/README.md`;

      const result = parseDiff(diff);
      expect(result.files).toHaveLength(4);

      const newFile = result.files.find(f => f.filePath === "new.ts");
      expect(newFile?.operation).toBe("add");

      const deletedFile = result.files.find(f => f.filePath === "old.ts");
      expect(deletedFile?.operation).toBe("delete");

      const modifiedFile = result.files.find(f => f.filePath === "helper.ts");
      expect(modifiedFile?.operation).toBe("modify");

      const renamedFile = result.files.find(f => f.filePath === "docs/README.md");
      expect(renamedFile?.operation).toBe("rename");
      expect(renamedFile?.previousPath).toBe("README.md");
    });

    it("handles submodules and symlinks", () => {
      const submoduleDiff = `diff --git a/vendor/lib b/vendor/lib
index abc1234..def5678 160000
--- a/vendor/lib
+++ b/vendor/lib
@@ -1 +1 @@
-Subproject commit abc1234567890abcdef1234567890abcdef12345
+Subproject commit def5678901234abcdef5678901234abcdef56789`;

      expect(parseDiff(submoduleDiff).files[0]?.operation).toBe("modify");
    });

    it("handles large diff with many files efficiently", () => {
      const files: string[] = [];
      for (let i = 0; i < 100; i++) {
        files.push(`diff --git a/file${i}.ts b/file${i}.ts
index abc..def 100644
--- a/file${i}.ts
+++ b/file${i}.ts
@@ -1 +1 @@
-old${i}
+new${i}`);
      }

      const start = Date.now();
      const result = parseDiff(files.join("\n"));
      const duration = Date.now() - start;

      expect(result.files).toHaveLength(100);
      expect(result.totalStats.filesChanged).toBe(100);
      expect(duration).toBeLessThan(100);
    });
  });
});
