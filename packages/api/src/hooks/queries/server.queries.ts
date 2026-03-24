import { queryOptions } from "@tanstack/react-query";
import type { BoundApi } from "../../bound.js";

export const serverQueries = {
  all: () => ["server"] as const,

  health: (api: BoundApi) =>
    queryOptions({
      queryKey: [...serverQueries.all(), "health"] as const,
      queryFn: async () => {
        await api.request("GET", "/api/health");
      },
      refetchInterval: 30_000,
    }),
};
