import { useEffect, useState } from "react";
import { api } from "../lib/api.js";
import type { SettingsConfig } from "@diffgazer/schemas/config";

interface UseSettingsResult {
  settings: SettingsConfig | null;
  isLoading: boolean;
  error: string | null;
  refresh: () => void;
}

export function useSettings(): UseSettingsResult {
  const [settings, setSettings] = useState<SettingsConfig | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetch = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const result = await api.getSettings();
      setSettings(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load settings");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetch();
  }, []);

  return { settings, isLoading, error, refresh: fetch };
}
