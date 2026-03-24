import { useQuery } from "@tanstack/react-query";
import { configQueries } from "./queries/config.queries.js";
import { useApi } from "./context.js";

export function useConfigCheck() {
  const api = useApi();
  return useQuery(configQueries.check(api));
}
