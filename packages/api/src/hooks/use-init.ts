import { useQuery } from "@tanstack/react-query";
import { configQueries } from "./queries/config.queries.js";
import { useApi } from "./context.js";

export function useInit() {
  const api = useApi();
  return useQuery(configQueries.init(api));
}
