import { Panel } from "@diffgazer/ui/components/panel";
import { cn } from "@diffgazer/ui/lib/utils";
import { type ReactNode, useId } from "react";
import { useFocusWithin } from "@/hooks/use-focus-within";

interface CardLayoutProps {
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
}

/**
 * App-specific shell for the setup and settings-form screens: one panel width, one
 * title treatment, and one content top line so the panel does not jump as the user
 * moves between sibling routes. The panel rests on the app's hairline frame and
 * claims the reticle only while focus actually sits inside it; the notched corner
 * label is the same wayfinding chip the hub and help screens use.
 */
export function CardLayout({
  title,
  subtitle,
  readout,
  children,
  footer,
  contentInactive = false,
}: CardLayoutProps) {
  const titleId = useId();
  const { focusWithin, props: focusProps } = useFocusWithin<HTMLDivElement>();

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-y-auto px-4 py-4">
      <Panel
        {...focusProps}
        focused={focusWithin}
        aria-labelledby={title ? titleId : undefined}
        className="m-auto w-full max-w-2xl"
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
