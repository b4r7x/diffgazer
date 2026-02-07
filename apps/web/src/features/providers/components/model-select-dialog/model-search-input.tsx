import { Button } from "@stargazer/ui";

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
        <div className="relative flex-1">
          <span className="absolute left-2 top-1/2 -translate-y-1/2 text-tui-muted text-xs">
            /
          </span>
          <input
            ref={ref}
            type="text"
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
            placeholder="Search models..."
            className="w-full bg-tui-input-bg border border-tui-border px-3 py-1.5 pl-6 text-xs focus:border-tui-blue focus:outline-none placeholder:text-muted-foreground"
          />
        </div>
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
