interface ConfiguredCacheEntry {
  value: boolean;
  timestamp: number;
}

let configuredCache: ConfiguredCacheEntry | null = null;

export function invalidateConfigGuardCache(): void {
  configuredCache = null;
}

export function getConfiguredGuardCache(ttlMs: number): boolean | null {
  if (!configuredCache) return null;
  if (Date.now() - configuredCache.timestamp >= ttlMs) return null;
  return configuredCache.value;
}

export function setConfiguredGuardCache(value: boolean): void {
  configuredCache = { value, timestamp: Date.now() };
}
