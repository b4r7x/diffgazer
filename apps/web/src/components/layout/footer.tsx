import type { Shortcut } from "@diffgazer/core/schemas/presentation";
import { Kbd } from "@diffgazer/ui/components/kbd";
import { cn } from "@diffgazer/ui/lib/utils";

interface FooterProps {
  shortcuts: Shortcut[];
  rightShortcuts?: Shortcut[];
  className?: string;
}

function renderShortcuts(items: Shortcut[]) {
  const activeItems = items.filter((shortcut) => !shortcut.disabled);

  return activeItems.map((shortcut, index) => (
    <span key={`${shortcut.key}-${shortcut.label}`} className="whitespace-nowrap">
      <Kbd>{shortcut.key}</Kbd> <span>{shortcut.label}</span>
      {index < activeItems.length - 1 && <span className="text-muted-foreground">•</span>}
    </span>
  ));
}

export function Footer({ shortcuts, rightShortcuts, className = "" }: FooterProps) {
  return (
    <footer
      className={cn(
        "hidden shrink-0 bg-foreground px-2 py-1 text-2xs font-bold text-background pointer-fine:block sm:py-2 sm:text-xs",
        className,
      )}
    >
      <div
        data-shortcut-legend
        className="flex items-center justify-between gap-x-4 gap-y-1 max-sm:flex-nowrap max-sm:overflow-x-auto max-sm:scrollbar-hide max-sm:[mask-image:linear-gradient(to_right,black_calc(100%-1.25rem),transparent)] sm:flex-wrap"
      >
        <div className="flex gap-4 max-sm:shrink-0 sm:flex-wrap">{renderShortcuts(shortcuts)}</div>
        {rightShortcuts && rightShortcuts.length > 0 && (
          <div className="flex gap-4 max-sm:shrink-0 sm:flex-wrap">
            {renderShortcuts(rightShortcuts)}
          </div>
        )}
      </div>
    </footer>
  );
}
