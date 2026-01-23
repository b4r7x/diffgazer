import { useCallback } from "react";
import type { GitError } from "@repo/schemas/git";
import type { z } from "zod";
import { api } from "../lib/api.js";
import { validateSchema } from "@repo/core";
import { useAsyncOperation, type AsyncState } from "./use-async-operation.js";

function createGitError(message: string): GitError {
  return { message, code: "UNKNOWN" };
}

export type GitQueryState<TData> =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "success"; data: TData }
  | { status: "error"; error: GitError };

interface UseGitQueryOptions<TData> {
  endpoint: string;
  schema: z.ZodType<TData>;
}

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

  const state = toGitQueryState(asyncState);

  return { state, fetch, reset };
}
