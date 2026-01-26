import { useState, useEffect, useCallback } from "react";
import { api } from "../lib/api";

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
      // Assuming GET /health returns 200 OK when healthy
      // We use api.request directly or if there's a specific health endpoint method
      // Since createApiClient exposes request, we can use that for custom paths
      await api.request("GET", "/health");
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
    // Initial check
    checkHealth();

    // Poll every 30 seconds
    const intervalId = setInterval(checkHealth, 30000);

    return () => clearInterval(intervalId);
  }, [checkHealth]);

  return {
    connected,
    isChecking,
    error,
    retry: checkHealth,
  };
}
