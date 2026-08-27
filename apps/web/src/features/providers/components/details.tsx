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
import { KeyValue } from "@diffgazer/ui/components/key-value";
import { Panel, type PanelProps } from "@diffgazer/ui/components/panel";
import { ScrollArea } from "@diffgazer/ui/components/scroll-area";
import { SectionHeader } from "@diffgazer/ui/components/section-header";
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
  consentLinkRef?: RefObject<HTMLButtonElement | null>;
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

/** Rail tint per status variant; neutral keeps the frame's plain --border-strong rail. */
const STATUS_RAIL_TONE: Record<BadgeVariant, PanelProps["tone"]> = {
  success: "success",
  warning: "warning",
  error: "error",
  info: "info",
  neutral: undefined,
};

/**
 * One scroll/layout contract for the pane, shared by the empty and populated
 * states. It stays the "details" zone focus target with keyboard scrolling, but
 * paints no inset ring of its own: the Panel reticle around it is the pane's
 * single mark.
 */
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
      className="@container flex min-h-0 flex-1 flex-col focus:outline-none max-md:overflow-x-visible max-md:overflow-y-visible"
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
  consentLinkRef,
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
          className="flex flex-col gap-6 p-6 focus:outline-none"
        >
          {actionRow}
          {/* Rail, not the default enclosure: the pane's guidance annotates the
              actions it sits under, where a boxed panel would read as another
              section of the pane. The status guidance below makes the same call. */}
          <Panel frame="rail" density="compact">
            <Panel.Content spacing="none">
              <p className="text-xs leading-relaxed text-foreground">
                {UNRECOGNIZED_CONFIGURATION_COPY.description}
              </p>
              <p className="mt-1 font-mono text-2xs leading-relaxed text-muted-foreground">
                {unrecognized.configurationId}
              </p>
            </Panel.Content>
          </Panel>
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

  const displayStatus = getProviderDisplayStatus(row.readiness);
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

      {/* Keyboard focus parks here after a row action removes its own target.
          No ring of its own: the Panel reticle already names the pane it landed
          in, and a pane wears one mark. */}
      <div
        ref={focusFallbackRef}
        tabIndex={-1}
        className="flex flex-col gap-6 p-6 pt-3 focus:outline-none"
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
              ref={consentLinkRef}
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

        <Panel frame="rail" tone={STATUS_RAIL_TONE[displayStatus.variant]} density="compact">
          <Panel.Content spacing="none">
            <p className="text-xs leading-relaxed text-foreground">{displayStatus.explanation}</p>
            {row.readiness.remediation.code === "none" ? null : (
              <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                {displayStatus.remediation}
              </p>
            )}
          </Panel.Content>
        </Panel>

        <section>
          <SectionHeader variant="accent" bordered className="mb-3">
            Configuration
          </SectionHeader>
          <Panel density="compact">
            <Panel.Content spacing="none">
              {/* A description list, so the facts are announced as paired terms and
                  definitions rather than a run of text. Rows separate by spacing, not
                  rules — the section underline and the panel border already frame the
                  block, matching the prose sections below. The description qualifies
                  the value, so it goes through KeyValue.Item's description slot — a
                  second definition of the same term — never inside the label slot,
                  which would seat a whole sentence between a label and the value
                  answering it. */}
              <KeyValue>
                {factRows.map((fact) => (
                  <KeyValue.Item
                    key={fact.id}
                    label={fact.label}
                    value={fact.value}
                    description={fact.description}
                    className="text-xs"
                    valueClassName="text-xs"
                    descriptionClassName="text-2xs"
                  />
                ))}
              </KeyValue>
            </Panel.Content>
          </Panel>
        </section>

        {proseRows.map((prose) => (
          <section key={prose.id}>
            <SectionHeader variant="accent" bordered className="mb-3">
              {prose.label}
            </SectionHeader>
            <Panel density="compact">
              <Panel.Content spacing="sm">
                <p className="text-xs leading-relaxed text-foreground">{prose.value}</p>
                {prose.description ? (
                  <p className="text-2xs leading-relaxed text-muted-foreground">
                    {prose.description}
                  </p>
                ) : null}
              </Panel.Content>
            </Panel>
          </section>
        ))}
      </div>
    </ProviderDetailsPane>
  );
}
