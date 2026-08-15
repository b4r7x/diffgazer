import { DiffView } from "@/components/ui/diff-view";

const patch = `--- a/src/utils/score.ts
+++ b/src/utils/score.ts
@@ -1,5 +1,8 @@
 import type { Review } from "../types"

-export function calculateScore(review: Review): number {
-  return review.findings.length * 10
+export function calculateScore(review: Review, weights: Record<string, number>): number {
+  return review.findings.reduce((total, finding) => {
+    const weight = weights[finding.severity] ?? 1
+    return total + weight
+  }, 0)
 }
`;

export default function DiffViewStat() {
  return (
    <div className="flex w-full min-w-0 flex-col gap-4">
      {/* The counts are on by default; the path yields width before they do. */}
      <DiffView patch={patch} />
      <DiffView patch={patch} stat={false} />
    </div>
  );
}
