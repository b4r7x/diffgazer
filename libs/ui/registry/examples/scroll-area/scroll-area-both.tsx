import { ScrollArea } from "@/components/ui/scroll-area";

export default function ScrollAreaBoth() {
  return (
    // The 1px inset keeps both tracks off the container border, so the resting
    // horizontal thumb reads as its own edge instead of doubling the frame.
    <div className="w-full min-w-0 border border-border p-px">
      <ScrollArea aria-label="Two-axis demo" orientation="both" className="h-32 p-2">
        <div className="w-[600px]">
          {Array.from({ length: 15 }, (_, i) => (
            // biome-ignore lint/suspicious/noArrayIndexKey: fixed-length synthetic demo rows that never change order; the index is the stable identity.
            <div key={`b-line-${i}`} className="py-1 text-sm text-foreground whitespace-nowrap">
              {`Line ${i + 1}: ${"lorem ipsum dolor sit amet consectetur ".repeat(3)}`}
            </div>
          ))}
        </div>
      </ScrollArea>
    </div>
  );
}
