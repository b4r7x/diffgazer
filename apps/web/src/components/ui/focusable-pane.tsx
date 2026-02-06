import type { ReactNode } from "react";
import { cn } from '@/utils/cn';

export interface FocusablePaneProps {
  isFocused?: boolean;
  children: ReactNode;
  className?: string;
}

export function FocusablePane({ isFocused, children, className }: FocusablePaneProps) {
  return (
    <div className={cn(isFocused && "ring-1 ring-tui-blue ring-inset", className)}>
      {children}
    </div>
  );
}
