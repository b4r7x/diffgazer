import { useMutation, useQuery } from "@tanstack/react-query";
import { useApi } from "./context.js";
import { serverQueries } from "./queries/server.js";

export type ServerState =
  | { status: "checking" }
  | { status: "connected" }
  | { status: "error"; message: string };

function deriveServerState(
  isLoading: boolean,
  error: Error | null,
  hasHealthData: boolean,
): ServerState {
  if (isLoading) return { status: "checking" };
  // A failed poll after a prior success must not tear down the gated tree:
  // keep "connected" while cached health data exists, only surface "error"
  // when there is no successful health result to fall back on.
  if (error && !hasHealthData) return { status: "error", message: error.message };
  return { status: "connected" };
}

function deriveLatestServerState(
  isFetching: boolean,
  error: Error | null,
  isSuccess: boolean,
): ServerState {
  if (isFetching) return { status: "checking" };
  if (error) return { status: "error", message: error.message };
  if (isSuccess) return { status: "connected" };
  return { status: "checking" };
}

interface ServerStatusResult {
  /** Latched state used by app shells to keep a previously connected tree mounted. */
  state: ServerState;
  /** State of the latest health request, including a failed refetch over cached data. */
  latestState: ServerState;
  retry: () => Promise<unknown>;
}

export function useServerStatus(): ServerStatusResult {
  const api = useApi();
  const query = useQuery(serverQueries.health(api));
  const hasSuccessfulHealth = query.data === true;

  return {
    state: deriveServerState(query.isLoading, query.error, hasSuccessfulHealth),
    latestState: deriveLatestServerState(query.isFetching, query.error, query.isSuccess),
    retry: () => query.refetch({ throwOnError: true }),
  };
}

export function useShutdown() {
  const api = useApi();
  return useMutation({
    mutationFn: () => api.shutdown(),
  });
}
