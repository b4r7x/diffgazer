import { useRef, useState } from "react";
import { getErrorMessage } from "../errors.js";
import type { InputMethod } from "../onboarding/types.js";

export interface UseApiKeyEntryOptions {
  onSubmit: (method: InputMethod, value: string) => Promise<boolean>;
}

type SubmitState =
  | { status: "idle" }
  | { status: "submitting" }
  | { status: "error"; message: string };

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
export function useApiKeyEntry({ onSubmit }: UseApiKeyEntryOptions): UseApiKeyEntryResult {
  const [method, setMethodState] = useState<InputMethod>("paste");
  const [value, setValueState] = useState("");
  const [submitState, setSubmitState] = useState<SubmitState>({ status: "idle" });
  const submittingRef = useRef(false);

  const clearError = () => {
    setSubmitState((state) => (state.status === "error" ? { status: "idle" } : state));
  };

  const setMethod = (next: InputMethod) => {
    clearError();
    setMethodState(next);
  };

  const setValue = (next: string) => {
    clearError();
    setValueState(next);
  };

  const canSubmit = method !== "paste" || value.length > 0;

  const submit = async (submitMethod: InputMethod = method): Promise<boolean> => {
    if (submittingRef.current) return false;
    if (submitMethod === "paste" && !value) return false;

    submittingRef.current = true;
    setSubmitState({ status: "submitting" });
    try {
      const committed = await onSubmit(submitMethod, value);
      setSubmitState({ status: "idle" });
      if (!committed) return false;
      setValueState("");
      return true;
    } catch (cause) {
      setSubmitState({
        status: "error",
        message: getErrorMessage(cause, "Failed to save API key"),
      });
      return false;
    } finally {
      submittingRef.current = false;
    }
  };

  const reset = () => {
    setMethodState("paste");
    setValueState("");
    setSubmitState({ status: "idle" });
  };

  return {
    method,
    setMethod,
    value,
    setValue,
    canSubmit,
    isSubmitting: submitState.status === "submitting",
    error: submitState.status === "error" ? submitState.message : null,
    submit,
    reset,
  };
}
