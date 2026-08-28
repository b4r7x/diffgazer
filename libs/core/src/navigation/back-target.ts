export type BackTarget = "/" | "/settings";

/**
 * A path without a fixed destination returns `null` so the caller picks its own.
 */
export function getBackTarget(currentPath: string): BackTarget | null {
  const path = currentPath.startsWith("/") ? currentPath : `/${currentPath}`;
  const normalized = path.endsWith("/") && path !== "/" ? path.slice(0, -1) : path;

  if (normalized === "/history" || normalized === "/settings") {
    return "/";
  }

  if (normalized.startsWith("/settings/")) {
    return "/settings";
  }

  return null;
}
