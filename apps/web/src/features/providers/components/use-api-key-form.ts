"use client";

import { useState, useEffect } from "react";

type InputMethod = "paste" | "env";

interface UseApiKeyFormOptions {
  open: boolean;
  envVarName: string;
  hasExistingKey: boolean;
  hasRemoveKey: boolean;
  onSubmit: (method: InputMethod, value: string) => Promise<void>;
  onRemoveKey?: () => Promise<void>;
  onOpenChange: (open: boolean) => void;
  onResetFooter: (index: number) => void;
}

export function useApiKeyForm({
  open,
  envVarName,
  hasExistingKey,
  hasRemoveKey,
  onSubmit,
  onRemoveKey,
  onOpenChange,
  onResetFooter,
}: UseApiKeyFormOptions) {
  const [method, setMethod] = useState<InputMethod>("paste");
  const [keyValue, setKeyValue] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Reset dialog state when opened
  useEffect(() => {
    if (open) {
      setKeyValue("");
      setMethod("paste");
      onResetFooter(hasExistingKey && hasRemoveKey ? 1 : 0);
    }
  }, [open, hasExistingKey, hasRemoveKey, onResetFooter]);

  const handleSubmit = async () => {
    if (isSubmitting) return;
    const value = method === "paste" ? keyValue : envVarName;
    if (!value && method === "paste") return;

    setIsSubmitting(true);
    try {
      await onSubmit(method, value);
      setKeyValue("");
      onOpenChange(false);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRemove = async () => {
    if (isSubmitting || !onRemoveKey) return;
    setIsSubmitting(true);
    try {
      await onRemoveKey();
      onOpenChange(false);
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
    canSubmit,
    handleSubmit,
    handleRemove,
  };
}
