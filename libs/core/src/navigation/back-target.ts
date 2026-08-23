export type BackTarget = "/" | "/settings";

/**
 * A path outside settings returns `null` so the caller picks its own destination.
 */
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
