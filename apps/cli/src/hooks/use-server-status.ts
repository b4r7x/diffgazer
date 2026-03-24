import { useEffect, useRef, useState } from "react";
import { api } from "../lib/api.js";

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
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const checkHealth = async (showChecking = false) => {
    if (showChecking) setState({ status: "checking" });
    try {
      await api.request("GET", "/api/health");
      setState({ status: "connected" });
    } catch (err) {
      setState({
        status: "error",
        message: err instanceof Error ? err.message : "Failed to connect to server",
      });
    }
  };

  useEffect(() => {
    checkHealth(true);

    timerRef.current = setInterval(() => {
      checkHealth();
    }, HEALTH_CHECK_INTERVAL_MS);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  return { state, retry: () => checkHealth(true) };
}
