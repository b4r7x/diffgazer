import { Panel } from "@diffgazer/ui/components/panel";
import { cn } from "@diffgazer/ui/lib/utils";
import { type ReactNode, useId } from "react";

export interface CardLayoutProps {
  title?: string;
  subtitle?: string;
  /**
   * Flow marker printed ahead of the title, which seats the label on the panel's
   * top rule as a readout instead of a chip parked beside it. Use it for a screen
   * that belongs to a named flow, so the flow is stated in the frame rather than
   * on a subtitle row of its own.
   */
  readout?: string;
  children: ReactNode;
  footer?: ReactNode;
  /**
   * Dims the content while focus sits in the footer action row. The reticle stays
   * on: the actions are inside this panel, so the keys still drive this pane.
   */
  contentInactive?: boolean;
  /**
   * Whether this panel is the pane the keys drive. Setup and settings-form
   * screens are single-pane, so it defaults to true and the panel renders the
   * screen's one reticle; a screen that grows a second pane opts out.
   */
  active?: boolean;
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
  readout,
  children,
  footer,
  contentInactive = false,
  active = true,
}: CardLayoutProps) {
  const titleId = useId();

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-y-auto px-4 pt-7 pb-4">
      <Panel
        frame="viewfinder"
        focused={active}
        aria-labelledby={title ? titleId : undefined}
        className="mx-auto w-full max-w-2xl"
      >
        {title && (
          <Panel.Label
            variant={readout ? "readout" : undefined}
            className={cn(readout && "flex items-center gap-1.5")}
          >
            {readout && <span>{readout} ·</span>}
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
