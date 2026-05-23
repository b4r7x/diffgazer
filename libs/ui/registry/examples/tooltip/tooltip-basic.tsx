import { Tooltip } from "@/components/ui/tooltip"

export default function TooltipBasicExample() {
  return (
    <div className="flex items-center gap-6">
      <Tooltip content="Shorthand tooltip">
        <button type="button" className="border border-foreground/30 px-3 py-1 font-mono text-sm">
          hover me
        </button>
      </Tooltip>

      <Tooltip>
        <Tooltip.Trigger>
          <button type="button" className="border border-foreground/30 px-3 py-1 font-mono text-sm">
            compound
          </button>
        </Tooltip.Trigger>
        <Tooltip.Content>
          Custom tooltip with <strong>rich content</strong>
        </Tooltip.Content>
      </Tooltip>
    </div>
  )
}
