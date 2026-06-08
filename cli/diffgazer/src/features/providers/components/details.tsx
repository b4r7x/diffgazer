import { getDisplayStatusBadge } from "@diffgazer/core/providers";
import type { DisplayStatus } from "@diffgazer/core/schemas/config";
import { Box, Text, useInput } from "ink";
import { type ReactElement, useState } from "react";
import { Badge } from "../../../components/ui/badge";
import { Button } from "../../../components/ui/button";
import { KeyValue } from "../../../components/ui/key-value";
import { useTheme } from "../../../theme/provider";

export interface ProviderDetailData {
  id: string;
  name: string;
  displayStatus: DisplayStatus;
  model?: string;
  defaultModel?: string;
}

interface ProviderDetailsProps {
  provider?: ProviderDetailData;
  isActive?: boolean;
  onConfigureKey?: () => void;
  onSelectModel?: () => void;
  onRemove?: () => void;
}

function formatProviderModel(model: string | undefined, defaultModel: string | undefined): string {
  if (model) return model;
  if (defaultModel) return `${defaultModel} (default)`;
  return "none";
}

export function ProviderDetails({
  provider,
  isActive = false,
  onConfigureKey,
  onSelectModel,
  onRemove,
}: ProviderDetailsProps): ReactElement {
  const { tokens } = useTheme();
  const [actionIndex, setActionIndex] = useState(0);

  const showRemove = provider?.displayStatus !== "needs-key";
  const selectModelDisabled = provider?.displayStatus === "needs-key";
  const enabledActions = [true, !selectModelDisabled, showRemove];
  const actionCount = enabledActions.filter(Boolean).length;

  function moveActionIndex(direction: 1 | -1) {
    if (actionCount === 0) return;
    setActionIndex((current) => {
      const clamped = Math.min(current, enabledActions.length - 1);
      let next = clamped;
      do {
        next += direction;
        if (next < 0 || next >= enabledActions.length) {
          return clamped;
        }
      } while (!enabledActions[next]);
      return next;
    });
  }

  useInput(
    (_input, key) => {
      if (key.leftArrow) {
        moveActionIndex(-1);
        return;
      }
      if (key.rightArrow) {
        moveActionIndex(1);
      }
    },
    { isActive },
  );

  if (!provider) {
    return (
      <Box>
        <Text color={tokens.muted}>Select a provider to view details</Text>
      </Box>
    );
  }

  const badge = getDisplayStatusBadge(provider.displayStatus);
  const focusedIndex = enabledActions[actionIndex]
    ? actionIndex
    : enabledActions.findIndex((enabled) => enabled);

  return (
    <Box flexDirection="column" gap={1}>
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
        value={formatProviderModel(provider.model, provider.defaultModel)}
        labelWidth={14}
      />

      <Box gap={1} marginTop={1}>
        <Button
          variant="primary"
          isActive={isActive && focusedIndex === 0}
          onPress={onConfigureKey}
        >
          Configure API Key
        </Button>
        <Button
          variant="secondary"
          isActive={isActive && focusedIndex === 1}
          onPress={onSelectModel}
          disabled={selectModelDisabled}
        >
          Select Model
        </Button>
        {showRemove && (
          <Button
            variant="destructive"
            isActive={isActive && focusedIndex === 2}
            onPress={onRemove}
          >
            Remove
          </Button>
        )}
      </Box>
    </Box>
  );
}
