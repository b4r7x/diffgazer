import { version } from "@diffgazer/ui/package.json";

export const DOCS_CHROME_VERSION = `v${version}`;

/**
 * Host of @diffgazer/registry's REGISTRY_ORIGIN. Kept as a literal because the
 * registry barrel pulls node-only modules into the client bundle; the
 * colocated test guards against drift.
 */
export const DOCS_REGISTRY_HOST = "r.b4r7.dev";

/**
 * The full-viewport docs shell: the `docs-chrome` token scope plus the
 * horizontal safe-area insets. Shared by the normal shell and the root error
 * boundary so a crashed route still paints the same frame.
 */
export const DOCS_SHELL_CLASS =
  "docs-chrome flex h-dvh flex-col overflow-hidden bg-background text-foreground pl-[env(safe-area-inset-left)] pr-[env(safe-area-inset-right)]";
