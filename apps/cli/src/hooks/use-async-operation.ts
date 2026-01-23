import { useState, useCallback } from "react";
import { getErrorMessage } from "@repo/core";

export type AsyncStatus = "idle" | "loading" | "success" | "error";

export interface AsyncError {
  message: string;
  code?: string;
}

export interface AsyncState<T> {
  status: AsyncStatus;
  data?: T;
  error?: AsyncError;
}

export interface UseAsyncOperationResult<T> {
  state: AsyncState<T>;
  execute: (operation: () => Promise<T>) => Promise<T | null>;
  reset: () => void;
  setData: (data: T) => void;
}

/** React hook for async operations with loading/success/error state management. */
export function useAsyncOperation<T>(
  initialData?: T
): UseAsyncOperationResult<T> {
  const [state, setState] = useState<AsyncState<T>>({
    status: initialData !== undefined ? "success" : "idle",
    data: initialData,
  });

  const execute = useCallback(
    async (operation: () => Promise<T>): Promise<T | null> => {
      setState((prev) => ({ ...prev, status: "loading", error: undefined }));
      try {
        const result = await operation();
        setState({ status: "success", data: result });
        return result;
      } catch (e) {
        setState((prev) => ({
          status: "error",
          error: { message: getErrorMessage(e) },
          data: prev.data,
        }));
        return null;
      }
    },
    []
  );

  const reset = useCallback(() => {
    setState({ status: "idle" });
  }, []);

  const setData = useCallback((data: T) => {
    setState({ status: "success", data });
  }, []);

  return { state, execute, reset, setData };
}
