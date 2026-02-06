import { cn } from "@/utils/cn";
import type { Shortcut } from "./footer-context";

interface FooterProps {
  shortcuts: Shortcut[];
  rightShortcuts?: Shortcut[];
  className?: string;
}

function renderShortcuts(items: Shortcut[]) {
  return items.map((shortcut, index) => (
    <span key={shortcut.key + shortcut.label}>
      <span>{shortcut.key}</span> <span>{shortcut.label}</span>
      {index < items.length - 1 && <span className="text-gray-500">•</span>}
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
