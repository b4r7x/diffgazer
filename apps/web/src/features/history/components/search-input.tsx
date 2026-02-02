import { forwardRef } from "react";

interface SearchInputProps {
  value: string;
  onChange: (value: string) => void;
  onFocus?: () => void;
  onEscape: () => void;
  onArrowUp?: () => void;
  placeholder?: string;
}

export const SearchInput = forwardRef<HTMLInputElement, SearchInputProps>(
  function SearchInput(
    { value, onChange, onFocus, onEscape, onArrowUp, placeholder = "Search runs by ID..." },
    ref
  ) {
    return (
      <div className="flex items-center gap-2 p-3 bg-tui-bg border-x border-b border-tui-border text-sm font-mono shrink-0">
        <span className="text-tui-blue font-bold">/</span>
        <input
          ref={ref}
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onFocus={onFocus}
          onKeyDown={(e) => {
            if (e.key === "Escape") {
              e.stopPropagation();
              onEscape();
            } else if (e.key === "ArrowUp" && onArrowUp) {
              e.preventDefault();
              onArrowUp();
            }
          }}
          placeholder={placeholder}
          className="flex-1 bg-transparent outline-none font-mono text-xs text-tui-fg placeholder:text-gray-500"
        />
        {value && <span className="w-2 h-4 bg-tui-blue opacity-50 animate-pulse" />}
      </div>
    );
  }
);
