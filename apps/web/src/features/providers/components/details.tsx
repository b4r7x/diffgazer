import type { ProviderListRow } from "@diffgazer/core/providers";
import { getProviderDisplayStatus, PROVIDER_DETAIL_EMPTY_LABEL } from "@diffgazer/core/providers";
import { buildProviderSettingsRows } from "@diffgazer/core/schemas/config";
import type { BadgeVariant } from "@diffgazer/core/schemas/presentation";
import { Button } from "@diffgazer/ui/components/button";
import { EmptyState } from "@diffgazer/ui/components/empty-state";
import { SectionHeader } from "@diffgazer/ui/components/section-header";
import { cn } from "@diffgazer/ui/lib/utils";
import type { RefCallback } from "react";
import type { ProviderAction } from "../lib/actions";
import { PROVIDER_STATUS_TONE } from "../lib/status-tone";

export interface ProviderDetailsProps {
  row: ProviderListRow | null;
  /** Derived once per selection so the renderer and the keyboard row cannot diverge. */
  actions: readonly ProviderAction[];
  onAction: (action: ProviderAction) => void;
  isPending?: boolean;
  focusedButtonIndex?: number;
  isFocused?: boolean;
  getButtonProps?: (index: number) => {
    ref: RefCallback<HTMLButtonElement>;
    onFocus: () => void;
    "aria-disabled"?: boolean;
    title?: string;
  };
}

/** Callout rail border per status variant; the text tone comes from the shared map. */
const STATUS_RAIL: Record<BadgeVariant, string> = {
  success: "border-success-border",
  warning: "border-warning-border",
  error: "border-error-border",
  info: "border-info-border",
  neutral: "border-border",
};

export function ProviderDetails({
  row,
  actions,
  onAction,
  isPending = false,
  focusedButtonIndex,
  isFocused = false,
  getButtonProps,
}: ProviderDetailsProps) {
  if (!row) {
    return (
      <div className="@container flex flex-1 flex-col overflow-y-auto max-md:overflow-y-visible">
        <div className="p-3 border-b border-border bg-secondary/30 flex justify-between items-center">
          <SectionHeader as="h2">Provider Details</SectionHeader>
        </div>
        <EmptyState className="flex-1">{PROVIDER_DETAIL_EMPTY_LABEL}</EmptyState>
      </div>
    );
  }

  const displayStatus = getProviderDisplayStatus(row.readiness, row.product.transportFamily);
  // Readiness already has two renderings on this screen (the header readout and the
  // status rail below the actions), so it is the single row this view drops. Every
  // other row — including any added to the builder later — renders by its kind.
  const settingsRows = buildProviderSettingsRows(row).filter(({ id }) => id !== "readiness");
  const factRows = settingsRows.filter(({ kind }) => kind === "fact");
  const proseRows = settingsRows.filter(({ kind }) => kind === "prose");

  return (
    <div className="@container flex flex-1 flex-col overflow-y-auto max-md:overflow-y-visible">
      <div className="p-3 border-b border-border bg-secondary/30 flex justify-between items-center">
        <SectionHeader as="h2">Provider Details: {row.product.name}</SectionHeader>
        {/* biome-ignore lint/a11y/useSemanticElements: role="status" matches the header StatusIndicator live-readout pattern; <output> carries form-association semantics that do not fit here. */}
        <span
          role="status"
          aria-label={displayStatus.accessibleText}
          data-tone={displayStatus.variant}
          className={cn("shrink-0 font-mono text-2xs", PROVIDER_STATUS_TONE[displayStatus.variant])}
        >
          [ {displayStatus.label.toUpperCase()} ]
        </span>
      </div>

      <div className="flex flex-col gap-6 p-6">
        {actions.length > 0 ? (
          // biome-ignore lint/a11y/useSemanticElements: <fieldset> groups form controls and expects a <legend>; this is a labelled action row, and the group role is what makes "exactly one action row" observable.
          <div
            role="group"
            aria-label="Provider actions"
            className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center"
          >
            {actions.map((action, index) => (
              <Button
                key={action.id}
                {...getButtonProps?.(index)}
                variant={action.intent}
                bracket
                className={action.intent === "destructive" ? "sm:ml-auto" : undefined}
                onClick={() => onAction(action)}
                disabled={isPending || Boolean(action.disabledReason)}
                highlighted={isFocused && focusedButtonIndex === index && !action.disabledReason}
                aria-label={
                  action.disabledReason ? `${action.label}. ${action.disabledReason}` : action.label
                }
              >
                {action.label}
              </Button>
            ))}
          </div>
        ) : null}

        <div className={cn("border-l-2 pl-3", STATUS_RAIL[displayStatus.variant])}>
          <p className="text-xs leading-relaxed text-foreground">{displayStatus.explanation}</p>
          {row.readiness.remediation.code === "none" ? null : (
            <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
              {displayStatus.remediation}
            </p>
          )}
        </div>

        <section>
          <SectionHeader variant="accent" bordered className="mb-3 border-border/60">
            Configuration
          </SectionHeader>
          <dl className="border border-border/60">
            {factRows.map((fact, index) => (
              <div
                key={fact.id}
                className={cn(
                  "grid grid-cols-[auto_minmax(0,1fr)] items-baseline gap-x-6 p-3",
                  index > 0 && "border-t border-border/60",
                )}
              >
                <dt className="text-xs text-muted-foreground">{fact.label}</dt>
                <dd className="text-right text-xs font-bold text-foreground">{fact.value}</dd>
                {fact.description ? (
                  <dd className="col-span-2 mt-2 text-2xs leading-relaxed text-muted-foreground">
                    {fact.description}
                  </dd>
                ) : null}
              </div>
            ))}
          </dl>
        </section>

        {proseRows.map((prose) => (
          <section key={prose.id}>
            <SectionHeader variant="accent" bordered className="mb-3 border-border/60">
              {prose.label}
            </SectionHeader>
            <div className="border border-border/60 p-3">
              <p className="text-xs leading-relaxed text-foreground">{prose.value}</p>
              {prose.description ? (
                <p className="mt-2 text-2xs leading-relaxed text-muted-foreground">
                  {prose.description}
                </p>
              ) : null}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
