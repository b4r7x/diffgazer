import { useRef } from "react";
import { AVAILABLE_PROVIDERS, PROVIDER_ENV_VARS } from "@stargazer/schemas/config";
import type { AIProvider } from "@stargazer/schemas/config";
import { ApiKeyMethodSelector } from "@/components/shared/api-key-method-selector";
import type { InputMethod } from "@/types/input-method";

interface ApiKeyStepProps {
  provider: AIProvider;
  method: InputMethod;
  onMethodChange: (method: InputMethod) => void;
  keyValue: string;
  onKeyValueChange: (value: string) => void;
}

export function ApiKeyStep({
  provider,
  method,
  onMethodChange,
  keyValue,
  onKeyValueChange,
}: ApiKeyStepProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const providerInfo = AVAILABLE_PROVIDERS.find((p) => p.id === provider);
  const providerName = providerInfo?.name ?? provider;
  const envVarName = PROVIDER_ENV_VARS[provider];

  return (
    <div className="space-y-4">
      <p className="text-sm text-tui-muted font-mono">
        Provide your API key for {providerName}.
      </p>
      <ApiKeyMethodSelector
        method={method}
        onMethodChange={onMethodChange}
        keyValue={keyValue}
        onKeyValueChange={onKeyValueChange}
        envVarName={envVarName}
        providerName={providerName}
        inputRef={inputRef}
        focused={method === "paste" ? "input" : "env"}
        onFocus={() => {}}
        onKeySubmit={() => {}}
      />
    </div>
  );
}
