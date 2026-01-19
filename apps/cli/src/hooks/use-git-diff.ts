import { useState } from "react";
import type { GitDiff, GitError } from "@repo/schemas/git";
import { GitDiffResponseSchema } from "@repo/schemas/git";
import { makeError } from "../lib/error.js";

export type GitDiffState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "success"; data: GitDiff }
  | { status: "error"; error: GitError };

export function useGitDiff(baseUrl: string) {
  const [state, setState] = useState<GitDiffState>({ status: "idle" });

  async function fetchDiff(staged = false) {
    setState({ status: "loading" });

    try {
      const url = `${baseUrl}/git/diff${staged ? "?staged=true" : ""}`;
      const res = await fetch(url);

      if (!res.ok) {
        setState({ status: "error", error: makeError(`HTTP ${res.status}`) });
        return;
      }

      const json = await res.json().catch(() => null);
      if (json === null) {
        setState({ status: "error", error: makeError("Invalid JSON response") });
        return;
      }

      const parsed = GitDiffResponseSchema.safeParse(json);
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

  return { state, fetch: fetchDiff, reset };
}
