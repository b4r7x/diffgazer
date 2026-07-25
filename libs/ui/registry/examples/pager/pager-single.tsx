import { Pager, PagerLink } from "@/components/ui/pager";

// The nav is a block element: give it the content column's width so the top
// hairline reads as a structural rule and the lone link pins to its edge.
export default function PagerSingle() {
  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-8">
      {/* Two pagers in one demo: each nav landmark needs its own name. */}
      <Pager aria-label="Next page navigation">
        <PagerLink direction="next" href="/ui/getting-started">
          Getting Started
        </PagerLink>
      </Pager>
      <Pager aria-label="Previous page navigation">
        <PagerLink direction="previous" href="/ui/getting-started/installation">
          Installation
        </PagerLink>
      </Pager>
    </div>
  );
}
