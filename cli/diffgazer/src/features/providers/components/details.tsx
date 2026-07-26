import {
  getDisplayStatusBadge,
  getProviderDetailModelLabel,
  PROVIDER_DETAIL_ACTION_LABELS,
  PROVIDER_DETAIL_EMPTY_LABEL,
} from "@diffgazer/core/providers";
import {
  type AIProvider,
  type DisplayStatus,
  PROVIDER_CAPABILITIES,
} from "@diffgazer/core/schemas/config";
import { Box, Text } from "ink";
import type { ReactElement } from "react";
import { Badge } from "../../../components/ui/badge";
import { Button } from "../../../components/ui/button";
import { KeyValue } from "../../../components/ui/key-value";
import { useActionRow } from "../../../hooks/use-action-row";
import { useTheme } from "../../../theme/provider";

export interface ProviderDetailData {
  id: AIProvider;
  name: string;
  displayStatus: DisplayStatus;
  model?: string;
  defaultModel?: string;
}

/**
 * Rows the body needs to breathe: eight labelled rows with a blank line between
 * them plus the wrapped action block. Below this the blank lines go first —
 * a dense list beats actions the pane has to clip.
 */
export const COMFORTABLE_DETAILS_ROWS = 21;

interface ProviderDetailsProps {
  provider?: ProviderDetailData;
  isActive?: boolean;
  onConfigureKey?: () => void;
  onSelectModel?: () => void;
  onRemove?: () => void;
  onSetActive?: () => void;
  isPending?: boolean;
  compact?: boolean;
}

export function ProviderDetails({
  provider,
  isActive = false,
  onConfigureKey,
  onSelectModel,
  onRemove,
  onSetActive,
  isPending = false,
  compact = false,
}: ProviderDetailsProps): ReactElement {
  const { tokens } = useTheme();
  const showRemove = provider?.displayStatus !== "needs-key";
  const selectModelDisabled = provider?.displayStatus === "needs-key";
  const setActiveDisabled = provider?.displayStatus === "active" || isPending;
  const actions = useActionRow({
    actionCount: 4,
    disabledActions: [
      setActiveDisabled,
      isPending,
      selectModelDisabled || isPending,
      !showRemove || isPending,
    ],
    onAction: (index) => {
      if (index === 0) onSetActive?.();
      if (index === 1) onConfigureKey?.();
      if (index === 2) onSelectModel?.();
      if (index === 3) onRemove?.();
    },
    isActive,
  });

  if (!provider) {
    return (
      <Box>
        <Text color={tokens.muted}>{PROVIDER_DETAIL_EMPTY_LABEL}</Text>
      </Box>
    );
  }

  const badge = getDisplayStatusBadge(provider.displayStatus);
  const capabilities = PROVIDER_CAPABILITIES[provider.id];
  return (
    <Box flexDirection="column" gap={compact ? 0 : 1}>
      <KeyValue label="Name" value={provider.name} labelWidth={14} />
      <KeyValue label="ID" value={provider.id} labelWidth={14} />
      <KeyValue
        label="Status"
        value={
          <Badge variant={badge.variant} dot>
            {badge.label}
          </Badge>
        }
        labelWidth={14}
      />
      <KeyValue
        label="Model"
        value={getProviderDetailModelLabel(provider.id, provider.model, provider.defaultModel)}
        labelWidth={14}
      />
      <KeyValue label="Tool Calling" value={capabilities.toolCalling} labelWidth={14} />
      <KeyValue label="JSON Mode" value={capabilities.jsonMode} labelWidth={14} />
      <KeyValue label="Streaming" value={capabilities.streaming} labelWidth={14} />
      <KeyValue label="Context" value={capabilities.contextWindow} labelWidth={14} />

      {/* The actions wrap instead of stacking: four rows of buttons plus their
          gaps outgrow the pane and Ink paints the overflow onto the border. */}
      <Box flexWrap="wrap" gap={1} marginTop={1}>
        <Button
          variant="primary"
          isActive={actions.isActionActive(0)}
          onPress={() => actions.activate(0)}
          disabled={setActiveDisabled}
        >
          Set Active
        </Button>
        <Button
          variant="secondary"
          isActive={actions.isActionActive(1)}
          onPress={() => actions.activate(1)}
          disabled={isPending}
        >
          {PROVIDER_DETAIL_ACTION_LABELS.configureApiKey}
        </Button>
        <Button
          variant="secondary"
          isActive={actions.isActionActive(2)}
          onPress={() => actions.activate(2)}
          disabled={selectModelDisabled || isPending}
        >
          {PROVIDER_DETAIL_ACTION_LABELS.selectModel}
        </Button>
        {showRemove && (
          <Button
            variant="destructive"
            isActive={actions.isActionActive(3)}
            onPress={() => actions.activate(3)}
            disabled={isPending}
          >
            {PROVIDER_DETAIL_ACTION_LABELS.removeKey}
          </Button>
        )}
      </Box>
    </Box>
  );
}
