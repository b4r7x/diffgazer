import { createHash } from "node:crypto";

/**
 * Creates a unique project identifier from a filesystem path.
 * Uses SHA256 hash truncated to 16 characters for uniqueness while keeping IDs readable.
 *
 * @param path - Absolute filesystem path to the project root
 * @returns 16-character hex string identifier
 */
export function createProjectId(path: string): string {
  return createHash("sha256").update(path).digest("hex").slice(0, 16);
}
