import { cn } from "../lib/cn";
import { Button } from "./button";

export interface ToggleGroupItem {
  value: string;
  label: React.ReactNode;
  count?: number;
}

export interface ToggleGroupProps {
  items: ToggleGroupItem[];
  value: string | null;
  onValueChange: (value: string | null) => void;
  allowDeselect?: boolean;
  size?: "sm" | "md";
  className?: string;
}

export function ToggleGroup({
  items,
  value,
  onValueChange,
  allowDeselect = false,
  size = "sm",
  className,
}: ToggleGroupProps) {
  return (
    <div className={cn("flex gap-1.5 flex-wrap", className)}>
      {items.map((item) => {
        const isActive = value === item.value;

        return (
          <Button
            key={item.value}
            variant="toggle"
            size={size}
            data-active={isActive}
            aria-pressed={isActive}
            onClick={() => {
              if (isActive && allowDeselect) {
                onValueChange(null);
              } else {
                onValueChange(item.value);
              }
            }}
            className="h-auto px-2 py-0.5 text-xs"
          >
            {item.count != null ? (
              <>
                [{item.label} {item.count}]
              </>
            ) : (
              item.label
            )}
          </Button>
        );
      })}
    </div>
  );
}
