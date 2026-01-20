import { useState } from "react";
import type { GitError } from "@repo/schemas/git";
import type { z } from "zod";
import { makeError } from "../lib/error.js";

export type GitQueryState<TData> =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "success"; data: TData }
  | { status: "error"; error: GitError };

interface UseGitQueryOptions<TData> {
  endpoint: string;
  schema: z.ZodType<{ success: true; data: TData } | { success: false; error: GitError }>;
}

export function useGitQuery<TData>(baseUrl: string, options: UseGitQueryOptions<TData>) {
  const { endpoint, schema } = options;
  const [state, setState] = useState<GitQueryState<TData>>({ status: "idle" });

  async function fetch(queryParams?: Record<string, string>) {
    setState({ status: "loading" });
    try {
      let url = `${baseUrl}${endpoint}`;
      if (queryParams && Object.keys(queryParams).length > 0) {
        url += `?${new URLSearchParams(queryParams).toString()}`;
      }

      const res = await globalThis.fetch(url);
      if (!res.ok) {
        setState({ status: "error", error: makeError(`HTTP ${res.status}`) });
        return;
      }

      const json = await res.json().catch(() => null);
      if (json === null) {
        setState({ status: "error", error: makeError("Invalid JSON response") });
        return;
      }

      const parsed = schema.safeParse(json);
      if (!parsed.success) {
        setState({ status: "error", error: makeError("Invalid response") });
        return;
      }

      if (parsed.data.success) {
        setState({ status: "success", data: parsed.data.data });
      } else {
        setState({ status: "error", error: parsed.data.error });
      }
    } catch (e) {
      setState({ status: "error", error: makeError(String(e)) });
    }
  }

  function reset() {
    setState({ status: "idle" });
  }

  return { state, fetch, reset };
}
