"use client";

import { useState, useEffect } from "react";
import type { InputMethod } from "@repo/schemas/config";

interface UseApiKeyFormOptions {
  open: boolean;
  envVarName: string;
  onSubmit: (method: InputMethod, value: string) => Promise<void>;
  onRemoveKey?: () => Promise<void>;
  onOpenChange: (open: boolean) => void;
}

export function useApiKeyForm({
  open,
  envVarName,
  onSubmit,
  onRemoveKey,
  onOpenChange,
}: UseApiKeyFormOptions) {
  const [method, setMethod] = useState<InputMethod>("paste");
  const [keyValue, setKeyValue] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (open) {
      setKeyValue("");
      setMethod("paste");
    }
  }, [open]);

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
