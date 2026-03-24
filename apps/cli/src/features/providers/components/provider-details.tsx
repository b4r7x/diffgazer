import type { ReactElement } from "react";
import { Box, Text } from "ink";
import { useTheme } from "../../../theme/theme-context.js";
import { KeyValue } from "../../../components/ui/key-value.js";
import { Badge } from "../../../components/ui/badge.js";
import { Button } from "../../../components/ui/button.js";

interface ProviderDetailsProps {
  provider?: {
    id: string;
    name: string;
    status: string;
    model?: string;
    capabilities?: string[];
  };
  onConfigureKey?: () => void;
  onSelectModel?: () => void;
}

export function ProviderDetails({
  provider,
  onConfigureKey,
  onSelectModel,
}: ProviderDetailsProps): ReactElement {
  const { tokens } = useTheme();

  if (!provider) {
    return (
      <Box>
        <Text color={tokens.muted}>Select a provider to view details</Text>
      </Box>
    );
  }

  const statusVariant = provider.status === "configured" ? "success" : "warning";

  return (
    <Box flexDirection="column" gap={1}>
      <KeyValue label="Name" value={provider.name} labelWidth={14} />
      <KeyValue label="ID" value={provider.id} labelWidth={14} />
      <KeyValue
        label="Status"
        value={
          <Badge variant={statusVariant} dot>
            {provider.status}
          </Badge>
        }
        labelWidth={14}
      />
      {provider.model && (
        <KeyValue label="Model" value={provider.model} labelWidth={14} />
      )}
      {provider.capabilities && provider.capabilities.length > 0 && (
        <KeyValue
          label="Capabilities"
          value={
            <Box gap={1}>
              {provider.capabilities.map((cap) => (
                <Badge key={cap} variant="info">{cap}</Badge>
              ))}
            </Box>
          }
          labelWidth={14}
        />
      )}

      <Box gap={1} marginTop={1}>
        <Button variant="primary" onPress={onConfigureKey}>
          Configure API Key
        </Button>
        <Button variant="secondary" onPress={onSelectModel}>
          Select Model
        </Button>
      </Box>
    </Box>
  );
}
