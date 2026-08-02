import type { InputMethod } from "@diffgazer/core/onboarding";
import { PRODUCT_REGISTRY } from "@diffgazer/core/providers";
import type { RunnableProductId } from "@diffgazer/core/schemas/config";
import { Box, Text } from "ink";
import type { ReactElement } from "react";
import { ApiKeyMethodSelector } from "../../../../components/shared/api-key-method-selector";
import { useTheme } from "../../../../theme/provider";

interface ApiKeyStepProps {
  productId: RunnableProductId;
  transportFamily: "hosted-api" | "local-http" | "local-cli";
  method: InputMethod;
  onMethodChange: (method: InputMethod) => void;
  apiKey: string;
  onApiKeyChange: (value: string) => void;
  isActive?: boolean;
  inputFocused?: boolean;
  onInputFocusedChange?: (focused: boolean) => void;
}

function getHostedEnvVar(productId: RunnableProductId): string {
  switch (productId) {
    case "gemini":
      return "GEMINI_API_KEY";
    case "openrouter":
      return "OPENROUTER_API_KEY";
    case "groq":
      return "GROQ_API_KEY";
    case "cerebras":
      return "CEREBRAS_API_KEY";
    case "deepseek":
      return "DEEPSEEK_API_KEY";
    case "qwen":
      return "DASHSCOPE_API_KEY";
    case "moonshot":
      return "MOONSHOT_API_KEY";
    case "mistral":
      return "MISTRAL_API_KEY";
    case "zai":
      return "ZAI_API_KEY";
    default:
      return "API_KEY";
  }
}

export function ApiKeyStep({
  productId,
  transportFamily,
  method,
  onMethodChange,
  apiKey,
  onApiKeyChange,
  isActive = true,
  inputFocused,
  onInputFocusedChange,
}: ApiKeyStepProps): ReactElement {
  const { tokens } = useTheme();
  const productName = PRODUCT_REGISTRY[productId].presentation.name;

  if (transportFamily === "local-http") {
    const endpoint = PRODUCT_REGISTRY[productId].configuration.endpoints[0]?.endpoint;
    return (
      <Box flexDirection="column" gap={1}>
        <Text color={tokens.muted}>
          Configure the local endpoint at {endpoint ?? "the selected loopback URL"} without storing
          hosted credentials.
        </Text>
      </Box>
    );
  }

  if (transportFamily === "local-cli") {
    return (
      <Box flexDirection="column" gap={1}>
        <Text color={tokens.muted}>
          {productName} uses ambient CLI authentication on this machine. No API key or token is
          stored in Diffgazer.
        </Text>
      </Box>
    );
  }

  return (
    <Box flexDirection="column" gap={1}>
      <Text color={tokens.muted}>Provide your API key for {productName}.</Text>
      <ApiKeyMethodSelector
        method={method}
        onMethodChange={onMethodChange}
        apiKey={apiKey}
        onApiKeyChange={onApiKeyChange}
        envVar={getHostedEnvVar(productId)}
        envVarReadOnly
        isActive={isActive}
        inputFocused={inputFocused}
        onInputFocusedChange={onInputFocusedChange}
      />
    </Box>
  );
}
