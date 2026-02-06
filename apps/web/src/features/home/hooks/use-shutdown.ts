import { useCallback } from "react";
import { api } from "@/lib/api";

export function useShutdown() {
  const shutdown = useCallback(async () => {
    try {
      await api.client.post("/shutdown", {});
    } catch {
      // Server terminates before responding
    }
    window.close();
  }, []);

  return { shutdown };
}
