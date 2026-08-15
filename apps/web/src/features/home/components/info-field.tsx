import { Button } from "@diffgazer/ui/components/button";
import { SectionHeader, sectionHeaderVariants } from "@diffgazer/ui/components/section-header";
import { cn } from "@diffgazer/ui/lib/utils";
import type { ReactNode } from "react";

/**
 * Label treatment. The context panel is an ANSI-coded readout: every row keeps
 * its own label hue (trust blue/amber, provider violet, last run green) while
 * values stay neutral — the pre-mobile composition this panel is judged
 * against, and the same colour vocabulary the TUI sidebar speaks.
 */
type InfoFieldTone = "default" | "info" | "warning" | "accent" | "success";

export interface InfoFieldProps {
  label: string;
  tone?: InfoFieldTone;
  children: ReactNode;
  className?: string;
  onClick?: () => void;
  ariaLabel?: string;
}

const toneClasses: Record<InfoFieldTone, string> = {
  default: "text-muted-foreground",
  info: "text-info-text",
  warning: "text-warning-text",
  accent: "text-accent",
  success: "text-success-text",
};

export function InfoField({
  label,
  tone = "default",
  children,
  className,
  onClick,
  ariaLabel,
}: InfoFieldProps) {
  const labelClassName = cn("mb-1", toneClasses[tone]);

  // One block owns the label/value stack so the clickable and static rows lay
  // out identically — Button is a flex row, and two bare children would sit
  // side by side there and stacked here.
  if (onClick) {
    return (
      <Button
        variant="ghost"
        className={cn(
          "w-full text-left h-auto whitespace-normal p-0 justify-start hover:bg-transparent hover:opacity-80 transition-opacity",
          className,
        )}
        onClick={onClick}
        aria-label={ariaLabel ?? `${label} settings`}
      >
        <div className="w-full min-w-0">
          {/* A span, not the SectionHeader element: <button> takes phrasing content only,
              and everything inside it is presentational, so a heading here would be invalid
              markup that assistive tech prunes from the outline anyway. The button's
              aria-label already names the row. Sharing sectionHeaderVariants keeps the two
              branches visually identical. */}
          <span className={cn(sectionHeaderVariants({ as: "h3" }), "block", labelClassName)}>
            {label}
          </span>
          <div className="text-foreground">{children}</div>
        </div>
      </Button>
    );
  }

  return (
    <div className={className}>
      <div className="w-full min-w-0">
        <SectionHeader as="h3" className={labelClassName}>
          {label}
        </SectionHeader>
        <div className="text-foreground">{children}</div>
      </div>
    </div>
  );
}
