import type { ReactNode } from "react";
import { cn } from "../lib/cn";

export interface CardLayoutProps {
  title?: string;
  subtitle?: string;
  header?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  size?: "sm" | "md" | "lg";
  className?: string;
}

const sizeClasses: Record<NonNullable<CardLayoutProps["size"]>, string> = {
  sm: "max-w-sm",
  md: "max-w-md",
  lg: "max-w-lg",
};

export function CardLayout({
  title,
  subtitle,
  header,
  children,
  footer,
  size = "lg",
  className,
}: CardLayoutProps) {
  return (
    <div className={cn("flex-1 flex flex-col items-center justify-center px-4", className)}>
      <div className={cn("w-full border border-tui-border bg-tui-bg shadow-2xl", sizeClasses[size])}>
        {/* Header */}
        {header ?? (title && (
          <div className="border-b border-tui-border bg-tui-selection/30 px-6 py-4">
            <h1 className="text-xl font-bold text-tui-blue tracking-wide">
              {title}
            </h1>
            {subtitle && (
              <p className="text-sm text-tui-muted mt-1">{subtitle}</p>
            )}
          </div>
        ))}

        {/* Content */}
        <div className="px-6 py-6 max-h-[60vh] overflow-y-auto scrollbar-thin">{children}</div>

        {/* Footer */}
        {footer && (
          <div className="border-t border-tui-border px-6 py-4 flex justify-end gap-3 bg-tui-bg/50">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}
