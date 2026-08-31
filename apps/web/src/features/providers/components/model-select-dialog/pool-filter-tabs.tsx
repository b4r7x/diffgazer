import type { EndpointProfile } from "@diffgazer/core/providers";
import { ToggleGroup, ToggleGroupItem } from "@diffgazer/ui/components/toggle-group";
import type { KeyboardEvent as ReactKeyboardEvent, RefCallback } from "react";

interface ModelPoolFilterTabsProps {
  /** The product's billing pools in rendered order, bound pool first. */
  profiles: readonly EndpointProfile[];
  /** The active pool tab: the pool whose rows the list shows and a save bills. */
  value: string;
  onChange: (value: string) => void;
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

/**
 * The picker's pool filter: the active tab lists the rows its pool serves and
 * names the wallet a confirm moves billing to.
 */
export function ModelPoolFilterTabs({
  profiles,
  value,
  onChange,
  focusedIndex,
  isFocused,
  disabled = false,
  onKeyDown,
  getTabProps,
}: ModelPoolFilterTabsProps) {
  const handlePoolChange = (nextValue: string | null) => {
    if (nextValue) onChange(nextValue);
  };

  return (
    <ToggleGroup
      value={value}
      onChange={handlePoolChange}
      highlighted={isFocused ? (profiles[focusedIndex]?.id ?? null) : null}
      onKeyDown={onKeyDown}
      label="Billing pool"
      disabled={disabled}
    >
      {profiles.map((profile, idx) => {
        const tabProps = getTabProps?.(idx);

        return (
          <ToggleGroupItem
            key={profile.id}
            value={profile.id}
            // The badge-length name fits the row; the accessible name stays the
            // full pool label, which is what the copy elsewhere says.
            aria-label={profile.label}
            ref={tabProps?.ref}
            onFocus={tabProps?.onFocus}
            className="h-6 min-h-0 px-2.5 text-2xs pointer-coarse:min-h-11 pointer-coarse:px-3"
          >
            {profile.shortLabel ?? profile.label}
          </ToggleGroupItem>
        );
      })}
    </ToggleGroup>
  );
}
