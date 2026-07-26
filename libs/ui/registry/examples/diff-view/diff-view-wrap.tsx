import { DiffView } from "@/components/ui/diff-view";

const patch = `--- a/src/utils/score.ts
+++ b/src/utils/score.ts
@@ -1,4 +1,4 @@
 import type { Review } from "../types"

-export function calculateScore(review: Review): number {
+export function calculateScore(review: Review, weights: Record<string, number>, fallbackWeight = 1): number {
 }
`;

export default function DiffViewWrap() {
  return (
    <div className="flex w-full min-w-0 max-w-md flex-col gap-4">
      {/* Long lines soft-wrap with a 2ch hanging indent, so the gutter still
          reads as a column and there is nothing to drag sideways. */}
      <DiffView patch={patch} wrap />
      {/* The same diff as a filmstrip, for comparison. */}
      <DiffView patch={patch} wrap={false} />
    </div>
  );
}
