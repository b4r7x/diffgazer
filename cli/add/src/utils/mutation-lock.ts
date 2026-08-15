import { withProjectFileLock } from "@diffgazer/registry/cli";

export const MUTATION_LOCK_RELATIVE = ".diffgazer/mutation.lock";

export function withProjectMutationLock<T>(cwd: string, operation: () => Promise<T>): Promise<T> {
  return withProjectFileLock(cwd, MUTATION_LOCK_RELATIVE, operation);
}
