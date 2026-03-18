import type { ReactNode } from "react";
import { cn } from "../lib/cn";

export interface PanelProps {
  children: ReactNode;
  className?: string;
  borderless?: boolean;
}

export interface PanelHeaderProps {
  children: ReactNode;
  className?: string;
  variant?: "default" | "subtle" | "terminal";
}

export interface PanelContentProps {
  children: ReactNode;
  className?: string;
  spacing?: "none" | "sm" | "md";
}

const spacingClasses: Record<NonNullable<PanelContentProps["spacing"]>, string> = {
  none: "",
  sm: "space-y-2",
  md: "space-y-4",
};

const headerVariants: Record<NonNullable<PanelHeaderProps["variant"]>, string> = {
  default:
    "flex items-center justify-between bg-tui-selection text-tui-muted text-xs px-3 py-1 border-b border-tui-border font-bold uppercase tracking-wider",
  terminal:
    "flex items-center justify-between bg-tui-selection text-tui-muted text-xs px-3 py-1 border-b border-tui-border font-bold uppercase tracking-wider",
  subtle:
    "bg-tui-selection/30 text-tui-muted text-xs p-2 border-b border-tui-border uppercase tracking-widest text-center",
};

export function PanelHeader({
  children,
  className,
  variant = "default",
}: PanelHeaderProps) {
  return (
    <div className={cn(headerVariants[variant], className)}>
      {children}
    </div>
  );
}

export function PanelContent({
  children,
  className,
  spacing = "md",
}: PanelContentProps) {
  return <div className={cn("p-4 text-sm", spacingClasses[spacing], className)}>{children}</div>;
}

export function Panel({ children, className, borderless }: PanelProps) {
  return (
    <div className={cn("relative", !borderless && "border border-tui-border", className)}>
      {children}
    </div>
  );
}
