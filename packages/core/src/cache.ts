const DEFAULT_TTL = 5 * 60 * 1000; // 5 minutes

interface CacheEntry<T> {
  data: T;
  timestamp: number;
}

export function createCache<T>(ttl: number = DEFAULT_TTL) {
  let cache: CacheEntry<T> | null = null;

  return {
    get(): T | null {
      if (!cache) return null;
      if (Date.now() - cache.timestamp > ttl) {
        cache = null;
        return null;
      }
      return cache.data;
    },
    set(data: T): void {
      cache = { data, timestamp: Date.now() };
    },
    invalidate(): void {
      cache = null;
    },
  };
}
