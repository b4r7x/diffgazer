import { Panel } from "@diffgazer/ui/components/panel";
import { cn } from "@diffgazer/ui/lib/utils";
import { type ReactNode, useId } from "react";

export interface CardLayoutProps {
  title?: string;
  subtitle?: string;
  children: ReactNode;
  footer?: ReactNode;
  contentInactive?: boolean;
}

/**
 * App-specific shell for the setup and settings-form screens: one panel width, one
 * title treatment, and one content top line so the panel does not jump as the user
 * moves between sibling routes. The viewfinder frame carries the product motif and
 * the notched corner label is the same wayfinding chip the hub and help screens use.
 */
export function CardLayout({
  title,
  subtitle,
  children,
  footer,
  contentInactive = false,
}: CardLayoutProps) {
  const titleId = useId();

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-y-auto px-4 pt-7 pb-4">
      <Panel
        frame="viewfinder"
        aria-labelledby={title ? titleId : undefined}
        className="mx-auto w-full max-w-2xl"
      >
        {title && (
          <Panel.Label>
            <h1 id={titleId}>{title}</h1>
          </Panel.Label>
        )}

        <Panel.Content
          spacing="none"
          className={cn("transition-opacity", contentInactive && "opacity-60")}
        >
          {subtitle && <Panel.Description className="mb-4">{subtitle}</Panel.Description>}
          {children}
        </Panel.Content>

        {footer && <Panel.Footer className="justify-end gap-3">{footer}</Panel.Footer>}
      </Panel>
    </div>
  );
}
