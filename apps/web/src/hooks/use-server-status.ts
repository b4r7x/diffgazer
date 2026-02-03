import { useCallback, useEffect, useState } from "react";
import { api } from "@/lib/api";

interface ServerStatus {
  connected: boolean;
  isChecking: boolean;
  error: string | null;
  retry: () => Promise<void>;
}

export function useServerStatus(): ServerStatus {
  const [connected, setConnected] = useState(false);
  const [isChecking, setIsChecking] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const checkHealth = useCallback(async () => {
    setIsChecking(true);
    try {
      await api.request("GET", "/api/health");
      setConnected(true);
      setError(null);
    } catch (err) {
      setConnected(false);
      setError(err instanceof Error ? err.message : "Failed to connect to server");
    } finally {
      setIsChecking(false);
    }
  }, []);

  useEffect(() => {
    checkHealth();
    const intervalId = window.setInterval(checkHealth, 30000);
    return () => window.clearInterval(intervalId);
  }, [checkHealth]);

  return {
    connected,
    isChecking,
    error,
    retry: checkHealth,
  };
}
