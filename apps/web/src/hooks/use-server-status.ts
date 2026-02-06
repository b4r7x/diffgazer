import { useCallback, useEffect, useState } from "react";
import { api } from "@/lib/api";

const HEALTH_CHECK_INTERVAL_MS = 30_000;

type ServerState =
  | { status: "checking" }
  | { status: "connected" }
  | { status: "error"; message: string };

interface ServerStatus {
  state: ServerState;
  retry: () => Promise<void>;
}

export function useServerStatus(): ServerStatus {
  const [state, setState] = useState<ServerState>({ status: "checking" });

  const checkHealth = useCallback(async () => {
    setState({ status: "checking" });
    try {
      await api.request("GET", "/api/health");
      setState({ status: "connected" });
    } catch (err) {
      setState({
        status: "error",
        message: err instanceof Error ? err.message : "Failed to connect to server",
      });
    }
  }, []);

  useEffect(() => {
    checkHealth();
    const intervalId = window.setInterval(checkHealth, HEALTH_CHECK_INTERVAL_MS);
    return () => window.clearInterval(intervalId);
  }, [checkHealth]);

  return { state, retry: checkHealth };
}
