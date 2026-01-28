import { cn } from "@/lib/utils";
import type { TierFilter } from "./use-model-filter";

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
        <button
          key={filter}
          type="button"
          onClick={() => {
            onTabClick(idx);
            onValueChange(filter);
          }}
          className={cn(
            "px-2 py-0.5 text-[10px] cursor-pointer transition-colors uppercase",
            value === filter
              ? "bg-tui-blue text-black font-bold"
              : "border border-tui-border hover:border-tui-fg",
            isFocused &&
              focusedIndex === idx &&
              "ring-2 ring-tui-blue ring-offset-1 ring-offset-tui-bg"
          )}
        >
          {filter}
        </button>
      ))}
    </div>
  );
}

export { FILTERS };
