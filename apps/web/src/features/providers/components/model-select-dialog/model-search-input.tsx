import { Button } from "@diffgazer/ui/components/button";
import { SearchInput } from "@diffgazer/ui/components/search-input";

interface ModelSearchInputProps {
  value: string;
  onChange: (value: string) => void;
  onFocus: () => void;
  onEscape: () => void;
  onArrowDown: () => void;
  showCustomAction?: boolean;
  onUseCustom?: () => void;
  ref?: React.Ref<HTMLInputElement>;
}

export function ModelSearchInput({
  value,
  onChange,
  onFocus,
  onEscape,
  onArrowDown,
  showCustomAction,
  onUseCustom,
  ref,
}: ModelSearchInputProps) {
  const canUseCustom = Boolean(value.trim());

  return (
    <div className="px-4 pt-3 pb-2">
      <div className="flex gap-2 items-center">
        <SearchInput
          ref={ref}
          value={value}
          onChange={onChange}
          onFocus={onFocus}
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
          onEnter={
            showCustomAction && onUseCustom && canUseCustom
              ? onUseCustom
              : undefined
          }
          aria-label="Search models"
          placeholder="Search models..."
          size="sm"
          className="flex-1 bg-tui-input-bg text-xs"
        />
        {showCustomAction && (
          <Button
            size="sm"
            variant="secondary"
            onClick={onUseCustom}
            disabled={!canUseCustom}
            className="h-auto px-2 py-1 text-[10px]"
          >
            Use ID
          </Button>
        )}
      </div>
      {showCustomAction && (
        <div className="pt-2 text-[10px] text-tui-muted">
          Tip: enter a custom model ID and press Enter
        </div>
      )}
    </div>
  );
}
