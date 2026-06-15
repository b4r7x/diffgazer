import type { InputMethod } from "@diffgazer/core/onboarding";
import { useApiKeyEntry } from "@diffgazer/core/providers";

interface UseApiKeyFormOptions {
  envVarName: string;
  onSubmit: (method: InputMethod, value: string) => Promise<void>;
  onOpenChange: (open: boolean) => void;
}

export function useApiKeyForm({ envVarName, onSubmit, onOpenChange }: UseApiKeyFormOptions) {
  const entry = useApiKeyEntry({ envVarName, onSubmit });

  const handleSubmit = async (submitMethod: InputMethod = entry.method) => {
    const saved = await entry.submit(submitMethod);
    if (saved) onOpenChange(false);
  };

  return {
    method: entry.method,
    setMethod: entry.setMethod,
    keyValue: entry.value,
    setKeyValue: entry.setValue,
    isSubmitting: entry.isSubmitting,
    error: entry.error,
    canSubmit: entry.canSubmit,
    handleSubmit,
    reset: entry.reset,
  };
}
