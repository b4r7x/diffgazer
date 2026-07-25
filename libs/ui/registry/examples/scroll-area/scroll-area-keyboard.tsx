import { ScrollArea } from "@/components/ui/scroll-area";

const ROWS = Array.from({ length: 50 }, (_, index) => ({
  id: `commit-${index + 1}`,
  sha: (0x4a2f01 + index * 7919).toString(16).padStart(7, "0"),
  message: `commit ${index + 1}: refactor module ${String.fromCharCode(97 + (index % 26))}`,
}));

export default function ScrollAreaKeyboard() {
  return (
    <div className="flex flex-col gap-2">
      <p className="font-mono text-xs text-muted-foreground">
        Tab to focus the region, then Arrow / PageUp / PageDown / Home / End to scroll. The focus
        ring marks the region; the thumb proportion shows how far 50 rows run.
      </p>
      <ScrollArea aria-label="Commit log" className="h-48 border border-border p-2">
        {ROWS.map((row) => (
          <div key={row.id} className="flex gap-3 py-1 px-2 font-mono text-sm text-foreground">
            <span className="text-muted-foreground">{row.sha}</span>
            <span className="truncate">{row.message}</span>
          </div>
        ))}
      </ScrollArea>
    </div>
  );
}
