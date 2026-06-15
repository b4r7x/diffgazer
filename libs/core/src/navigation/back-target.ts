/**
 * Given a path, returns the logical "back" destination.
 *
 * Rules:
 *   settings sub-route (e.g. "/settings/theme") -> "/settings"
 *   "/settings"                                  -> "/"
 *   everything else                              -> null (caller decides)
 *
 * Accepts paths with or without a leading slash.
 */
export type BackTarget = "/" | "/settings";

export function getBackTarget(currentPath: string): BackTarget | null {
  const path = currentPath.startsWith("/") ? currentPath : `/${currentPath}`;
  const normalized = path.endsWith("/") && path !== "/" ? path.slice(0, -1) : path;

  if (normalized === "/settings") {
    return "/";
  }

  if (normalized.startsWith("/settings/")) {
    return "/settings";
  }

  return null;
}
