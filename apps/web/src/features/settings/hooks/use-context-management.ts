import { useState, useEffect } from "react";
import { api } from "@/lib/api";

type ContextStatus = "loading" | "ready" | "missing" | "error";

interface ContextManagement {
  contextStatus: ContextStatus;
  contextGeneratedAt: string | null;
  isRefreshing: boolean;
  handleRefreshContext: () => Promise<void>;
  setError: (error: string | null) => void;
}

export function useContextManagement(setError: (error: string | null) => void): ContextManagement {
  const [contextStatus, setContextStatus] = useState<ContextStatus>("loading");
  const [contextGeneratedAt, setContextGeneratedAt] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);

  useEffect(() => {
    let active = true;
    api.getReviewContext()
      .then((context) => {
        if (!active) return;
        setContextStatus("ready");
        setContextGeneratedAt(context.meta.generatedAt);
      })
      .catch(() => {
        if (!active) return;
        setContextStatus("missing");
      });
    return () => { active = false; };
  }, []);

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

  return { contextStatus, contextGeneratedAt, isRefreshing, handleRefreshContext, setError };
}
