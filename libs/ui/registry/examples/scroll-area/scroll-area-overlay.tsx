import { ScrollArea } from "@/components/ui/scroll-area";

export default function ScrollAreaOverlay() {
  const items = Array.from({ length: 20 }, (_, i) => `Row ${i + 1}`);
  return (
    <ScrollArea overlay aria-label="Full-bleed rows" className="h-48 border border-border">
      {items.map((item) => (
        <div key={item} className="py-1 px-2 text-sm text-foreground border-b border-b-border/30">
          {item}
        </div>
      ))}
    </ScrollArea>
  );
}
