import type { ProviderListRow } from "@diffgazer/core/providers";
import {
  getProviderDisplayStatus,
  PROVIDER_DETAIL_EMPTY_LABEL,
  UNRECOGNIZED_CONFIGURATION_COPY,
} from "@diffgazer/core/providers";
import type { UnrecognizedConfiguration } from "@diffgazer/core/schemas/config";
import { buildProviderSettingsRows } from "@diffgazer/core/schemas/config";
import type { BadgeVariant } from "@diffgazer/core/schemas/presentation";
import { Button } from "@diffgazer/ui/components/button";
import { EmptyState } from "@diffgazer/ui/components/empty-state";
import { ScrollArea } from "@diffgazer/ui/components/scroll-area";
import { SectionHeader } from "@diffgazer/ui/components/section-header";
import { cn } from "@diffgazer/ui/lib/utils";
import type { ReactNode, RefCallback, RefObject } from "react";
import { isProviderActionDisabled, type ProviderAction } from "../lib/actions";
import { PROVIDER_STATUS_TONE } from "../lib/status-tone";

export interface ProviderDetailsProps {
  row: ProviderListRow | null;
  /**
   * Set instead of `row` when the highlighted list row is a stored record this
   * build could not decode; it takes precedence, because such a record never
   * produces a provider row.
   */
  unrecognized?: UnrecognizedConfiguration | null;
  /** Derived once per selection so the renderer and the keyboard row cannot diverge. */
  actions: readonly ProviderAction[];
  onAction: (action: ProviderAction) => void;
  isPending?: boolean;
  /** Keyboard focus parks here while a pending mutation disables every action button. */
  focusFallbackRef?: RefObject<HTMLDivElement | null>;
  focusedButtonIndex?: number;
  isFocused?: boolean;
  getButtonProps?: (index: number) => {
    ref: RefCallback<HTMLButtonElement>;
    onFocus: () => void;
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

/** One scroll/layout contract for the pane, shared by the empty and populated states. */
function ProviderDetailsPane({ children }: { children: ReactNode }) {
  return (
    <ScrollArea
      keyboardScrollable={false}
      className="@container flex min-h-0 flex-1 flex-col max-md:overflow-x-visible max-md:overflow-y-visible"
    >
      {children}
    </ScrollArea>
  );
}

type ProviderActionRowProps = Pick<
  ProviderDetailsProps,
  "actions" | "onAction" | "isPending" | "focusedButtonIndex" | "isFocused" | "getButtonProps"
>;

/** The one rendering of the action row, shared by every kind of selected record. */
function ProviderActionRow({
  actions,
  onAction,
  isPending = false,
  focusedButtonIndex,
  isFocused = false,
  getButtonProps,
}: ProviderActionRowProps) {
  if (actions.length === 0) return null;

  return (
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
          disabled={isProviderActionDisabled(action, isPending)}
          highlighted={isFocused && focusedButtonIndex === index && !action.disabledReason}
          aria-label={
            action.disabledReason ? `${action.label}. ${action.disabledReason}` : action.label
          }
        >
          {action.label}
        </Button>
      ))}
    </div>
  );
}

export function ProviderDetails({
  row,
  unrecognized = null,
  actions,
  onAction,
  isPending = false,
  focusFallbackRef,
  focusedButtonIndex,
  isFocused = false,
  getButtonProps,
}: ProviderDetailsProps) {
  const actionRow = (
    <ProviderActionRow
      actions={actions}
      onAction={onAction}
      isPending={isPending}
      focusedButtonIndex={focusedButtonIndex}
      isFocused={isFocused}
      getButtonProps={getButtonProps}
    />
  );

  if (unrecognized) {
    return (
      <ProviderDetailsPane>
        {/* No status readout above this pane, so the padding is even all round. */}
        <div
          ref={focusFallbackRef}
          tabIndex={-1}
          className="flex flex-col gap-6 p-6 focus:outline-none"
        >
          {actionRow}
          <div className="border-l-2 border-border pl-3">
            <p className="text-xs leading-relaxed text-foreground">
              {UNRECOGNIZED_CONFIGURATION_COPY.description}
            </p>
            <p className="mt-1 font-mono text-2xs leading-relaxed text-muted-foreground">
              {unrecognized.configurationId}
            </p>
          </div>
        </div>
      </ProviderDetailsPane>
    );
  }

  if (!row) {
    return (
      <ProviderDetailsPane>
        <EmptyState className="flex-1">{PROVIDER_DETAIL_EMPTY_LABEL}</EmptyState>
      </ProviderDetailsPane>
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
    <ProviderDetailsPane>
      {/* Readiness readout seated under the pane chip, data-styled like the
          history RUNS ordering readout rather than a bracketed control. */}
      <div className="flex justify-end px-6 pt-3">
        {/* biome-ignore lint/a11y/useSemanticElements: role="status" matches the header StatusIndicator live-readout pattern; <output> carries form-association semantics that do not fit here. */}
        <span
          role="status"
          aria-label={displayStatus.accessibleText}
          data-tone={displayStatus.variant}
          className={cn("font-mono text-2xs", PROVIDER_STATUS_TONE[displayStatus.variant])}
        >
          [ {displayStatus.label.toUpperCase()} ]
        </span>
      </div>

      <div
        ref={focusFallbackRef}
        tabIndex={-1}
        className="flex flex-col gap-6 p-6 pt-3 focus:outline-none"
      >
        {actionRow}

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
    </ProviderDetailsPane>
  );
}
