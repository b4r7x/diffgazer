import type { ProviderListRow } from "@diffgazer/core/providers";
import { getProviderDisplayStatus, PROVIDER_DETAIL_EMPTY_LABEL } from "@diffgazer/core/providers";
import { buildProviderSettingsRows } from "@diffgazer/core/schemas/config";
import { Box, Text } from "ink";
import type { ReactElement } from "react";
import { Badge } from "../../../components/ui/badge";
import { Button } from "../../../components/ui/button";
import { KeyValue } from "../../../components/ui/key-value";
import { useActionRow } from "../../../hooks/use-action-row";
import { useTheme } from "../../../theme/provider";
import { getProviderActionSlots } from "../lib/action-slots";

/**
 * Rows the body needs to breathe: labelled settings rows plus the wrapped action
 * block. Below this the blank lines go first — a dense list beats clipped actions.
 */
export const COMFORTABLE_DETAILS_ROWS = 21;

function getDetailActionVariant(index: number): "primary" | "secondary" | "destructive" {
  if (index === 0) return "primary";
  if (index === 2) return "destructive";
  return "secondary";
}

export interface ProviderActions {
  onSetup: () => void;
  onSelectModel: () => void;
  onDelete: () => void;
  onDispatchAction: () => void;
}

interface ProviderDetailsProps {
  row?: ProviderListRow | null;
  actions: ProviderActions;
  isActive?: boolean;
  isPending?: boolean;
  compact?: boolean;
}

export function ProviderDetails({
  row,
  actions,
  isActive = false,
  isPending = false,
  compact = false,
}: ProviderDetailsProps): ReactElement {
  const { tokens } = useTheme();
  const slots = getProviderActionSlots(row);
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

  if (!row) {
    return (
      <Box>
        <Text color={tokens.muted}>{PROVIDER_DETAIL_EMPTY_LABEL}</Text>
      </Box>
    );
  }

  const displayStatus = getProviderDisplayStatus(row.readiness, row.product.transportFamily);
  const settingsRows = buildProviderSettingsRows(row);

  return (
    <Box flexDirection="column" gap={compact ? 0 : 1}>
      <KeyValue label="Name" value={row.product.name} labelWidth={14} />
      <KeyValue label="Product" value={row.product.productId} labelWidth={14} />
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

      {row.product.status === "removed" ? (
        <Text color={tokens.muted}>{displayStatus.remediation}</Text>
      ) : null}

      <Box flexWrap="wrap" gap={1} marginTop={1}>
        {slots.map((slot, index) => (
          <Button
            key={slot.label}
            variant={getDetailActionVariant(index)}
            isActive={detailActions.isActionActive(index)}
            onPress={() => detailActions.activate(index)}
            disabled={isPending || !slot.enabled}
          >
            {slot.label}
          </Button>
        ))}
      </Box>
    </Box>
  );
}
