import { useState } from "react";
import type { InputMethod } from "@/features/providers/constants";

interface UseApiKeyFormOptions {
  envVarName: string;
  onSubmit: (method: InputMethod, value: string) => Promise<void>;
  onRemoveKey?: () => Promise<void>;
  onOpenChange: (open: boolean) => void;
}

export function useApiKeyForm({
  envVarName,
  onSubmit,
  onRemoveKey,
  onOpenChange,
}: UseApiKeyFormOptions) {
  const [method, setMethod] = useState<InputMethod>("paste");
  const [keyValue, setKeyValue] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Parent should key this component on `open` or only mount when open=true
  // to reset state, rather than relying on a useEffect to sync props to state.

  const handleSubmit = async () => {
    if (isSubmitting) return;
    const value = method === "paste" ? keyValue : envVarName;
    if (!value && method === "paste") return;

    setIsSubmitting(true);
    setError(null);
    try {
      await onSubmit(method, value);
      setKeyValue("");
      onOpenChange(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save API key");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRemove = async () => {
    if (isSubmitting || !onRemoveKey) return;
    setIsSubmitting(true);
    setError(null);
    try {
      await onRemoveKey();
      onOpenChange(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to remove API key");
    } finally {
      setIsSubmitting(false);
    }
  };

  const canSubmit = method === "env" || keyValue.length > 0;

  return {
    method,
    setMethod,
    keyValue,
    setKeyValue,
    isSubmitting,
    error,
    canSubmit,
    handleSubmit,
    handleRemove,
  };
}
