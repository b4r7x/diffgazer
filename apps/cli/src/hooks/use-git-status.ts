import { useState } from "react";
import type { GitStatus, GitError } from "@repo/schemas/git";
import { GitStatusResponseSchema } from "@repo/schemas/git";

export type GitStatusState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "success"; data: GitStatus }
  | { status: "error"; error: GitError };

interface UseGitStatusReturn {
  state: GitStatusState;
  fetch: () => Promise<void>;
  reset: () => void;
}

function makeError(msg: string): GitError {
  return { message: msg, code: "UNKNOWN" };
}

export function useGitStatus(baseUrl: string): UseGitStatusReturn {
  const [state, setState] = useState<GitStatusState>({ status: "idle" });

  async function fetchStatus() {
    setState({ status: "loading" });

    try {
      const res = await fetch(`${baseUrl}/git/status`);

      if (!res.ok) {
        setState({ status: "error", error: makeError(`HTTP ${res.status}`) });
        return;
      }

      const json = await res.json().catch(() => null);
      if (json === null) {
        setState({ status: "error", error: makeError("Invalid JSON response") });
        return;
      }

      const parsed = GitStatusResponseSchema.safeParse(json);
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

  return { state, fetch: fetchStatus, reset };
}
