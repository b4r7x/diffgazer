import { Pager, PagerLink } from "@/components/ui/pager";

// Long neighbour titles are the common case in generated docs navigation. The
// link becomes a flex row capped at half the width so the arrow stays pinned
// while the label clips; the rule keeps its full-width structure.
const CLIP_ROW = "flex max-w-[45%] items-center whitespace-nowrap";

export default function PagerLongLabels() {
  return (
    <div className="mx-auto w-full max-w-md">
      <Pager>
        <PagerLink direction="previous" href="/ui/components/navigation-list" className={CLIP_ROW}>
          <span className="min-w-0 truncate" title="Navigation List — composable rows">
            Navigation List — composable rows
          </span>
        </PagerLink>
        <PagerLink direction="next" href="/ui/components/horizontal-stepper" className={CLIP_ROW}>
          <span className="min-w-0 truncate" title="Horizontal Stepper — compact variant">
            Horizontal Stepper — compact variant
          </span>
        </PagerLink>
      </Pager>
    </div>
  );
}
