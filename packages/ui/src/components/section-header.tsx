import type { ReactNode } from "react";
import { cn } from "../lib/cn";

export interface SectionHeaderProps {
  children: ReactNode;
  className?: string;
  variant?: "default" | "muted";
  as?: "h2" | "h3" | "h4";
}

const variantClasses: Record<NonNullable<SectionHeaderProps["variant"]>, string> = {
  default: "text-tui-blue",
  muted: "text-tui-muted",
};

export function SectionHeader({ children, className, variant = "default", as: Tag = "h3" }: SectionHeaderProps) {
  return (
    <Tag className={cn("font-bold mb-2 uppercase text-xs tracking-wider", variantClasses[variant], className)}>
      {children}
    </Tag>
  );
}
