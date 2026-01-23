import { getErrorMessage } from "../errors.js";

interface LazyLoadState<T> {
  module: T | null;
  error: string | null;
  attempted: boolean;
}

/** Factory for lazy-loading optional modules with error handling and caching. */
export function createLazyLoader<T>(
  loader: () => Promise<T>
): () => Promise<LazyLoadState<T>> {
  const state: LazyLoadState<T> = { module: null, error: null, attempted: false };

  return async function (): Promise<LazyLoadState<T>> {
    if (state.attempted) return state;
    state.attempted = true;
    try {
      state.module = await loader();
    } catch (error) {
      state.error = getErrorMessage(error);
    }
    return state;
  };
}
