import { Button } from "@/components/ui";
import { cn } from "@/lib/utils";
import type { TierFilter } from "../../hooks/use-model-filter.js";

const FILTERS: TierFilter[] = ["all", "free", "paid"];

interface ModelFilterTabsProps {
  value: TierFilter;
  onValueChange: (value: TierFilter) => void;
  focusedIndex: number;
  isFocused: boolean;
  onTabClick: (index: number) => void;
}

export function ModelFilterTabs({
  value,
  onValueChange,
  focusedIndex,
  isFocused,
  onTabClick,
}: ModelFilterTabsProps) {
  return (
    <div className="px-4 pb-2 flex gap-1.5">
      {FILTERS.map((filter, idx) => (
        <Button
          key={filter}
          variant="toggle"
          size="sm"
          data-active={value === filter}
          onClick={() => {
            onTabClick(idx);
            onValueChange(filter);
          }}
          className={cn(
            "uppercase text-[10px] h-auto px-2 py-0.5",
            isFocused &&
              focusedIndex === idx &&
              "ring-2 ring-tui-blue ring-offset-1 ring-offset-tui-bg"
          )}
        >
          {filter}
        </Button>
      ))}
    </div>
  );
}

export { FILTERS };
