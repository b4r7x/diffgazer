import type { ProviderListRow } from "@diffgazer/core/providers";
import {
  getProviderDisplayStatus,
  getProviderRowControls,
  isProviderControlDisabled,
  PROVIDER_DETAIL_EMPTY_LABEL,
  type ProviderActionLayout,
  type ProviderRowControl,
  UNRECOGNIZED_CONFIGURATION_COPY,
} from "@diffgazer/core/providers";
import type { UnrecognizedConfiguration } from "@diffgazer/core/schemas/config";
import { buildProviderSettingsRows } from "@diffgazer/core/schemas/config";
import type { BadgeVariant } from "@diffgazer/core/schemas/presentation";
import { Badge } from "@diffgazer/ui/components/badge";
import { Button } from "@diffgazer/ui/components/button";
import { EmptyState } from "@diffgazer/ui/components/empty-state";
import { ScrollArea } from "@diffgazer/ui/components/scroll-area";
import { SectionHeader } from "@diffgazer/ui/components/section-header";
import { FOCUS_OUTLINE_INSET } from "@diffgazer/ui/lib/focus-outline";
import { cn } from "@diffgazer/ui/lib/utils";
import type { ReactNode, RefCallback, RefObject } from "react";
import { PROVIDER_STATUS_TONE } from "../lib/status-tone";
import { ProviderOverflowMenu, type ProviderOverflowMenuState } from "./overflow-menu";

export interface ProviderDetailsProps {
  row: ProviderListRow | null;
  /**
   * Set instead of `row` when the highlighted list row is a stored record this
   * build could not decode; it takes precedence, because such a record never
   * produces a provider row.
   */
  unrecognized?: UnrecognizedConfiguration | null;
  /** Derived once per selection so the renderer and the keyboard row cannot diverge. */
  layout: ProviderActionLayout;
  onAction: (control: ProviderRowControl) => void;
  overflowMenu: ProviderOverflowMenuState;
  isPending?: boolean;
  /** True until the provider consent is on record; the pane then offers to review it. */
  consentRequired?: boolean;
  onReviewConsent?: () => void;
  /** Keyboard focus parks here while a pending mutation disables every action button. */
  focusFallbackRef?: RefObject<HTMLDivElement | null>;
  /** The action row container: the Tab cycle's action-row target. */
  actionRowRef?: RefObject<HTMLDivElement | null>;
  /** The scrollable pane viewport: the Tab cycle's details-zone target. */
  detailsPaneRef?: RefObject<HTMLDivElement | null>;
  focusedButtonIndex?: number;
  isFocused?: boolean;
  getButtonProps?: (index: number) => {
    ref: RefCallback<HTMLElement>;
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
function ProviderDetailsPane({
  paneRef,
  children,
}: {
  paneRef?: RefObject<HTMLDivElement | null>;
  children: ReactNode;
}) {
  return (
    <ScrollArea
      ref={paneRef}
      aria-label="Provider details content"
      className="@container flex min-h-0 flex-1 flex-col max-md:overflow-x-visible max-md:overflow-y-visible"
    >
      {children}
    </ScrollArea>
  );
}

type ProviderActionRowProps = Pick<
  ProviderDetailsProps,
  | "layout"
  | "onAction"
  | "overflowMenu"
  | "isPending"
  | "actionRowRef"
  | "focusedButtonIndex"
  | "isFocused"
  | "getButtonProps"
>;

/** The one rendering of the action row, shared by every kind of selected record. */
function ProviderActionRow({
  layout,
  onAction,
  overflowMenu,
  isPending = false,
  actionRowRef,
  focusedButtonIndex,
  isFocused = false,
  getButtonProps,
}: ProviderActionRowProps) {
  const controls = getProviderRowControls(layout);
  if (controls.length === 0) return null;

  return (
    // biome-ignore lint/a11y/useSemanticElements: <fieldset> groups form controls and expects a <legend>; this is a labelled action row, and the group role is what makes "exactly one action row" observable.
    <div
      ref={actionRowRef}
      role="group"
      aria-label="Provider actions"
      className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center"
    >
      {/* The active configuration has nothing left to select: its status chip
          takes the primary slot. */}
      {layout.active ? (
        <Badge variant="success" dot>
          Active
        </Badge>
      ) : null}
      {controls.map((control, index) => {
        const buttonProps = getButtonProps?.(index);
        const highlighted = isFocused && focusedButtonIndex === index && !control.disabledReason;
        if (control.id === "more") {
          return (
            <ProviderOverflowMenu
              key={control.id}
              control={control}
              layout={layout}
              onAction={onAction}
              overflowMenu={overflowMenu}
              isPending={isPending}
              highlighted={highlighted}
              buttonProps={buttonProps}
            />
          );
        }
        return (
          <Button
            key={control.id}
            {...buttonProps}
            variant={control === layout.primary ? "primary" : "outline"}
            bracket
            onClick={() => onAction(control)}
            disabled={isProviderControlDisabled(control, isPending)}
            highlighted={highlighted}
            aria-label={
              control.disabledReason ? `${control.label}. ${control.disabledReason}` : control.label
            }
          >
            {control.label}
          </Button>
        );
      })}
    </div>
  );
}

export function ProviderDetails({
  row,
  unrecognized = null,
  layout,
  onAction,
  overflowMenu,
  isPending = false,
  consentRequired = false,
  onReviewConsent,
  focusFallbackRef,
  actionRowRef,
  detailsPaneRef,
  focusedButtonIndex,
  isFocused = false,
  getButtonProps,
}: ProviderDetailsProps) {
  const actionRow = (
    <ProviderActionRow
      layout={layout}
      onAction={onAction}
      overflowMenu={overflowMenu}
      isPending={isPending}
      actionRowRef={actionRowRef}
      focusedButtonIndex={focusedButtonIndex}
      isFocused={isFocused}
      getButtonProps={getButtonProps}
    />
  );

  if (unrecognized) {
    return (
      <ProviderDetailsPane paneRef={detailsPaneRef}>
        {/* No status readout above this pane, so the padding is even all round. */}
        <div
          ref={focusFallbackRef}
          tabIndex={-1}
          className={cn("flex flex-col gap-6 p-6", FOCUS_OUTLINE_INSET)}
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
      <ProviderDetailsPane paneRef={detailsPaneRef}>
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
    <ProviderDetailsPane paneRef={detailsPaneRef}>
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

      {/* Keyboard focus parks here after a row action removes its own target; the
          ring names the pane it landed in. Inset because the pane is a scroller,
          which would clip an outside outline. */}
      <div
        ref={focusFallbackRef}
        tabIndex={-1}
        className={cn("flex flex-col gap-6 p-6 pt-3", FOCUS_OUTLINE_INSET)}
      >
        {actionRow}

        {/* Neutral, not a warning: the app stays usable without the consent, and
            declining the notice must leave a way back to the same notice the
            actions gate on. */}
        {consentRequired ? (
          <p className="flex flex-wrap items-center gap-x-2 font-mono text-2xs text-muted-foreground">
            <span>Consent required to run reviews</span>
            <span aria-hidden="true">·</span>
            <Button
              variant="link"
              size="sm"
              className="h-auto min-h-0 px-0 py-0 text-2xs"
              onClick={onReviewConsent}
              aria-label="Review the provider data notice"
            >
              Review
            </Button>
          </p>
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
    </ProviderDetailsPane>
  );
}
