import { formatKeyForDisplay } from "./utils";

interface HotkeyHintProps {
  keys: string;
  children: React.ReactNode;
  className?: string;
}

export function HotkeyHint({ keys, children, className }: HotkeyHintProps) {
  const displayKey = formatKeyForDisplay(keys);

  return (
    <span className={className}>
      <kbd className="inline-flex items-center justify-center rounded border border-border bg-muted px-1.5 py-0.5 font-mono text-xs text-muted-foreground">
        {displayKey}
      </kbd>
      <span className="ml-2">{children}</span>
    </span>
  );
}
