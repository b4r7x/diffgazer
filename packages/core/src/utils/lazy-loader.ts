import { getErrorMessage } from "../errors.js";

/**
 * Internal state for lazy-loaded modules.
 * Tracks the loaded module, any error that occurred, and whether loading was attempted.
 * @internal
 */
interface LazyLoadState<T> {
  module: T | null;
  error: string | null;
  attempted: boolean;
}

/**
 * Creates a lazy loader for dynamically importing modules.
 *
 * Use this utility when:
 * - A module is optional and may not be available in all environments
 * - The module is expensive to import and may not always be needed
 * - You need to gracefully handle import failures without crashing
 *
 * The returned function caches the result after the first call, so subsequent
 * calls return the same state without re-attempting the import.
 *
 * @example
 * ```typescript
 * const getKeyring = createLazyLoader(() => import("@napi-rs/keyring"));
 *
 * async function useKeyring() {
 *   const { module, error } = await getKeyring();
 *   if (!module) {
 *     console.log("Keyring not available:", error);
 *     return;
 *   }
 *   // Use module...
 * }
 * ```
 *
 * @param loader - Async function that imports/loads the module
 * @returns Async function that returns the cached LazyLoadState
 */
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
