import { useEffect, useSyncExternalStore } from "react";
import type { SettingsConfig } from "@diffgazer/schemas/config";
import { DEFAULT_TTL } from "@/config/constants";
import { api } from "@/lib/api";

let cache: { data: SettingsConfig; timestamp: number } | null = null;

const subscribers = new Set<() => void>();
function notify() { subscribers.forEach(fn => fn()); }

function getCached(): { data: SettingsConfig; timestamp: number } | null {
  if (!cache) return null;
  if (Date.now() - cache.timestamp > DEFAULT_TTL) {
    cache = null;
    return null;
  }
  return cache;
}

export function invalidateSettingsCache(): void {
  cache = null;
  notify();
}

export async function refreshSettingsCache(): Promise<void> {
  invalidateSettingsCache();
  try {
    const data = await api.getSettings();
    cache = { data, timestamp: Date.now() };
    notify();
  } catch {
    // refresh failed — cache stays null
  }
}

let inflightPromise: Promise<SettingsConfig> | null = null;

function triggerFetch() {
  if (inflightPromise) return;
  inflightPromise = api.getSettings();
  inflightPromise
    .then((data) => {
      cache = { data, timestamp: Date.now() };
      notify();
    })
    .catch(() => {})
    .finally(() => {
      inflightPromise = null;
    });
}

function subscribe(callback: () => void) {
  subscribers.add(callback);
  return () => { subscribers.delete(callback); };
}

function getSnapshot() {
  return cache;
}

export function useSettings() {
  const snapshot = useSyncExternalStore(subscribe, getSnapshot);

  useEffect(() => {
    if (!snapshot && !inflightPromise) {
      triggerFetch();
    }
  }, [snapshot]);

  const refresh = async () => {
    await refreshSettingsCache();
  };

  return {
    settings: snapshot?.data ?? null,
    isLoading: !snapshot && !getCached(),
    error: null,
    refresh,
    invalidate: invalidateSettingsCache,
  };
}
