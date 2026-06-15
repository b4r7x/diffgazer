import type { InputMethod } from "@diffgazer/core/onboarding";
import type { AIProvider } from "@diffgazer/core/schemas/config";
import { AVAILABLE_PROVIDERS, PROVIDER_ENV_VARS } from "@diffgazer/core/schemas/config";
import { Box, Text } from "ink";
import type { ReactElement } from "react";
import { ApiKeyMethodSelector } from "../../../../components/shared/api-key-method-selector";
import { useTheme } from "../../../../theme/provider";

interface ApiKeyStepProps {
  provider: AIProvider;
  method: InputMethod;
  onMethodChange: (m: InputMethod) => void;
  apiKey: string;
  onApiKeyChange: (v: string) => void;
  isActive?: boolean;
  inputFocused?: boolean;
  onInputFocusedChange?: (focused: boolean) => void;
}

export function ApiKeyStep({
  provider,
  method,
  onMethodChange,
  apiKey,
  onApiKeyChange,
  isActive = true,
  inputFocused,
  onInputFocusedChange,
}: ApiKeyStepProps): ReactElement {
  const { tokens } = useTheme();
  const providerInfo = AVAILABLE_PROVIDERS.find((p) => p.id === provider);
  const providerName = providerInfo?.name ?? provider;
  const envVarName = PROVIDER_ENV_VARS[provider];

  return (
    <Box flexDirection="column" gap={1}>
      <Text color={tokens.muted}>Provide your API key for {providerName}.</Text>
      <ApiKeyMethodSelector
        method={method}
        onMethodChange={onMethodChange}
        apiKey={apiKey}
        onApiKeyChange={onApiKeyChange}
        envVar={envVarName}
        onEnvVarChange={() => {}}
        isActive={isActive}
        inputFocused={inputFocused}
        onInputFocusedChange={onInputFocusedChange}
      />
    </Box>
  );
}
