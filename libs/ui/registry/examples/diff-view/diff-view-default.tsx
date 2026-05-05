import { DiffView } from "@/components/ui/diff-view"

const patch = `--- a/src/utils/score.ts
+++ b/src/utils/score.ts
@@ -1,8 +1,10 @@
 import type { Review } from "../types"

-export function calculateScore(review: Review): number {
-  return review.findings.length * 10
+export function calculateScore(review: Review, weights: Record<string, number>): number {
+  return review.findings.reduce((total, finding) => {
+    const weight = weights[finding.severity] ?? 1
+    return total + weight
+  }, 0)
 }

 export function isPassingScore(score: number): boolean {`

export default function DiffViewDefault() {
  return <DiffView patch={patch} />
}
