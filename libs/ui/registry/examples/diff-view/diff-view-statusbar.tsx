import { DiffView } from "@/components/ui/diff-view"
import { Kbd } from "@/components/ui/kbd"

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

export default function DiffViewStatusbar() {
  return (
    <DiffView
      patch={patch}
      variant="statusbar"
      // statusBar is a headless slot — the consumer owns styling and content.
      statusBar={
        <div className="flex items-center justify-between gap-4">
          <span>+5 −2 · 1 hunk</span>
          <span className="flex items-center gap-2">
            <Kbd size="sm">j</Kbd>
            <Kbd size="sm">k</Kbd>
            <span>navigate</span>
          </span>
        </div>
      }
    />
  )
}
