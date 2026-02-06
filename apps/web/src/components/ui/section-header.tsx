import type { ReactNode } from "react";
import { cn } from "@/utils/cn";

export interface SectionHeaderProps {
  children: ReactNode;
  className?: string;
}

export function SectionHeader({ children, className }: SectionHeaderProps) {
  return (
    <h3 className={cn("text-tui-blue font-bold mb-2 uppercase text-xs tracking-wider", className)}>
      {children}
    </h3>
  );
}
