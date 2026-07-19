import { Card } from "@diffgazer/ui/components/card";
import { Typography } from "@diffgazer/ui/components/typography";
import { cn } from "@diffgazer/ui/lib/utils";
import type { ReactNode } from "react";

export interface CardLayoutProps {
  title?: string;
  subtitle?: string;
  children: ReactNode;
  footer?: ReactNode;
  contentInactive?: boolean;
}

/**
 * App-specific shell that centers a `Card` and applies setup-page padding/scroll.
 * Uses `Card.size` for width; adds the page-level layout this app needs around it.
 */
export function CardLayout({
  title,
  subtitle,
  children,
  footer,
  contentInactive = false,
}: CardLayoutProps) {
  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-y-auto px-4">
      <Card surface="stacked" size="lg" className="m-auto border-border bg-background">
        {title && (
          <Card.Header className="border-border bg-secondary/30 px-6 py-4">
            <Typography as="h1" size="xl" className="text-info-text tracking-wide">
              {title}
            </Typography>
            {subtitle && <p className="text-sm text-muted-foreground mt-1">{subtitle}</p>}
          </Card.Header>
        )}

        <Card.Content
          className={cn(
            "max-h-[60dvh] overflow-y-auto px-6 py-6 scrollbar-thin transition-opacity",
            contentInactive && "opacity-60",
          )}
        >
          {children}
        </Card.Content>

        {footer && (
          <Card.Footer className="border-border px-6 py-4 flex justify-end gap-3 bg-background/50">
            {footer}
          </Card.Footer>
        )}
      </Card>
    </div>
  );
}
