import type { AIProvider } from "@diffgazer/core/schemas/config";
import { AVAILABLE_PROVIDERS, PROVIDER_ENV_VARS } from "@diffgazer/core/schemas/config";
import { Box, Text } from "ink";
import type { ReactElement } from "react";
import { useTheme } from "../../../../app/providers/theme";
import { ApiKeyMethodSelector } from "../../../../components/shared/api-key-method-selector";

interface ApiKeyStepProps {
  provider: AIProvider;
  method: string;
  onMethodChange: (m: string) => void;
  apiKey: string;
  onApiKeyChange: (v: string) => void;
  isActive?: boolean;
}

function isPasteOrEnv(method: string): method is "paste" | "env" {
  return method === "paste" || method === "env";
}

export function ApiKeyStep({
  provider,
  method,
  onMethodChange,
  apiKey,
  onApiKeyChange,
  isActive = true,
}: ApiKeyStepProps): ReactElement {
  const { tokens } = useTheme();
  const providerInfo = AVAILABLE_PROVIDERS.find((p) => p.id === provider);
  const providerName = providerInfo?.name ?? provider;
  const envVarName = PROVIDER_ENV_VARS[provider];
  const resolvedMethod = isPasteOrEnv(method) ? method : "paste";

  return (
    <Box flexDirection="column" gap={1}>
      <Text color={tokens.muted}>Provide your API key for {providerName}.</Text>
      <ApiKeyMethodSelector
        method={resolvedMethod}
        onMethodChange={onMethodChange}
        apiKey={apiKey}
        onApiKeyChange={onApiKeyChange}
        envVar={envVarName}
        onEnvVarChange={() => {}}
        isActive={isActive}
      />
    </Box>
  );
}
