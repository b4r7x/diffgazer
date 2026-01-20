import { useState } from "react";
import type { GitError } from "@repo/schemas/git";
import type { z } from "zod";
import { api } from "../lib/api.js";
import { getErrorMessage } from "@repo/core";

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

export function useGitQuery<TData>(options: UseGitQueryOptions<TData>) {
  const { endpoint, schema } = options;
  const [state, setState] = useState<GitQueryState<TData>>({ status: "idle" });

  async function fetch(queryParams?: Record<string, string>) {
    setState({ status: "loading" });
    try {
      const data = await api().get<TData>(endpoint, queryParams);

      const parsed = schema.safeParse(data);
      if (!parsed.success) {
        setState({ status: "error", error: createGitError("Invalid response") });
        return;
      }

      setState({ status: "success", data: parsed.data });
    } catch (e) {
      setState({ status: "error", error: createGitError(getErrorMessage(e)) });
    }
  }

  function reset() {
    setState({ status: "idle" });
  }

  return { state, fetch, reset };
}
