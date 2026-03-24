import { useMutation } from "@tanstack/react-query";
import { useApi } from "./context.js";

export function useShutdown() {
  const api = useApi();
  return useMutation({
    mutationFn: () => api.shutdown(),
  });
}
