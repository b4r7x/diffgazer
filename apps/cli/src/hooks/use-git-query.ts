import { useCallback } from "react";
import type { GitError } from "@repo/schemas/git";
import type { z } from "zod";
import { api } from "../lib/api.js";
import { validateSchema } from "@repo/core";
import { useAsyncOperation, type AsyncState } from "./use-async-operation.js";

function createGitError(message: string): GitError {
  return { message, code: "UNKNOWN" };
}

/**
 * State representation for git query operations.
 * Maintains backward compatibility with the discriminated union pattern.
 * @template TData The type of data returned by the query
 */
export type GitQueryState<TData> =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "success"; data: TData }
  | { status: "error"; error: GitError };

/**
 * Options for configuring a git query.
 * @template TData The type of data expected from the API endpoint
 */
interface UseGitQueryOptions<TData> {
  /** API endpoint path (e.g., "/git/status") */
  endpoint: string;
  /** Zod schema for validating the response data */
  schema: z.ZodType<TData>;
}

/**
 * Converts internal AsyncState to the public GitQueryState format.
 * This maintains backward compatibility with existing consumers.
 */
function toGitQueryState<TData>(
  asyncState: AsyncState<TData>
): GitQueryState<TData> {
  switch (asyncState.status) {
    case "idle":
      return { status: "idle" };
    case "loading":
      return { status: "loading" };
    case "success":
      return { status: "success", data: asyncState.data as TData };
    case "error":
      return {
        status: "error",
        error: createGitError(asyncState.error?.message ?? "Unknown error"),
      };
  }
}

/**
 * Hook for querying git-related API endpoints with schema validation.
 *
 * Uses the shared useAsyncOperation hook internally for state management,
 * while maintaining the existing API surface for backward compatibility.
 *
 * @template TData The type of data expected from the API endpoint
 * @param options Configuration options including endpoint and validation schema
 * @returns Object with state, fetch function, and reset function
 *
 * @example
 * ```tsx
 * const { state, fetch, reset } = useGitQuery({
 *   endpoint: "/git/status",
 *   schema: GitStatusSchema,
 * });
 *
 * useEffect(() => {
 *   fetch();
 * }, [fetch]);
 *
 * if (state.status === "success") {
 *   return <StatusDisplay data={state.data} />;
 * }
 * ```
 */
export function useGitQuery<TData>(options: UseGitQueryOptions<TData>) {
  const { endpoint, schema } = options;
  const { state: asyncState, execute, reset } = useAsyncOperation<TData>();

  const fetch = useCallback(
    async (queryParams?: Record<string, string>) => {
      await execute(async () => {
        const data = await api().get<TData>(endpoint, queryParams);

        const result = validateSchema(data, schema, createGitError);
        if (!result.ok) {
          throw new Error(result.error.message);
        }

        return result.value;
      });
    },
    [endpoint, schema, execute]
  );

  // Convert to the expected GitQueryState format for backward compatibility
  const state = toGitQueryState(asyncState);

  return { state, fetch, reset };
}
