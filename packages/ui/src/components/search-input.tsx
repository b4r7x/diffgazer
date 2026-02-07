import { cn } from "../lib/cn";

export interface SearchInputProps {
  value: string;
  onChange: (value: string) => void;
  onEscape?: () => void;
  onArrowUp?: () => void;
  onArrowDown?: () => void;
  onEnter?: () => void;
  onFocus?: () => void;
  placeholder?: string;
  prefix?: React.ReactNode;
  showActiveIndicator?: boolean;
  className?: string;
  ref?: React.Ref<HTMLInputElement>;
}

export function SearchInput({
  value,
  onChange,
  onEscape,
  onArrowUp,
  onArrowDown,
  onEnter,
  onFocus,
  placeholder = "Search...",
  prefix,
  showActiveIndicator = true,
  className,
  ref,
}: SearchInputProps) {
  return (
    <div
      className={cn(
        "flex items-center gap-2 p-3 bg-tui-bg border-x border-b border-tui-border text-sm font-mono shrink-0",
        className
      )}
    >
      {prefix !== undefined ? (
        prefix
      ) : (
        <span className="text-tui-blue font-bold">/</span>
      )}
      <input
        ref={ref}
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onFocus={onFocus}
        onKeyDown={(e) => {
          if (e.key === "Escape" && onEscape) {
            e.stopPropagation();
            onEscape();
          } else if (e.key === "ArrowUp" && onArrowUp) {
            e.preventDefault();
            onArrowUp();
          } else if (e.key === "ArrowDown" && onArrowDown) {
            e.preventDefault();
            onArrowDown();
          } else if (e.key === "Enter" && onEnter) {
            e.preventDefault();
            onEnter();
          }
        }}
        placeholder={placeholder}
        className="flex-1 bg-transparent outline-none font-mono text-xs text-tui-fg placeholder:text-tui-muted"
      />
      {showActiveIndicator && value && (
        <span className="w-2 h-4 bg-tui-blue opacity-50 animate-pulse" />
      )}
    </div>
  );
}
