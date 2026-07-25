import { DiffView } from "@/components/ui/diff-view";
import { Kbd } from "@/components/ui/kbd";

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

export default function DiffViewStatusbar() {
  return (
    <DiffView
      patch={patch}
      variant="statusbar"
      // statusBar is a headless slot — the consumer owns styling and content.
      statusBar={
        <div className="flex items-center justify-between gap-4">
          {/* The diff palette anchors are inherited from the DiffView root, so the
              summary counters carry the same add/remove signal as the rows. */}
          <span className="flex items-center gap-2">
            <span className="font-bold text-(--diff-color-add)">+5</span>
            <span className="font-bold text-(--diff-color-remove)">−2</span>
            <span>· 1 hunk</span>
          </span>
          <span className="flex items-center gap-2">
            <Kbd size="sm">j</Kbd>
            <Kbd size="sm">k</Kbd>
            <span>navigate</span>
          </span>
        </div>
      }
    />
  );
}
