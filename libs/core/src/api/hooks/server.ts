import { useQuery, useMutation } from "@tanstack/react-query";
import { serverQueries } from "./queries/server";
import { useApi } from "./context";

export type ServerState =
  | { status: "checking" }
  | { status: "connected" }
  | { status: "error"; message: string };

function deriveServerState(
  isLoading: boolean,
  error: Error | null,
): ServerState {
  if (isLoading) return { status: "checking" };
  if (error) return { status: "error", message: error.message };
  return { status: "connected" };
}

export function useServerStatus(): { state: ServerState; retry: () => Promise<unknown> } {
  const api = useApi();
  const query = useQuery(serverQueries.health(api));

  return {
    state: deriveServerState(query.isLoading, query.error),
    retry: () => query.refetch({ throwOnError: true }),
  };
}

export function useShutdown() {
  const api = useApi();
  return useMutation({
    mutationFn: () => api.shutdown(),
  });
}
