import { useMutation, useQueryClient } from "@tanstack/react-query";
import { trustQueries } from "./queries/trust.queries.js";
import { configQueries } from "./queries/config.queries.js";
import { useApi } from "./context.js";

export function useDeleteTrust() {
  const api = useApi();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (projectId: string) => api.deleteTrust(projectId),
    onSuccess: async () => {
      await Promise.all([
        qc.invalidateQueries({ queryKey: trustQueries.all() }),
        qc.invalidateQueries({ queryKey: configQueries.init(api).queryKey }),
      ]);
    },
  });
}
