import { DiffView } from "@/components/ui/diff-view";

const patch = `--- a/src/server/review-pipeline.ts
+++ b/src/server/review-pipeline.ts
@@ -1,29 +1,44 @@
-import { parseDiff } from "@/lib/diff"
-import type { Review, Finding } from "../types"
+import { parseDiff, annotateWordDiff } from "@/lib/diff"
+import type { Review, Finding, ReviewOptions } from "../types"
+import { loadRules } from "./rules"

-export async function runReview(patch: string): Promise<Review> {
+export async function runReview(patch: string, options: ReviewOptions = {}): Promise<Review> {
+  const rules = await loadRules(options.rulesPath)
   const parsed = parseDiff(patch)
   const findings: Finding[] = []

   for (const file of parsed.files) {
-    for (const hunk of file.hunks) {
-      for (const change of hunk.changes) {
-        if (change.type !== "add") continue
-        if (change.content.includes("TODO")) {
-          findings.push({
-            file: file.newPath,
-            line: change.newLine,
-            severity: "warning",
-            message: "TODO comment in added code",
-          })
-        }
-      }
-    }
+    const fileFindings = await reviewFile(file, rules)
+    findings.push(...fileFindings)
   }

-  return { findings, score: findings.length }
+  return { findings, score: scoreFindings(findings, rules) }
 }

-export function isPassingScore(score: number): boolean {
-  return score < 5
+async function reviewFile(file: ParsedFile, rules: Rule[]): Promise<Finding[]> {
+  const results: Finding[] = []
+  for (const hunk of file.hunks) {
+    const annotated = annotateWordDiff(hunk.changes)
+    for (const change of annotated) {
+      if (change.type !== "add") continue
+      for (const rule of rules) {
+        const hit = rule.check(change.content)
+        if (!hit) continue
+        results.push({
+          file: file.newPath,
+          line: change.newLine,
+          severity: rule.severity,
+          message: hit.message,
+        })
+      }
+    }
+  }
+  return results
+}
+
+function scoreFindings(findings: Finding[], rules: Rule[]): number {
+  return findings.reduce((total, finding) => {
+    const weight = rules.find((r) => r.id === finding.ruleId)?.weight ?? 1
+    return total + weight
+  }, 0)
 }
`;

export default function DiffViewMaxHeight() {
  return <DiffView patch={patch} maxHeight="240px" showLineNumbers />;
}
