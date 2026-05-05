import { Popover } from "@/components/ui/popover"

export default function PopoverBasicExample() {
  return (
    <Popover>
      <Popover.Trigger>
        {(triggerProps) => (
          <button {...triggerProps} className="border border-foreground/30 px-3 py-1 font-mono text-sm">
            click me
          </button>
        )}
      </Popover.Trigger>
      <Popover.Content className="border border-border bg-background p-4 shadow-md font-mono text-sm">
        <p className="text-foreground">Popover content with interactive elements.</p>
        <button className="mt-2 border border-foreground/30 px-2 py-0.5 text-xs">
          action
        </button>
      </Popover.Content>
    </Popover>
  )
}
