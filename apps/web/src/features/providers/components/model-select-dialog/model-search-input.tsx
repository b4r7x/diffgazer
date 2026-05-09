import { Button } from "@diffgazer/ui/components/button";
import { InputGroup } from "@diffgazer/ui/components/input";

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
        <InputGroup
          ref={ref}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onFocus={onFocus}
          onKeyDown={(e) => {
            if (e.key === "Escape") {
              onEscape();
              e.stopPropagation();
            }
            if (e.key === "ArrowDown") {
              onArrowDown();
              e.preventDefault();
            }
            if (e.key === "Enter" && showCustomAction && onUseCustom && canUseCustom) {
              onUseCustom();
              e.preventDefault();
            }
          }}
          aria-label="Search models"
          placeholder="Search models..."
          prefix={<span aria-hidden="true">/</span>}
          size="sm"
          className="flex-1 bg-tui-input-bg border-tui-border"
          inputClassName="text-xs"
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
