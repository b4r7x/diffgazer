import { useRef, useState } from "react";
import { getErrorMessage } from "../errors.js";
import type { InputMethod } from "../onboarding/types.js";

export interface UseApiKeyEntryOptions {
  /**
   * Fixed environment-variable name submitted in `env` mode. When omitted the
   * caller lets the user type the variable name, so the entry `value` is used
   * for both modes.
   */
  envVarName?: string;
  onSubmit: (method: InputMethod, value: string) => Promise<boolean>;
}

export interface UseApiKeyEntryResult {
  method: InputMethod;
  setMethod: (method: InputMethod) => void;
  value: string;
  setValue: (value: string) => void;
  canSubmit: boolean;
  isSubmitting: boolean;
  /** Last failed-submit message, cleared on input/method change and reset. */
  error: string | null;
  /** Runs onSubmit; clears the value only when the caller commits the save. */
  submit: (submitMethod?: InputMethod) => Promise<boolean>;
  reset: () => void;
}

/**
 * Single home for the provider API-key entry contract shared by the web dialog
 * and the TUI overlay: method/value state, a submit guard, and a captured error
 * that callers render inline. The surface owns focus, layout, and navigation.
 */
export function useApiKeyEntry({
  envVarName,
  onSubmit,
}: UseApiKeyEntryOptions): UseApiKeyEntryResult {
  const [method, setMethodState] = useState<InputMethod>("paste");
  const [value, setValueState] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const submittingRef = useRef(false);

  const resolveSubmitValue = (submitMethod: InputMethod) =>
    submitMethod === "paste" ? value : (envVarName ?? value);

  const setMethod = (next: InputMethod) => {
    setError(null);
    setMethodState(next);
  };

  const setValue = (next: string) => {
    setError(null);
    setValueState(next);
  };

  const canSubmit = method === "paste" ? value.length > 0 : (envVarName ?? value).length > 0;

  const submit = async (submitMethod: InputMethod = method): Promise<boolean> => {
    if (submittingRef.current) return false;
    const submitValue = resolveSubmitValue(submitMethod);
    if (!submitValue) return false;

    submittingRef.current = true;
    setIsSubmitting(true);
    setError(null);
    try {
      const committed = await onSubmit(submitMethod, submitValue);
      if (!committed) return false;
      setValueState("");
      return true;
    } catch (cause) {
      setError(getErrorMessage(cause, "Failed to save API key"));
      return false;
    } finally {
      submittingRef.current = false;
      setIsSubmitting(false);
    }
  };

  const reset = () => {
    setMethodState("paste");
    setValueState("");
    setError(null);
  };

  return {
    method,
    setMethod,
    value,
    setValue,
    canSubmit,
    isSubmitting,
    error,
    submit,
    reset,
  };
}
