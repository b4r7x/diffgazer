import type { ReactNode } from "react";
import { cn } from "@diffgazer/core/cn";
import { Card } from "@diffgazer/ui/components/card";

export interface CardLayoutProps {
  title?: string;
  subtitle?: string;
  header?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  size?: "sm" | "md" | "lg";
  className?: string;
}

/**
 * App-specific shell that centers a `Card` and applies setup-page padding/scroll.
 * Uses `Card.size` for width; adds the page-level layout this app needs around it.
 */
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
      <Card variant="panel" size={size} className="border-tui-border bg-tui-bg">
        {header ?? (title && (
          <Card.Header className="border-tui-border bg-tui-selection/30 px-6 py-4">
            <h1 className="text-xl font-bold text-tui-blue tracking-wide">
              {title}
            </h1>
            {subtitle && (
              <p className="text-sm text-tui-muted mt-1">{subtitle}</p>
            )}
          </Card.Header>
        ))}

        <Card.Content className="px-6 py-6 max-h-[60vh] overflow-y-auto scrollbar-thin">{children}</Card.Content>

        {footer && (
          <Card.Footer className="border-tui-border px-6 py-4 flex justify-end gap-3 bg-tui-bg/50">
            {footer}
          </Card.Footer>
        )}
      </Card>
    </div>
  );
}
