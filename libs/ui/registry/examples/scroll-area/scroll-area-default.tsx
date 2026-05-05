import { ScrollArea } from "@/components/ui/scroll-area"

export default function ScrollAreaDefault() {
  const items = Array.from({ length: 20 }, (_, i) => `Item ${i + 1}`)
  return (
    <ScrollArea className="h-48 border border-border p-2">
      {items.map((item) => (
        <div key={item} className="py-1 px-2 text-sm text-foreground border-b border-border/30">
          {item}
        </div>
      ))}
    </ScrollArea>
  )
}
