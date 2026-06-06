import { getErrorMessage } from "@diffgazer/core/errors";
import type { InputMethod } from "@diffgazer/core/onboarding";
import { useState } from "react";

type FormStatus =
  | { status: "idle" }
  | { status: "submitting" }
  | { status: "error"; message: string };

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
  const [formStatus, setFormStatus] = useState<FormStatus>({ status: "idle" });

  const handleSubmit = async (submitMethod: InputMethod = method) => {
    if (formStatus.status === "submitting") return;
    const value = submitMethod === "paste" ? keyValue : envVarName;
    if (!value && submitMethod === "paste") return;

    setFormStatus({ status: "submitting" });
    try {
      await onSubmit(submitMethod, value);
      setKeyValue("");
      onOpenChange(false);
    } catch (err) {
      setFormStatus({ status: "error", message: getErrorMessage(err, "Failed to save API key") });
      return;
    }
    setFormStatus({ status: "idle" });
  };

  const handleRemove = async () => {
    if (formStatus.status === "submitting" || !onRemoveKey) return;
    setFormStatus({ status: "submitting" });
    try {
      await onRemoveKey();
      onOpenChange(false);
    } catch (err) {
      setFormStatus({ status: "error", message: getErrorMessage(err, "Failed to remove API key") });
      return;
    }
    setFormStatus({ status: "idle" });
  };

  const reset = () => {
    setMethod("paste");
    setKeyValue("");
    setFormStatus({ status: "idle" });
  };

  const canSubmit = method === "env" || keyValue.length > 0;
  const isSubmitting = formStatus.status === "submitting";
  const error = formStatus.status === "error" ? formStatus.message : null;

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
    reset,
  };
}
