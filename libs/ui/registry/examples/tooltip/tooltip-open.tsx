import { Tooltip } from "@/components/ui/tooltip";

// Controlled `open` with no setter pins the surface open, so the open state
// stays reviewable in a documentation page or a screenshot. `defaultOpen` is
// not enough here: it seeds uncontrolled state that the hover tooltip's own
// scroll dismissal then clears the moment a reader scrolls down to this
// example. Real tooltips open on hover/focus — do not pin `open` in product
// code.
const TRIGGER =
  "border border-foreground/30 px-3 py-1 font-mono text-sm focus-visible:outline-2 focus-visible:outline-ring focus-visible:outline-offset-0";

export default function TooltipOpenExample() {
  return (
    <div className="flex flex-wrap items-center gap-16 py-14">
      <Tooltip open>
        <Tooltip.Trigger>
          <button type="button" className={TRIGGER}>
            Above
          </button>
        </Tooltip.Trigger>
        <Tooltip.Content side="top">Runs the review pipeline</Tooltip.Content>
      </Tooltip>

      <Tooltip open>
        <Tooltip.Trigger>
          <button type="button" className={TRIGGER}>
            Below
          </button>
        </Tooltip.Trigger>
        <Tooltip.Content side="bottom">--surface-1 fill, 1px hairline, no shadow</Tooltip.Content>
      </Tooltip>

      <Tooltip open>
        <Tooltip.Trigger>
          <button type="button" className={TRIGGER}>
            Right
          </button>
        </Tooltip.Trigger>
        <Tooltip.Content side="right">Mono type, tight padding</Tooltip.Content>
      </Tooltip>
    </div>
  );
}
