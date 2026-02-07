import { useRef, useEffect } from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "../../lib/cn";
import { useTabsContext } from "./tabs-context";

const tabsTriggerVariants = cva(
  "px-3 py-1 text-sm font-mono transition-colors cursor-pointer border border-[--tui-border] focus:outline-none focus:ring-1 focus:ring-[--tui-primary]",
  {
    variants: {
      variant: {
        default: "",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
);

export interface TabsTriggerProps extends VariantProps<typeof tabsTriggerVariants> {
  value: string;
  children: React.ReactNode;
  className?: string;
  disabled?: boolean;
}

export function TabsTrigger({ value, children, className, disabled, variant }: TabsTriggerProps) {
  const { value: selectedValue, onValueChange, registerTrigger } = useTabsContext();
  const ref = useRef<HTMLButtonElement>(null);
  const isActive = selectedValue === value;

  useEffect(() => {
    registerTrigger(value, ref.current);
    return () => registerTrigger(value, null);
  }, [value, registerTrigger]);

  return (
    <button
      ref={ref}
      id={`tab-${value}`}
      role="tab"
      aria-selected={isActive}
      aria-controls={`tabpanel-${value}`}
      tabIndex={isActive ? 0 : -1}
      disabled={disabled}
      data-state={isActive ? "active" : "inactive"}
      onClick={() => !disabled && onValueChange(value)}
      className={cn(
        tabsTriggerVariants({ variant }),
        isActive && "bg-tui-blue text-primary-foreground border-tui-blue",
        !isActive && !disabled && "bg-[--tui-bg] text-[--tui-fg] hover:bg-[--tui-selection]",
        disabled && "opacity-50 cursor-not-allowed",
        className
      )}
    >
      {children}
    </button>
  );
}
