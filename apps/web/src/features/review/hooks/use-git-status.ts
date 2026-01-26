import { useState, useEffect, useCallback } from "react";
import { getGitStatus, type GitStatus } from "../api/git-api";

export function useGitStatus() {
  const [status, setStatus] = useState<GitStatus | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchStatus = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await getGitStatus();
      setStatus(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to fetch git status");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchStatus();
  }, [fetchStatus]);

  const hasUnstaged = status?.unstaged && status.unstaged.length > 0;
  const hasStaged = status?.staged && status.staged.length > 0;

  return {
    status,
    hasUnstaged,
    hasStaged,
    isLoading,
    error,
    refresh: fetchStatus,
  };
}
