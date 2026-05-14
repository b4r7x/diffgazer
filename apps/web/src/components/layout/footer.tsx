import { cn } from "@diffgazer/ui/lib/utils";
import { Kbd } from "@diffgazer/ui/components/kbd";
import type { Shortcut } from "./footer-context";

interface FooterProps {
  shortcuts: Shortcut[];
  rightShortcuts?: Shortcut[];
  className?: string;
}

function renderShortcuts(items: Shortcut[]) {
  const activeItems = items.filter((shortcut) => !shortcut.disabled);

  return activeItems.map((shortcut, index) => (
    <span key={`${shortcut.key}-${shortcut.label}`}>
      <Kbd>{shortcut.key}</Kbd> <span>{shortcut.label}</span>
      {index < activeItems.length - 1 && <span className="text-tui-muted">•</span>}
    </span>
  ));
}

export function Footer({ shortcuts, rightShortcuts, className = "" }: FooterProps) {
  return (
    <footer
      className={cn("bg-tui-fg text-black p-2 font-bold text-xs shrink-0 flex justify-between items-center", className)}
    >
      <div className="flex gap-4">{renderShortcuts(shortcuts)}</div>
      {rightShortcuts && rightShortcuts.length > 0 && (
        <div className="flex gap-4">{renderShortcuts(rightShortcuts)}</div>
      )}
    </footer>
  );
}
