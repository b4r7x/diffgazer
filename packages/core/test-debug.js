import { parseDiff } from "./src/diff/parser.js";

// Test 1: Multi-hunk with empty line
const diff1 = `diff --git a/multi-hunk.ts b/multi-hunk.ts
index abc1234..def5678 100644
--- a/multi-hunk.ts
+++ b/multi-hunk.ts
@@ -5,7 +5,8 @@ export class Example {
   constructor() {
     this.value = 0;
   }
-

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

const result1 = parseDiff(diff1);
console.log("Multi-hunk test:");
console.log("Additions:", result1.files[0].stats.additions);
console.log("Deletions:", result1.files[0].stats.deletions);

// Test 2: Binary file addition
const diff2 = `diff --git a/image.png b/image.png
new file mode 100644
index 0000000..1234567
Binary files /dev/null and b/image.png differ`;

const result2 = parseDiff(diff2);
console.log("\nBinary addition test:");
console.log("Operation:", result2.files[0]?.operation);
console.log("File paths:", result2.files[0]);

// Test 3: Complex diff
const diff3 = `diff --git a/src/new-feature.ts b/src/new-feature.ts
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
+}`;

const result3 = parseDiff(diff3);
console.log("\nNew file additions:");
console.log("Additions:", result3.files[0].stats.additions);
