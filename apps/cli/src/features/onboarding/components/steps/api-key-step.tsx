import type { ReactElement } from "react";
import { ApiKeyMethodSelector } from "../../../providers/components/api-key-method-selector.js";

interface ApiKeyStepProps {
  method: string;
  onMethodChange: (m: string) => void;
  apiKey: string;
  onApiKeyChange: (v: string) => void;
  envVar: string;
  onEnvVarChange: (v: string) => void;
  isActive?: boolean;
}

export function ApiKeyStep({
  method,
  onMethodChange,
  apiKey,
  onApiKeyChange,
  envVar,
  onEnvVarChange,
  isActive = true,
}: ApiKeyStepProps): ReactElement {
  return (
    <ApiKeyMethodSelector
      method={method as "paste" | "env"}
      onMethodChange={onMethodChange}
      apiKey={apiKey}
      onApiKeyChange={onApiKeyChange}
      envVar={envVar}
      onEnvVarChange={onEnvVarChange}
      isActive={isActive}
    />
  );
}
