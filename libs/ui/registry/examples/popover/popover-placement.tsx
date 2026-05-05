import { Popover } from "@/components/ui/popover"

export default function PopoverPlacementExample() {
  const sides = ["top", "bottom", "left", "right"] as const

  return (
    <div className="flex flex-wrap items-center gap-4">
      {sides.map((side) => (
        <Popover key={side}>
          <Popover.Trigger>
            {(triggerProps) => (
              <button {...triggerProps} className="border border-foreground/30 px-3 py-1 font-mono text-sm">
                {side}
              </button>
            )}
          </Popover.Trigger>
          <Popover.Content
            side={side}
            className="border border-border bg-background px-3 py-2 font-mono text-xs text-foreground shadow-md"
          >
            Placed on {side}
          </Popover.Content>
        </Popover>
      ))}
    </div>
  )
}
