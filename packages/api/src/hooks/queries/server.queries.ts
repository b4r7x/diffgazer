import { queryOptions } from "@tanstack/react-query";
import type { BoundApi } from "../../bound.js";

export const serverQueries = {
  health: (api: BoundApi) =>
    queryOptions({
      queryKey: ["server", "health"] as const,
      queryFn: async () => {
        await api.request("GET", "/api/health");
      },
      refetchInterval: 30_000,
    }),
};
