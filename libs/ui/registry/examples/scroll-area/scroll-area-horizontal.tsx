import { ScrollArea } from "@/components/ui/scroll-area"

export default function ScrollAreaHorizontal() {
  return (
    <ScrollArea orientation="horizontal" className="border border-border p-2">
      <div className="flex gap-2 w-[800px]">
        {Array.from({ length: 12 }, (_, i) => (
          <div key={`h-block-${i}`} className="shrink-0 w-24 h-16 border border-border bg-secondary flex items-center justify-center text-xs text-muted-foreground">
            Block {i + 1}
          </div>
        ))}
      </div>
    </ScrollArea>
  )
}
