import { Tooltip } from "@/components/ui/tooltip"

export default function TooltipBasicExample() {
  return (
    <div className="flex items-center gap-6">
      <Tooltip content="Shorthand tooltip">
        <span className="border border-foreground/30 px-3 py-1 font-mono text-sm">
          hover me
        </span>
      </Tooltip>

      <Tooltip>
        <Tooltip.Trigger>
          <span className="border border-foreground/30 px-3 py-1 font-mono text-sm">
            compound
          </span>
        </Tooltip.Trigger>
        <Tooltip.Content>
          Custom tooltip with <strong>rich content</strong>
        </Tooltip.Content>
      </Tooltip>
    </div>
  )
}
