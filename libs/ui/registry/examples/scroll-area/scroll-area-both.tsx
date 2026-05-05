import { ScrollArea } from "@/components/ui/scroll-area"

export default function ScrollAreaBoth() {
  return (
    <ScrollArea orientation="both" className="h-32 border border-border p-2">
      <div className="w-[600px]">
        {Array.from({ length: 15 }, (_, i) => (
          <div key={`b-line-${i}`} className="py-1 text-sm text-foreground whitespace-nowrap">
            {`Line ${i + 1}: ${"lorem ipsum dolor sit amet consectetur ".repeat(3)}`}
          </div>
        ))}
      </div>
    </ScrollArea>
  )
}
