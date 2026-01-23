import type { Result } from "../result.js";
import { err } from "../result.js";

export function createResourceWrapper<R, E>(
  getResource: () => Promise<R | null>,
  unavailableError: () => E
): <T>(fn: (resource: R) => Result<T, E>) => Promise<Result<T, E>> {
  return async function <T>(fn: (resource: R) => Result<T, E>): Promise<Result<T, E>> {
    const resource = await getResource();
    if (!resource) {
      return err(unavailableError());
    }
    return fn(resource);
  };
}
