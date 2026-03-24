import { useServerStatus as useSharedServerStatus } from "@diffgazer/api/hooks";

type ServerState =
  | { status: "checking" }
  | { status: "connected" }
  | { status: "error"; message: string };

export function useServerStatus(): { state: ServerState; retry: () => void } {
  const query = useSharedServerStatus();

  const state: ServerState = query.isLoading
    ? { status: "checking" }
    : query.error
      ? { status: "error", message: query.error.message }
      : { status: "connected" };

  return { state, retry: () => { query.refetch(); } };
}
