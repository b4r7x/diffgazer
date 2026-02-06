import { useSyncExternalStore } from "react";
import type { SettingsConfig } from "@stargazer/schemas/config";
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

function invalidateSettings(): void {
  cache = null;
  notify();
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

  if (!snapshot && !inflightPromise) {
    triggerFetch();
  }

  const refresh = async () => {
    invalidateSettings();
    try {
      const data = await api.getSettings();
      cache = { data, timestamp: Date.now() };
      notify();
    } catch {
      // refresh failed — cache stays null
    }
  };

  return {
    settings: snapshot?.data ?? null,
    isLoading: !snapshot && !getCached(),
    error: null as string | null,
    refresh,
    invalidate: invalidateSettings,
  };
}
