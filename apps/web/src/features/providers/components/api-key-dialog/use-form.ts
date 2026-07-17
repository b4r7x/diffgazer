import type { InputMethod } from "@diffgazer/core/onboarding";
import { useApiKeyEntry } from "@diffgazer/core/providers";

interface UseApiKeyFormOptions {
  envVarName: string;
  onSubmit: (method: InputMethod, value: string) => Promise<boolean>;
}

export function useApiKeyForm({ envVarName, onSubmit }: UseApiKeyFormOptions) {
  const entry = useApiKeyEntry({ envVarName, onSubmit });

  return {
    method: entry.method,
    setMethod: entry.setMethod,
    keyValue: entry.value,
    setKeyValue: entry.setValue,
    isSubmitting: entry.isSubmitting,
    error: entry.error,
    canSubmit: entry.canSubmit,
    handleSubmit: entry.submit,
    reset: entry.reset,
  };
}
