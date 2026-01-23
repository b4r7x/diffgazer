import { useState, useCallback } from "react";
import { getErrorMessage } from "@repo/core";

/**
 * Status of an async operation.
 * - "idle": Operation has not been started
 * - "loading": Operation is in progress
 * - "success": Operation completed successfully
 * - "error": Operation failed with an error
 */
export type AsyncStatus = "idle" | "loading" | "success" | "error";

/**
 * Error information from a failed async operation.
 */
export interface AsyncError {
  /** Human-readable error message */
  message: string;
  /** Optional error code for programmatic handling */
  code?: string;
}

/**
 * State of an async operation including status, data, and error information.
 * @template T The type of data returned by the async operation
 */
export interface AsyncState<T> {
  /** Current status of the operation */
  status: AsyncStatus;
  /** Data returned from a successful operation */
  data?: T;
  /** Error information if the operation failed */
  error?: AsyncError;
}

/**
 * Result returned by the useAsyncOperation hook.
 * @template T The type of data returned by the async operation
 */
export interface UseAsyncOperationResult<T> {
  /** Current state of the async operation */
  state: AsyncState<T>;
  /**
   * Execute an async operation with automatic state management.
   * Sets status to "loading" before execution, then "success" or "error" after.
   * @param operation Function that returns a Promise of the data
   * @returns The result data on success, or null on failure
   */
  execute: (operation: () => Promise<T>) => Promise<T | null>;
  /** Reset state to idle, clearing data and error */
  reset: () => void;
  /** Manually set data and status to success */
  setData: (data: T) => void;
}

/**
 * Hook for managing async operations with consistent loading/error states.
 *
 * This hook provides a standardized pattern for handling async operations,
 * reducing boilerplate code for loading states, error handling, and data management.
 *
 * @template T The type of data returned by the async operation
 * @param initialData Optional initial data (sets status to "success" if provided)
 * @returns Object with state, execute function, reset function, and setData function
 *
 * @example
 * ```tsx
 * function MyComponent() {
 *   const { state, execute } = useAsyncOperation<User[]>();
 *
 *   useEffect(() => {
 *     execute(() => api.get('/users'));
 *   }, [execute]);
 *
 *   if (state.status === "loading") return <Spinner />;
 *   if (state.status === "error") return <Error message={state.error?.message} />;
 *   if (state.status === "success") return <UserList users={state.data} />;
 *   return null;
 * }
 * ```
 *
 * @example
 * ```tsx
 * // With initial data
 * const { state, execute } = useAsyncOperation<Config>(defaultConfig);
 * // state.status is "success" and state.data is defaultConfig
 * ```
 *
 * @example
 * ```tsx
 * // Manual data updates
 * const { state, setData, reset } = useAsyncOperation<string>();
 * setData("manually set value"); // status becomes "success"
 * reset(); // status becomes "idle", data and error cleared
 * ```
 */
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
          data: prev.data, // preserve previous data on error
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
