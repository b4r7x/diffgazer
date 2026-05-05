import { Overflow } from "@/components/ui/overflow"

export default function OverflowTextExample() {
  const longText =
    "This is a very long description that demonstrates how the Overflow component handles text truncation with automatic ellipsis and native browser tooltips on hover."

  return (
    <div className="flex flex-col gap-4">
      <div className="space-y-1.5">
        <span className="text-xs font-mono text-muted-foreground">lines=1 (truncate)</span>
        <div className="w-64 border border-dashed border-foreground/20 p-2">
          <Overflow mode="text">{longText}</Overflow>
        </div>
      </div>

      <div className="space-y-1.5">
        <span className="text-xs font-mono text-muted-foreground">lines=2 (clamp)</span>
        <div className="w-64 border border-dashed border-foreground/20 p-2">
          <Overflow mode="text" lines={2}>{longText}</Overflow>
        </div>
      </div>

      <div className="space-y-1.5">
        <span className="text-xs font-mono text-muted-foreground">lines=3 (clamp)</span>
        <div className="w-64 border border-dashed border-foreground/20 p-2">
          <Overflow mode="text" lines={3}>{longText}</Overflow>
        </div>
      </div>
    </div>
  )
}
