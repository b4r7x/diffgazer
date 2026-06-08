import { guardQueryState, useProviderStatus } from "@diffgazer/core/api/hooks";
import type { ProviderStatus } from "@diffgazer/core/schemas/config";
import { AVAILABLE_PROVIDERS, OPENROUTER_PROVIDER_ID } from "@diffgazer/core/schemas/config";
import { Box, Text } from "ink";
import type { ReactElement } from "react";
import { RadioGroup } from "../../../../components/ui/radio";
import { Spinner } from "../../../../components/ui/spinner";
import { useTheme } from "../../../../theme/provider";

interface ProviderStepProps {
  value?: string;
  onChange: (v: string) => void;
  isActive?: boolean;
}

function getProviderLabel(status: ProviderStatus): string {
  const info = AVAILABLE_PROVIDERS.find((p) => p.id === status.provider);
  return info?.name ?? status.provider;
}

function getProviderDescription(status: ProviderStatus): string {
  return status.provider === OPENROUTER_PROVIDER_ID
    ? "Access multiple providers via a single API"
    : "";
}

export function ProviderStep({
  value,
  onChange,
  isActive = true,
}: ProviderStepProps): ReactElement {
  const { tokens } = useTheme();
  const query = useProviderStatus();

  const guard = guardQueryState(query, {
    loading: () => <Spinner label="Loading providers..." />,
    error: (err) => (
      <Box>
        <Text color={tokens.error}>Error: {err.message}</Text>
      </Box>
    ),
  });
  if (guard) return guard;

  return (
    <Box flexDirection="column" gap={1}>
      <Text color={tokens.muted}>Select an AI provider for code reviews.</Text>
      <RadioGroup value={value} onChange={onChange} isActive={isActive}>
        {(query.data ?? []).map((status) => (
          <RadioGroup.Item
            key={status.provider}
            value={status.provider}
            label={getProviderLabel(status)}
            description={getProviderDescription(status)}
          />
        ))}
      </RadioGroup>
    </Box>
  );
}
