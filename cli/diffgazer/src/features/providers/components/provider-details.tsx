import type { ReactElement } from "react";
import { Box, Text } from "ink";
import type { DisplayStatus } from "@diffgazer/core/schemas/config";
import { getDisplayStatusBadge } from "@diffgazer/core/providers";
import { useTheme } from "../../../theme/theme-context.js";
import { KeyValue } from "../../../components/ui/key-value.js";
import { Badge } from "../../../components/ui/badge.js";
import { Button } from "../../../components/ui/button.js";

export interface ProviderDetailData {
  id: string;
  name: string;
  displayStatus: DisplayStatus;
  model?: string;
  defaultModel?: string;
}

interface ProviderDetailsProps {
  provider?: ProviderDetailData;
  onConfigureKey?: () => void;
  onSelectModel?: () => void;
  onRemove?: () => void;
}

export function ProviderDetails({
  provider,
  onConfigureKey,
  onSelectModel,
  onRemove,
}: ProviderDetailsProps): ReactElement {
  const { tokens } = useTheme();

  if (!provider) {
    return (
      <Box>
        <Text color={tokens.muted}>Select a provider to view details</Text>
      </Box>
    );
  }

  const badge = getDisplayStatusBadge(provider.displayStatus);

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
        value={
          provider.model
            ? provider.model
            : provider.defaultModel
              ? `${provider.defaultModel} (default)`
              : "none"
        }
        labelWidth={14}
      />

      <Box gap={1} marginTop={1}>
        <Button variant="primary" onPress={onConfigureKey}>
          Configure API Key
        </Button>
        <Button variant="secondary" onPress={onSelectModel}>
          Select Model
        </Button>
        {provider.displayStatus !== "needs-key" && (
          <Button variant="destructive" onPress={onRemove}>
            Remove
          </Button>
        )}
      </Box>
    </Box>
  );
}
