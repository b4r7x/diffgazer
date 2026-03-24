import { useEffect, useState } from "react";
import { api } from "../lib/api.js";
import type { InitResponse } from "@diffgazer/schemas/config";

interface UseInitResult {
  data: InitResponse | null;
  isLoading: boolean;
  error: string | null;
  refresh: () => void;
}

export function useInit(): UseInitResult {
  const [data, setData] = useState<InitResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetch = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const result = await api.loadInit();
      setData(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load init data");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetch();
  }, []);

  return { data, isLoading, error, refresh: fetch };
}
