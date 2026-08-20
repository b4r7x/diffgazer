import { SearchInput } from "@diffgazer/ui/components/search-input";

interface ModelSearchInputProps {
  value: string;
  onChange: (value: string) => void;
  onFocus: () => void;
  onArrowDown: () => void;
  disabled?: boolean;
  ref?: React.Ref<HTMLInputElement>;
}

/**
 * Esc staging is SearchInput's own contract: a press with a query clears it and
 * consumes the event; an empty-query press propagates to the dialog cancel, so
 * clearing-then-closing takes two presses like the TUI.
 */
export function ModelSearchInput({
  value,
  onChange,
  onFocus,
  onArrowDown,
  disabled = false,
  ref,
}: ModelSearchInputProps) {
  return (
    <div className="px-5 pt-3 pb-2">
      <SearchInput
        ref={ref}
        value={value}
        onChange={onChange}
        onFocus={onFocus}
        disabled={disabled}
        onKeyDown={(e) => {
          if (e.key === "ArrowDown") {
            onArrowDown();
            e.preventDefault();
          }
        }}
        aria-label="Search models"
        placeholder="Search models..."
        size="md"
        className="w-full bg-input-well"
      />
    </div>
  );
}
