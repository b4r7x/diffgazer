import { useQuery } from "@tanstack/react-query";
import { trustQueries } from "./queries/trust.queries.js";
import { useApi } from "./context.js";

export function useTrust(projectId: string) {
  const api = useApi();
  return useQuery({ ...trustQueries.single(api, projectId), enabled: !!projectId });
}
