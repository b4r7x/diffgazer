import { useQuery } from "@tanstack/react-query";
import { configQueries } from "./queries/config.queries.js";
import { useApi } from "./context.js";

export function useOpenRouterModels(options?: { enabled?: boolean }) {
  const api = useApi();
  return useQuery({ ...configQueries.openRouterModels(api), ...options });
}
