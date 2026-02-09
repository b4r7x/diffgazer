import { useCallback, useEffect, useState } from "react";
import { api } from "@/lib/api";

type ContextStatus = "loading" | "ready" | "missing" | "error";

interface ContextManagement {
  contextStatus: ContextStatus;
  contextGeneratedAt: string | null;
  isRefreshing: boolean;
  error: string | null;
  setError: (error: string | null) => void;
  reloadContextStatus: () => Promise<void>;
  handleRefreshContext: () => Promise<void>;
}

export function useContextManagement(): ContextManagement {
  const [contextStatus, setContextStatus] = useState<ContextStatus>("loading");
  const [contextGeneratedAt, setContextGeneratedAt] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reloadContextStatus = useCallback(async () => {
    setContextStatus("loading");
    setError(null);
    try {
      const context = await api.getReviewContext();
      setContextStatus("ready");
      setContextGeneratedAt(context.meta.generatedAt);
    } catch (err) {
      const status = err && typeof err === "object" && "status" in err
        ? (err as { status?: number }).status
        : undefined;

      if (status === 404) {
        setContextStatus("missing");
        setContextGeneratedAt(null);
        return;
      }

      setContextStatus("error");
      setContextGeneratedAt(null);
      setError(err instanceof Error ? err.message : "Failed to load context status");
    }
  }, []);

  useEffect(() => {
    void reloadContextStatus();
  }, [reloadContextStatus]);

  const handleRefreshContext = async () => {
    setIsRefreshing(true);
    setError(null);
    try {
      const refreshed = await api.refreshReviewContext({ force: true });
      setContextStatus("ready");
      setContextGeneratedAt(refreshed.meta.generatedAt);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to refresh context");
      setContextStatus("error");
    } finally {
      setIsRefreshing(false);
    }
  };

  return {
    contextStatus,
    contextGeneratedAt,
    isRefreshing,
    error,
    setError,
    reloadContextStatus,
    handleRefreshContext,
  };
}
