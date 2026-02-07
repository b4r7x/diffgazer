import { useEffect, useRef, useState } from "react";
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
  const abortControllerRef = useRef<AbortController | null>(null);

  const checkHealth = async (showChecking = false) => {
    abortControllerRef.current?.abort();
    const controller = new AbortController();
    abortControllerRef.current = controller;

    if (showChecking) setState({ status: "checking" });
    try {
      await api.request("GET", "/api/health", { signal: controller.signal });
      setState({ status: "connected" });
    } catch (err) {
      if (err instanceof Error && err.name === "AbortError") return;
      setState({
        status: "error",
        message: err instanceof Error ? err.message : "Failed to connect to server",
      });
    }
  };

  useEffect(() => {
    checkHealth(true);

    const intervalId = window.setInterval(() => {
      if (!document.hidden) checkHealth();
    }, HEALTH_CHECK_INTERVAL_MS);

    return () => {
      window.clearInterval(intervalId);
      abortControllerRef.current?.abort();
    };
  }, []);

  return { state, retry: () => checkHealth(true) };
}
