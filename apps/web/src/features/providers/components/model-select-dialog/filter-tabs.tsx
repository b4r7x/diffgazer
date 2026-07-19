import { TIER_FILTERS, type TierFilter } from "@diffgazer/core/providers";
import { ToggleGroup, ToggleGroupItem } from "@diffgazer/ui/components/toggle-group";
import type { KeyboardEvent as ReactKeyboardEvent, RefCallback } from "react";

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
  const handleFilterChange = (nextValue: TierFilter | null) => {
    if (!nextValue) return;
    const index = TIER_FILTERS.indexOf(nextValue);
    onTabClick(index);
    onChange(nextValue);
  };

  const handleHighlightChange = (nextValue: TierFilter | null) => {
    if (nextValue) onTabClick(TIER_FILTERS.indexOf(nextValue));
  };

  return (
    <ToggleGroup<TierFilter>
      value={value}
      onChange={handleFilterChange}
      onHighlightChange={handleHighlightChange}
      highlighted={isFocused ? (TIER_FILTERS[focusedIndex] ?? null) : null}
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
            className="text-2xs uppercase pointer-coarse:min-h-11 pointer-coarse:px-3"
          >
            {filter}
          </ToggleGroupItem>
        );
      })}
    </ToggleGroup>
  );
}
