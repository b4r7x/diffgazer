import { SearchInput } from "@diffgazer/ui/components/search-input";

interface ModelSearchInputProps {
  value: string;
  onChange: (value: string) => void;
  onFocus: () => void;
  onEscape: () => void;
  onArrowDown: () => void;
  disabled?: boolean;
  ref?: React.Ref<HTMLInputElement>;
}

export function ModelSearchInput({
  value,
  onChange,
  onFocus,
  onEscape,
  onArrowDown,
  disabled = false,
  ref,
}: ModelSearchInputProps) {
  return (
    <div className="px-4 pt-3 pb-2">
      <SearchInput
        ref={ref}
        value={value}
        onChange={onChange}
        onFocus={onFocus}
        disabled={disabled}
        onKeyDown={(e) => {
          if (e.key === "Escape") {
            onEscape();
            // Stop the native <dialog> cancel event so the dialog stays open
            // when the user just wants to clear/escape the search field.
            e.stopPropagation();
            e.preventDefault();
          }
          if (e.key === "ArrowDown") {
            onArrowDown();
            e.preventDefault();
          }
        }}
        aria-label="Search models"
        placeholder="Search models..."
        size="sm"
        className="w-full bg-input-well"
      />
    </div>
  );
}
