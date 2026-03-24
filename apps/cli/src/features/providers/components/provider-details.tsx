import type { ReactElement } from "react";
import { Box, Text } from "ink";
import { useTheme } from "../../../theme/theme-context.js";
import { KeyValue } from "../../../components/ui/key-value.js";
import { Badge } from "../../../components/ui/badge.js";
import { Button } from "../../../components/ui/button.js";

export interface ProviderDetailData {
  id: string;
  name: string;
  displayStatus: "active" | "configured" | "needs-key";
  model?: string;
  defaultModel?: string;
}

interface ProviderDetailsProps {
  provider?: ProviderDetailData;
  onConfigureKey?: () => void;
  onSelectModel?: () => void;
  onRemove?: () => void;
}

function statusBadgeVariant(
  displayStatus: ProviderDetailData["displayStatus"],
): "success" | "info" | "warning" {
  switch (displayStatus) {
    case "active":
      return "success";
    case "configured":
      return "info";
    case "needs-key":
      return "warning";
  }
}

function statusLabel(displayStatus: ProviderDetailData["displayStatus"]): string {
  switch (displayStatus) {
    case "active":
      return "active";
    case "configured":
      return "configured";
    case "needs-key":
      return "needs key";
  }
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

  const variant = statusBadgeVariant(provider.displayStatus);

  return (
    <Box flexDirection="column" gap={1}>
      <KeyValue label="Name" value={provider.name} labelWidth={14} />
      <KeyValue label="ID" value={provider.id} labelWidth={14} />
      <KeyValue
        label="Status"
        value={
          <Badge variant={variant} dot>
            {statusLabel(provider.displayStatus)}
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
