import type { KeyboardEvent as ReactKeyboardEvent, RefCallback } from "react";
import { ToggleGroup, ToggleGroupItem } from "@diffgazer/ui/components/toggle-group";
import { TIER_FILTERS, type TierFilter } from "@/features/providers/constants";

interface ModelFilterTabsProps {
  value: TierFilter;
  onChange: (value: TierFilter) => void;
  focusedIndex: number;
  isFocused: boolean;
  onTabClick: (index: number) => void;
  onKeyDown?: (event: ReactKeyboardEvent) => void;
  getTabProps?: (index: number) => {
    ref: RefCallback<HTMLButtonElement>;
    onFocus: () => void;
  };
}

export function ModelFilterTabs({
  value,
  onChange,
  focusedIndex,
  isFocused,
  onTabClick,
  onKeyDown,
  getTabProps,
}: ModelFilterTabsProps) {
  const handleFilterChange = (nextValue: string | null) => {
    const index = TIER_FILTERS.findIndex((filter) => filter === nextValue);
    if (index === -1) return;
    const nextFilter = TIER_FILTERS[index];
    if (!nextFilter) return;
    onTabClick(index);
    onChange(nextFilter);
  };

  const handleHighlightChange = (nextValue: string | null) => {
    const index = TIER_FILTERS.findIndex((filter) => filter === nextValue);
    if (index >= 0) onTabClick(index);
  };

  return (
    <ToggleGroup
      value={value}
      onChange={handleFilterChange}
      onHighlightChange={handleHighlightChange}
      highlighted={isFocused ? TIER_FILTERS[focusedIndex] ?? null : null}
      onKeyDown={onKeyDown}
      label="Model tier filter"
      className="px-4 pb-2"
    >
      {TIER_FILTERS.map((filter, idx) => {
        const tabProps = getTabProps?.(idx);

        return (
          <ToggleGroupItem
            key={filter}
            value={filter}
            ref={tabProps?.ref}
            onFocus={() => {
              tabProps?.onFocus();
              onTabClick(idx);
            }}
            onClick={() => {
              onTabClick(idx);
            }}
            className="uppercase text-[10px] min-h-0 min-w-0 h-auto px-2 py-0.5"
          >
            {filter}
          </ToggleGroupItem>
        );
      })}
    </ToggleGroup>
  );
}
