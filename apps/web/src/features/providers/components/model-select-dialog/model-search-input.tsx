import { forwardRef } from "react";

interface ModelSearchInputProps {
  value: string;
  onChange: (value: string) => void;
  onFocus: () => void;
  onEscape: () => void;
  onArrowDown: () => void;
}

export const ModelSearchInput = forwardRef<
  HTMLInputElement,
  ModelSearchInputProps
>(function ModelSearchInput(
  { value, onChange, onFocus, onEscape, onArrowDown },
  ref
) {
  return (
    <div className="px-4 pt-3 pb-2">
      <div className="relative">
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
          }}
          placeholder="Search models..."
          className="w-full bg-tui-input-bg border border-tui-border px-3 py-1.5 pl-6 text-xs focus:border-tui-blue focus:outline-none placeholder:text-gray-600"
        />
      </div>
    </div>
  );
});
