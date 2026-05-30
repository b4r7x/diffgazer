import type { ReactElement } from "react";
import { Box, Text } from "ink";
import { useTheme } from "../../../../theme/theme-context";
import { RadioGroup } from "../../../../components/ui/radio";
import { Spinner } from "../../../../components/ui/spinner";
import { useProviderStatus, guardQueryState } from "@diffgazer/core/api/hooks";
import { AVAILABLE_PROVIDERS } from "@diffgazer/core/schemas/config";
import type { ProviderStatus } from "@diffgazer/core/schemas/config";

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
  const info = AVAILABLE_PROVIDERS.find((p) => p.id === status.provider);
  if (!info || info.models.length === 0) {
    return status.provider === "openrouter"
      ? "Access multiple providers via a single API"
      : "";
  }
  return info.models.join(", ");
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
