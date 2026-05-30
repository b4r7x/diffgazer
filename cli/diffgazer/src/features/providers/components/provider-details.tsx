import { useState, type ReactElement } from "react";
import { Box, Text, useInput } from "ink";
import type { DisplayStatus } from "@diffgazer/core/schemas/config";
import { getDisplayStatusBadge } from "@diffgazer/core/providers";
import { useTheme } from "../../../theme/theme-context";
import { KeyValue } from "../../../components/ui/key-value";
import { Badge } from "../../../components/ui/badge";
import { Button } from "../../../components/ui/button";

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

function formatProviderModel(
  model: string | undefined,
  defaultModel: string | undefined,
): string {
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
  const actionCount = showRemove ? 3 : 2;

  useInput(
    (_input, key) => {
      if (key.leftArrow) {
        setActionIndex((i) => Math.max(0, i - 1));
        return;
      }
      if (key.rightArrow) {
        setActionIndex((i) => Math.min(actionCount - 1, i + 1));
        return;
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
  const clampedIndex = Math.min(actionIndex, actionCount - 1);

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
        <Button variant="primary" isActive={isActive && clampedIndex === 0} onPress={onConfigureKey}>
          Configure API Key
        </Button>
        <Button variant="secondary" isActive={isActive && clampedIndex === 1} onPress={onSelectModel} disabled={provider.displayStatus === "needs-key"}>
          Select Model
        </Button>
        {showRemove && (
          <Button variant="destructive" isActive={isActive && clampedIndex === 2} onPress={onRemove}>
            Remove
          </Button>
        )}
      </Box>
    </Box>
  );
}
