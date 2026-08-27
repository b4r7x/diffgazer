import type { InputMethod } from "@diffgazer/core/onboarding";
import { CREDENTIAL_ENV_VARS, PRODUCT_REGISTRY } from "@diffgazer/core/providers";
import type { RunnableProductId } from "@diffgazer/core/schemas/config";
import { Box, Text } from "ink";
import type { ReactElement } from "react";
import { ApiKeyMethodSelector } from "../../../../components/shared/api-key-method-selector";
import { useTheme } from "../../../../theme/provider";

interface ApiKeyStepProps {
  productId: RunnableProductId;
  method: InputMethod;
  highlightedMethod?: InputMethod | null;
  onMethodChange: (method: InputMethod) => void;
  apiKey: string;
  onApiKeyChange: (value: string) => void;
  isActive?: boolean;
  inputFocused?: boolean;
  onInputFocusedChange?: (focused: boolean) => void;
}

export function ApiKeyStep({
  productId,
  method,
  highlightedMethod,
  onMethodChange,
  apiKey,
  onApiKeyChange,
  isActive = true,
  inputFocused,
  onInputFocusedChange,
}: ApiKeyStepProps): ReactElement {
  const { tokens } = useTheme();
  const productName = PRODUCT_REGISTRY[productId].presentation.name;

  return (
    <Box flexDirection="column" gap={1}>
      <Text color={tokens.muted}>Provide your API key for {productName}.</Text>
      <ApiKeyMethodSelector
        method={method}
        highlightedMethod={highlightedMethod}
        onMethodChange={onMethodChange}
        apiKey={apiKey}
        onApiKeyChange={onApiKeyChange}
        envVar={CREDENTIAL_ENV_VARS[productId]}
        isActive={isActive}
        inputFocused={inputFocused}
        onInputFocusedChange={onInputFocusedChange}
      />
    </Box>
  );
}
