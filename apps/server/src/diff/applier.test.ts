import { describe, it, expect } from "vitest";
import { applyPatch } from "./applier.js";

describe("applyPatch", () => {
  describe("simple modifications", () => {
    it("applies a single-line replacement", () => {
      const original = `function test() {
  return false;
}`;
      const patch = `@@ -1,3 +1,3 @@
 function test() {
-  return false;
+  return true;
 }`;

      const result = applyPatch(original, patch);
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value).toBe(`function test() {
  return true;
}`);
      }
    });

    it("applies a multi-line addition", () => {
      const original = `function test() {
  return 1;
}`;
      const patch = `@@ -1,3 +1,5 @@
 function test() {
+  const a = 1;
+  const b = 2;
   return 1;
 }`;

      const result = applyPatch(original, patch);
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value).toBe(`function test() {
  const a = 1;
  const b = 2;
  return 1;
}`);
      }
    });

    it("applies a multi-line deletion", () => {
      const original = `function test() {
  const a = 1;
  const b = 2;
  return a + b;
}`;
      const patch = `@@ -1,5 +1,3 @@
 function test() {
-  const a = 1;
-  const b = 2;
   return a + b;
 }`;

      const result = applyPatch(original, patch);
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value).toBe(`function test() {
  return a + b;
}`);
      }
    });
  });

  describe("multiple hunks", () => {
    it("applies multiple hunks in sequence", () => {
      const original = `line 1
line 2
line 3
line 4
line 5
line 6
line 7
line 8`;
      const patch = `@@ -1,3 +1,3 @@
 line 1
-line 2
+LINE 2
 line 3
@@ -6,3 +6,3 @@
 line 6
-line 7
+LINE 7
 line 8`;

      const result = applyPatch(original, patch);
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value).toBe(`line 1
LINE 2
line 3
line 4
line 5
line 6
LINE 7
line 8`);
      }
    });
  });

  describe("with diff headers", () => {
    it("ignores diff headers and applies hunks", () => {
      const original = `const x = 1;
const y = 2;`;
      const patch = `diff --git a/file.ts b/file.ts
index abc1234..def5678 100644
--- a/file.ts
+++ b/file.ts
@@ -1,2 +1,2 @@
-const x = 1;
+const x = 10;
 const y = 2;`;

      const result = applyPatch(original, patch);
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value).toBe(`const x = 10;
const y = 2;`);
      }
    });
  });

  describe("context matching", () => {
    it("finds context with slight offset", () => {
      const original = `// extra line
function test() {
  return false;
}`;
      const patch = `@@ -1,3 +1,3 @@
 function test() {
-  return false;
+  return true;
 }`;

      const result = applyPatch(original, patch);
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value).toBe(`// extra line
function test() {
  return true;
}`);
      }
    });
  });

  describe("error cases", () => {
    it("returns error for invalid patch with no hunks", () => {
      const original = "some content";
      const patch = "this is not a valid patch";

      const result = applyPatch(original, patch);
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe("PARSE_ERROR");
      }
    });

    it("returns error for context mismatch", () => {
      const original = `completely
different
content`;
      const patch = `@@ -1,3 +1,3 @@
 function test() {
-  return false;
+  return true;
 }`;

      const result = applyPatch(original, patch);
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe("CONTEXT_MISMATCH");
      }
    });
  });

  describe("edge cases", () => {
    it("handles empty additions at beginning", () => {
      const original = `line 1
line 2`;
      const patch = `@@ -0,0 +1,2 @@
+new line 1
+new line 2`;

      const result = applyPatch(original, patch);
      expect(result.ok).toBe(true);
    });

    it("handles no newline at end of file marker", () => {
      const original = `const x = 1;`;
      const patch = `@@ -1 +1 @@
-const x = 1;
\\ No newline at end of file
+const x = 2;`;

      const result = applyPatch(original, patch);
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value).toBe(`const x = 2;`);
      }
    });

    it("handles empty lines in patch", () => {
      const original = `function test() {

  return 1;
}`;
      const patch = `@@ -1,4 +1,4 @@
 function test() {

-  return 1;
+  return 2;
 }`;

      const result = applyPatch(original, patch);
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value).toBe(`function test() {

  return 2;
}`);
      }
    });
  });
});
