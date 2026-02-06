import { useState, useEffect, useCallback } from "react";
import type { SettingsConfig } from "@stargazer/schemas/config";
import { DEFAULT_TTL } from "@/config/constants";
import { api } from "@/lib/api";

let cache: { data: SettingsConfig; timestamp: number } | null = null;

function getCached(): SettingsConfig | null {
  if (!cache) return null;
  if (Date.now() - cache.timestamp > DEFAULT_TTL) {
    cache = null;
    return null;
  }
  return cache.data;
}

function invalidateSettings(): void {
  cache = null;
}

let inflightPromise: Promise<SettingsConfig> | null = null;

export function useSettings() {
  const [settings, setSettings] = useState<SettingsConfig | null>(() => getCached());
  const [isLoading, setIsLoading] = useState(!cache);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const cached = getCached();
    if (cached) {
      setSettings(cached);
      setIsLoading(false);
      return;
    }

    let cancelled = false;

    async function fetch() {
      setIsLoading(true);
      setError(null);
      try {
        if (!inflightPromise) {
          inflightPromise = api.getSettings();
        }
        const data = await inflightPromise;
        inflightPromise = null;
        cache = { data, timestamp: Date.now() };
        if (!cancelled) {
          setSettings(data);
        }
      } catch (err) {
        inflightPromise = null;
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Failed to load settings");
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    }

    fetch();
    return () => { cancelled = true; };
  }, []);

  const refresh = useCallback(async () => {
    invalidateSettings();
    setIsLoading(true);
    setError(null);
    try {
      const data = await api.getSettings();
      cache = { data, timestamp: Date.now() };
      setSettings(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load settings");
    } finally {
      setIsLoading(false);
    }
  }, []);

  return { settings, isLoading, error, refresh, invalidate: invalidateSettings };
}
