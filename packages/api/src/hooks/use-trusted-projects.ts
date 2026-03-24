import { useQuery } from "@tanstack/react-query";
import { trustQueries } from "./queries/trust.queries.js";
import { useApi } from "./context.js";

export function useTrustedProjects() {
  const api = useApi();
  return useQuery(trustQueries.list(api));
}
