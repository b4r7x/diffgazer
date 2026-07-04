import { ScrollArea } from "@/components/ui/scroll-area";

const HORIZONTAL_BLOCKS = Array.from({ length: 12 }, (_, index) => ({
  id: `h-block-${index + 1}`,
  label: `Block ${index + 1}`,
}));

export default function ScrollAreaHorizontal() {
  return (
    <ScrollArea
      aria-label="Horizontal strip"
      orientation="horizontal"
      className="border border-border p-2"
    >
      <div className="flex gap-2 w-[800px]">
        {HORIZONTAL_BLOCKS.map((block) => (
          <div
            key={block.id}
            className="shrink-0 w-24 h-16 border border-border bg-secondary flex items-center justify-center text-xs text-muted-foreground"
          >
            {block.label}
          </div>
        ))}
      </div>
    </ScrollArea>
  );
}
