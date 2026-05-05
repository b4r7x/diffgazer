import { useQuery, useMutation } from "@tanstack/react-query";
import { serverQueries } from "./queries/server.js";
import { useApi } from "./context.js";

export type ServerState =
  | { status: "checking" }
  | { status: "connected" }
  | { status: "error"; message: string };

export function useServerStatus(): { state: ServerState; retry: () => void } {
  const api = useApi();
  const query = useQuery(serverQueries.health(api));

  const state: ServerState = query.isLoading
    ? { status: "checking" }
    : query.error
      ? { status: "error", message: query.error.message }
      : { status: "connected" };

  return {
    state,
    retry: () => {
      query.refetch();
    },
  };
}

export function useShutdown() {
  const api = useApi();
  return useMutation({
    mutationFn: () => api.shutdown(),
  });
}
