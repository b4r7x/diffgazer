import { Tooltip } from "@/components/ui/tooltip"

export default function TooltipPlacementExample() {
  const sides = ["top", "bottom", "left", "right"] as const

  return (
    <div className="flex flex-wrap items-center gap-6">
      {sides.map((side) => (
        <Tooltip key={side}>
          <Tooltip.Trigger>
            <span className="border border-foreground/30 px-3 py-1 font-mono text-sm">
              {side}
            </span>
          </Tooltip.Trigger>
          <Tooltip.Content side={side}>
            Tooltip on {side}
          </Tooltip.Content>
        </Tooltip>
      ))}
    </div>
  )
}
