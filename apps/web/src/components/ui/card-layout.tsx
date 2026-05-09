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
      <Card variant="panel" className={cn("border-tui-border bg-tui-bg", sizeClasses[size])}>
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
