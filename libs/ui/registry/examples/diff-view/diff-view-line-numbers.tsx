import { DiffView } from "@/components/ui/diff-view";

const patch = `--- a/src/utils/score.ts
+++ b/src/utils/score.ts
@@ -1,7 +1,10 @@
 import type { Review } from "../types"

-export function calculateScore(review: Review): number {
-  return review.findings.length * 10
+export function calculateScore(review: Review, weights: Record<string, number>): number {
+  return review.findings.reduce((total, finding) => {
+    const weight = weights[finding.severity] ?? 1
+    return total + weight
+  }, 0)
 }

 export function isPassingScore(score: number): boolean {
`;

export default function DiffViewLineNumbers() {
  return (
    <div className="flex w-full min-w-0 flex-col gap-4">
      {/* Numbers ship on: the product addresses every finding as file:line. */}
      <DiffView patch={patch} />
      <DiffView patch={patch} mode="split" />
      {/* Opting out is the rarer case, so it is the explicit one. */}
      <DiffView patch={patch} showLineNumbers={false} />
    </div>
  );
}
