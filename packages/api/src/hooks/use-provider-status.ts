import { useQuery } from "@tanstack/react-query";
import { configQueries } from "./queries/config.queries.js";
import { useApi } from "./context.js";

export function useProviderStatus() {
  const api = useApi();
  return useQuery(configQueries.providers(api));
}
