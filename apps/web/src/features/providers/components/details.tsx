import type { ProviderListRow } from "@diffgazer/core/providers";
import { getProviderDisplayStatus } from "@diffgazer/core/providers";
import { buildProviderSettingsRows } from "@diffgazer/core/schemas/config";
import { Button } from "@diffgazer/ui/components/button";
import { EmptyState } from "@diffgazer/ui/components/empty-state";
import { KeyValue } from "@diffgazer/ui/components/key-value";
import { SectionHeader } from "@diffgazer/ui/components/section-header";
import type { RefCallback } from "react";
import { getProviderActionSlots } from "../hooks/use-action-buttons";

export interface ProviderActions {
  onSetup: () => void;
  onSelectModel: () => void;
  onDelete: () => void;
  onDispatchAction: () => void;
}

export interface ProviderDetailsProps {
  row: ProviderListRow | null;
  actions: ProviderActions;
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

const PROVIDER_DETAIL_EMPTY_LABEL = "Select a provider to view details";

function actionButtonVariant(index: number): "primary" | "secondary" | "destructive" {
  if (index === 0) return "primary";
  if (index === 2) return "destructive";
  return "secondary";
}

export function ProviderDetails({
  row,
  actions,
  isPending = false,
  focusedButtonIndex,
  isFocused = false,
  getButtonProps,
}: ProviderDetailsProps) {
  if (!row) {
    return (
      <div className="@container flex flex-1 flex-col overflow-y-auto">
        <div className="p-3 border-b border-border bg-secondary/30 flex justify-between items-center">
          <SectionHeader as="h2">Provider Details</SectionHeader>
        </div>
        <EmptyState className="flex-1">{PROVIDER_DETAIL_EMPTY_LABEL}</EmptyState>
      </div>
    );
  }

  const displayStatus = getProviderDisplayStatus(row.readiness, row.product.transportFamily);
  const settingsRows = buildProviderSettingsRows(row);
  const slots = getProviderActionSlots(row);
  const buttonActions = [
    actions.onDispatchAction,
    actions.onSetup,
    actions.onDelete,
    actions.onSelectModel,
  ];

  return (
    <div className="@container flex flex-1 flex-col overflow-y-auto">
      <div className="p-3 border-b border-border bg-secondary/30 flex justify-between items-center">
        <SectionHeader as="h2">Provider Details: {row.product.name}</SectionHeader>
        {/* biome-ignore lint/a11y/useSemanticElements: role="status" matches the header StatusIndicator live-readout pattern; <output> carries form-association semantics that do not fit here. */}
        <span
          role="status"
          aria-label={displayStatus.accessibleText}
          className="shrink-0 font-mono text-2xs text-muted-foreground"
        >
          [ {displayStatus.label.toUpperCase()} ]
        </span>
      </div>

      <div className="p-6">
        <section className="mb-6">
          <SectionHeader variant="muted" bordered className="mb-4 border-border">
            Configuration
          </SectionHeader>
          <KeyValue>
            {settingsRows.map((settingsRow) => (
              <KeyValue.Item
                key={settingsRow.id}
                label={settingsRow.label}
                value={
                  settingsRow.description
                    ? `${settingsRow.value} — ${settingsRow.description}`
                    : settingsRow.value
                }
                bordered
              />
            ))}
          </KeyValue>
        </section>

        {row.product.status === "removed" ? (
          <section className="mb-6">
            <SectionHeader variant="muted" bordered className="mb-4 border-border">
              Migration
            </SectionHeader>
            <p className="text-xs text-muted-foreground leading-relaxed">
              {displayStatus.remediation}
            </p>
          </section>
        ) : null}

        <section className="mt-auto">
          <div className="flex flex-wrap gap-3 pt-4">
            {slots.map((slot, index) => (
              <Button
                key={slot.label}
                {...getButtonProps?.(index)}
                variant={actionButtonVariant(index)}
                bracket
                onClick={buttonActions[index]}
                disabled={isPending || !slot.enabled}
                highlighted={isFocused && focusedButtonIndex === index && slot.enabled}
                aria-label={
                  slot.disabledReason ? `${slot.label}. ${slot.disabledReason}` : slot.label
                }
              >
                {slot.label}
              </Button>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
