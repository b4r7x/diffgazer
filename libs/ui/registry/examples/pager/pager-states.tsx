import { Pager, PagerLink } from "@/components/ui/pager";

// The interactive classes are applied statically so both treatments stay visible
// in a screenshot. In real usage `hover:` / `focus-visible:` apply them for you.
const HOVER = "text-foreground";
const FOCUS_RING = "text-foreground outline-2 outline-ring outline-offset-0";

const rows = [
  { label: "Resting", className: "", pagerLabel: "Resting page navigation" },
  { label: "Hover", className: HOVER, pagerLabel: "Hover page navigation" },
  { label: "Focus visible", className: FOCUS_RING, pagerLabel: "Focused page navigation" },
];

export default function PagerStates() {
  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-6">
      {rows.map((row) => (
        <div key={row.label} className="flex flex-col gap-2">
          <span className="text-2xs uppercase tracking-wider text-muted-foreground">
            {row.label}
          </span>
          {/* Each nav landmark in one demo needs its own name. */}
          <Pager aria-label={row.pagerLabel}>
            <PagerLink direction="previous" href="/ui/components/badge" className={row.className}>
              Badge
            </PagerLink>
            <PagerLink direction="next" href="/ui/components/button" className={row.className}>
              Button
            </PagerLink>
          </Pager>
        </div>
      ))}
      <p className="text-xs text-muted-foreground">
        Hover lifts the label from --muted-foreground to --foreground. Keyboard focus keeps that
        lift and draws the outside focus ring (2px, --ring, offset 2px) around the link box.
      </p>
    </div>
  );
}
