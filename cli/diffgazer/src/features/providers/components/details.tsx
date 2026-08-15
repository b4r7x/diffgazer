import type { ProviderListRow } from "@diffgazer/core/providers";
import {
  getProviderDisplayStatus,
  PROVIDER_DETAIL_EMPTY_LABEL,
  UNRECOGNIZED_CONFIGURATION_COPY,
} from "@diffgazer/core/providers";
import type { UnrecognizedConfiguration } from "@diffgazer/core/schemas/config";
import { buildProviderSettingsRows } from "@diffgazer/core/schemas/config";
import { Box, Text } from "ink";
import type { ReactElement } from "react";
import { Badge } from "../../../components/ui/badge";
import { Button } from "../../../components/ui/button";
import { KeyValue } from "../../../components/ui/key-value";
import { useActionRow } from "../../../hooks/use-action-row";
import { useTheme } from "../../../theme/provider";
import {
  getProviderActionSlots,
  getUnrecognizedConfigurationActionSlots,
} from "../lib/action-slots";
import { formatModelLabel } from "../lib/model-label";

/**
 * Rows the body needs to breathe: labelled settings rows plus the wrapped action
 * block. Below this the blank lines go first — a dense list beats clipped actions.
 */
export const COMFORTABLE_DETAILS_ROWS = 23;

function getDetailActionVariant(index: number): "primary" | "secondary" | "destructive" {
  if (index === 0) return "primary";
  if (index === 2) return "destructive";
  return "secondary";
}

interface ProviderActions {
  onSetup: () => void;
  onSelectModel: () => void;
  onDelete: () => void;
  onDispatchAction: () => void;
}

interface ProviderDetailsProps {
  row?: ProviderListRow | null;
  /**
   * Set instead of `row` when the highlighted list row is a stored record this
   * build could not decode; it takes precedence, because such a record never
   * produces a provider row.
   */
  unrecognized?: UnrecognizedConfiguration | null;
  actions: ProviderActions;
  isActive?: boolean;
  isPending?: boolean;
  compact?: boolean;
}

export function ProviderDetails({
  row,
  unrecognized = null,
  actions,
  isActive = false,
  isPending = false,
  compact = false,
}: ProviderDetailsProps): ReactElement {
  const { tokens } = useTheme();
  const slots = unrecognized
    ? getUnrecognizedConfigurationActionSlots()
    : getProviderActionSlots(row);
  const buttonActions = [
    actions.onDispatchAction,
    actions.onSetup,
    actions.onDelete,
    actions.onSelectModel,
  ];

  const detailActions = useActionRow({
    actionCount: 4,
    disabledActions: slots.map((slot) => !slot.enabled || isPending),
    onAction: (index) => buttonActions[index]?.(),
    isActive,
  });

  const actionRow = (
    <Box flexWrap="wrap" gap={1} marginTop={1}>
      {slots.map((slot, index) => (
        <Button
          // biome-ignore lint/suspicious/noArrayIndexKey: labels repeat across slots; the fixed four-slot position is the identity.
          key={index}
          variant={getDetailActionVariant(index)}
          isActive={detailActions.isActionActive(index)}
          onPress={() => detailActions.activate(index)}
          disabled={isPending || !slot.enabled}
        >
          {slot.label}
        </Button>
      ))}
    </Box>
  );

  if (unrecognized) {
    return (
      <Box flexDirection="column" gap={compact ? 0 : 1}>
        <KeyValue label="Name" value={UNRECOGNIZED_CONFIGURATION_COPY.label} labelWidth={14} />
        <KeyValue label="Configuration" value={unrecognized.configurationId} labelWidth={14} />
        {actionRow}
        <Text color={tokens.muted}>{UNRECOGNIZED_CONFIGURATION_COPY.description}</Text>
      </Box>
    );
  }

  if (!row) {
    return (
      <Box>
        <Text color={tokens.muted}>{PROVIDER_DETAIL_EMPTY_LABEL}</Text>
      </Box>
    );
  }

  const displayStatus = getProviderDisplayStatus(row.readiness, row.product.transportFamily);
  const settingsRows = buildProviderSettingsRows(row);
  const modelId = row.configuration?.selectedModelId;

  return (
    <Box flexDirection="column" gap={compact ? 0 : 1}>
      <KeyValue label="Name" value={row.product.name} labelWidth={14} />
      <KeyValue label="Product" value={row.product.productId} labelWidth={14} />
      {/* The narrow list drops the id when the row cannot fit it, so this pane is
          where the configured model is always named in full. */}
      {modelId ? (
        <KeyValue
          label="Model"
          value={formatModelLabel(row.product.productId, modelId)}
          labelWidth={14}
        />
      ) : null}
      <KeyValue
        label="Status"
        value={
          <Badge variant={displayStatus.variant} dot>
            {displayStatus.label}
          </Badge>
        }
        labelWidth={14}
      />
      {settingsRows.map((settingsRow) => (
        <KeyValue
          key={settingsRow.id}
          label={settingsRow.label}
          value={settingsRow.value}
          labelWidth={14}
        />
      ))}

      {actionRow}

      {/* What to do about the status, including what Test readiness costs. It
          seats under the actions like the web rail so a long remediation cannot
          push the buttons out of this clipped pane. */}
      {row.readiness.remediation.code === "none" ? null : (
        <Text color={tokens.muted}>{displayStatus.remediation}</Text>
      )}
    </Box>
  );
}
