interface SearchInputProps {
  value: string;
  onChange: (value: string) => void;
  onFocus?: () => void;
  onEscape: () => void;
  onArrowUp?: () => void;
  onArrowDown?: () => void;
  placeholder?: string;
  ref?: React.Ref<HTMLInputElement>;
}

export function SearchInput({
  value,
  onChange,
  onFocus,
  onEscape,
  onArrowUp,
  onArrowDown,
  placeholder = "Search runs by ID...",
  ref,
}: SearchInputProps) {
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
          } else if (e.key === "ArrowDown" && onArrowDown) {
            e.preventDefault();
            onArrowDown();
          }
        }}
        placeholder={placeholder}
        className="flex-1 bg-transparent outline-none font-mono text-xs text-tui-fg placeholder:text-gray-500"
      />
      {value && <span className="w-2 h-4 bg-tui-blue opacity-50 animate-pulse" />}
    </div>
  );
}
