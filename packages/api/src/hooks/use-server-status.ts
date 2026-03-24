import { useQuery } from "@tanstack/react-query";
import { serverQueries } from "./queries/server.queries.js";
import { useApi } from "./context.js";

export function useServerStatus() {
  const api = useApi();
  return useQuery(serverQueries.health(api));
}
