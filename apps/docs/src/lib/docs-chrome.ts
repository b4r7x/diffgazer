import { version } from "@diffgazer/ui/package.json";

export const DOCS_CHROME_VERSION = `v${version}`;

/**
 * Host of @diffgazer/registry's REGISTRY_ORIGIN. Kept as a literal because the
 * registry barrel pulls node-only modules into the client bundle; the
 * colocated test guards against drift.
 */
export const DOCS_REGISTRY_HOST = "r.b4r7.dev";
