import { Popover } from "@/components/ui/popover"

export default function PopoverHoverExample() {
  return (
    <Popover triggerMode="hover" delayMs={300}>
      <Popover.Trigger>
        <span className="border-b border-dashed border-foreground/40 font-mono text-sm cursor-help">
          hover for info
        </span>
      </Popover.Trigger>
      <Popover.Content
        side="top"
        className="max-w-xs border border-border bg-background px-2 py-1 font-mono text-xs text-foreground shadow-md"
      >
        This field is required for validation.
      </Popover.Content>
    </Popover>
  )
}
