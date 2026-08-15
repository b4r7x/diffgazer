import { TIER_FILTERS, type TierFilter } from "@diffgazer/core/providers";
import { createToggleGroup } from "@diffgazer/ui/components/toggle-group";
import type { KeyboardEvent as ReactKeyboardEvent, RefCallback } from "react";

const TierFilterGroup = createToggleGroup(TIER_FILTERS);

interface ModelFilterTabsProps {
  value: TierFilter;
  onChange: (value: TierFilter) => void;
  focusedIndex: number;
  isFocused: boolean;
  disabled?: boolean;
  onKeyDown?: (event: ReactKeyboardEvent) => void;
  /** Ref registry plus the dialog's focus mirror, the row's one index channel. */
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
  disabled = false,
  onKeyDown,
  getTabProps,
}: ModelFilterTabsProps) {
  const handleFilterChange = (nextValue: TierFilter | null) => {
    if (nextValue) onChange(nextValue);
  };

  return (
    <TierFilterGroup
      value={value}
      onChange={handleFilterChange}
      highlighted={isFocused ? (TIER_FILTERS[focusedIndex] ?? null) : null}
      onKeyDown={onKeyDown}
      label="Model tier filter"
      className="px-5 pb-2"
      disabled={disabled}
    >
      {TIER_FILTERS.map((filter, idx) => {
        const tabProps = getTabProps?.(idx);

        return (
          <TierFilterGroup.Item
            key={filter}
            value={filter}
            ref={tabProps?.ref}
            onFocus={tabProps?.onFocus}
            className="h-6 min-h-0 px-2.5 text-2xs uppercase pointer-coarse:min-h-11 pointer-coarse:px-3"
          >
            {filter}
          </TierFilterGroup.Item>
        );
      })}
    </TierFilterGroup>
  );
}
