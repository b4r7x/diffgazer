import { useServerStatus as useSharedServerStatus } from "@diffgazer/api/hooks";

type ServerState =
  | { status: "checking" }
  | { status: "connected" }
  | { status: "error"; message: string };

interface ServerStatus {
  state: ServerState;
  retry: () => void;
}

export function useServerStatus(): ServerStatus {
  const query = useSharedServerStatus();
  const state: ServerState = query.isLoading
    ? { status: "checking" }
    : query.error
      ? { status: "error", message: query.error.message }
      : { status: "connected" };
  return { state, retry: () => { query.refetch(); } };
}
