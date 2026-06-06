import { Card } from "@diffgazer/ui/components/card";
import { Typography } from "@diffgazer/ui/components/typography";
import { cn } from "@diffgazer/ui/lib/utils";
import type { ReactNode } from "react";

export interface CardLayoutProps {
  title?: string;
  subtitle?: string;
  header?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  size?: "sm" | "md" | "lg";
  className?: string;
  contentInactive?: boolean;
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
  contentInactive = false,
}: CardLayoutProps) {
  return (
    <div className={cn("flex-1 flex flex-col items-center justify-center px-4", className)}>
      <Card surface="stacked" size={size} className="border-tui-border bg-tui-bg">
        {header ?? (title && (
          <Card.Header className="border-tui-border bg-tui-selection/30 px-6 py-4">
            <Typography as="h1" size="xl" className="text-tui-blue tracking-wide">
              {title}
            </Typography>
            {subtitle && (
              <p className="text-sm text-tui-muted mt-1">{subtitle}</p>
            )}
          </Card.Header>
        ))}

        <Card.Content
          className={cn(
            "px-6 py-6 max-h-[60vh] overflow-y-auto scrollbar-thin transition-opacity",
            contentInactive && "opacity-60",
          )}
        >
          {children}
        </Card.Content>

        {footer && (
          <Card.Footer className="border-tui-border px-6 py-4 flex justify-end gap-3 bg-tui-bg/50">
            {footer}
          </Card.Footer>
        )}
      </Card>
    </div>
  );
}
