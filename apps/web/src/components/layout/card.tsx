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
    // overflow-hidden, not auto: the card is capped to the space below the
    // header and scrolls its own content, so the page never scrolls the
    // wordmark away and the footer actions stay reachable at any height.
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden px-4 py-4 md:p-6 lg:p-8">
      {/* Spare height splits evenly (content lifted 38px above dead centre by the bottom spacer's 76px ledge) around the card — the hero-tier optical band
          every hub/child/home screen shares — and the spacers collapse once the
          card outgrows the viewport. */}
      <div aria-hidden className="grow" />
      <Panel
        {...focusProps}
        focused={focusWithin}
        aria-labelledby={title ? titleId : undefined}
        // min-h-0 lets the panel shrink past its content so the content area,
        // not the page, absorbs the overflow.
        className="mx-auto flex w-full min-h-0 max-w-2xl flex-col"
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

        {/* Plain overflow, not ScrollArea: ScrollArea takes a tab stop when it
            can keyboard-scroll, which would land between the card's controls in
            the traversal order. The browser scrolls focused rows into view;
            scroll-py keeps their 1px focus ring clear of the clipped edge. */}
        <Panel.Content
          spacing="none"
          className={cn(
            "min-h-0 flex-1 overflow-y-auto scroll-py-1 transition-opacity",
            contentInactive && "opacity-60",
          )}
        >
          {subtitle && <Panel.Description className="mb-4">{subtitle}</Panel.Description>}
          {children}
        </Panel.Content>

        {footer && <Panel.Footer className="justify-end gap-3">{footer}</Panel.Footer>}
      </Panel>
      <div aria-hidden className="mt-[76px] grow" />
    </div>
  );
}
