import { readFileSync, writeFileSync } from "node:fs";
import { REGISTRY_ORIGIN } from "./constants.js";
import { collectJsonFiles } from "./utils/fs.js";

export interface OriginRewriteOptions {
  fromOrigin: string;
  toOrigin: string;
}

export interface NormalizeOriginOptions {
  defaultOrigin?: string;
}

export interface ResolveRegistryRouteOptions extends NormalizeOriginOptions {
  origin?: string | null;
}

export function normalizeOrigin(
  raw: string | undefined | null,
  options: NormalizeOriginOptions = {},
): string {
  const defaultOrigin = options.defaultOrigin ?? REGISTRY_ORIGIN;
  const value = (raw ?? defaultOrigin).trim();
  const hasQueryOrFragmentDelimiter = value.includes("?") || value.includes("#");
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new Error(`REGISTRY_ORIGIN must be a hosted http(s) URL (received "${value}")`);
  }

  if (
    (url.protocol !== "http:" && url.protocol !== "https:") ||
    url.hostname === "" ||
    url.username !== "" ||
    url.password !== "" ||
    hasQueryOrFragmentDelimiter ||
    url.search !== "" ||
    url.hash !== ""
  ) {
    throw new Error(
      `REGISTRY_ORIGIN must be a hosted http(s) URL without credentials, a query, or a fragment (received "${value}")`,
    );
  }

  const pathname = url.pathname.replace(/\/+$/, "");
  return `${url.origin}${pathname === "" ? "" : pathname}`;
}

export function resolveRegistryRoute(
  value: string,
  options: ResolveRegistryRouteOptions = {},
): string | null {
  const registryOrigin = new URL(normalizeOrigin(options.origin, options));
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return null;
  }

  if (
    url.origin !== registryOrigin.origin ||
    url.username !== "" ||
    url.password !== "" ||
    url.search !== "" ||
    url.hash !== ""
  ) {
    return null;
  }

  const basePath = registryOrigin.pathname === "/" ? "" : registryOrigin.pathname;
  if (basePath !== "" && !url.pathname.startsWith(`${basePath}/`)) return null;

  const relativePath = basePath === "" ? url.pathname : url.pathname.slice(basePath.length);
  const match = relativePath.match(/^\/r\/(ui|keys)\/((?:registry|[a-z0-9-]+)\.json)$/);
  return match ? `/${match[1]}/${match[2]}` : null;
}

function rewriteOriginValue(value: unknown, options: OriginRewriteOptions): unknown {
  const { fromOrigin, toOrigin } = options;

  if (typeof value === "string") {
    return value.replaceAll(fromOrigin, toOrigin);
  }
  if (Array.isArray(value)) {
    return value.map((item) => rewriteOriginValue(item, { fromOrigin, toOrigin }));
  }
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).map(([key, item]) => [
        key,
        rewriteOriginValue(item, { fromOrigin, toOrigin }),
      ]),
    );
  }
  return value;
}

export interface RewriteOriginsResult {
  changed: number;
  total: number;
}

export function rewriteOriginsInDir(
  dir: string,
  options: OriginRewriteOptions,
): RewriteOriginsResult {
  const { fromOrigin, toOrigin } = options;
  let changed = 0;
  const files = collectJsonFiles(dir);

  for (const jsonFile of files) {
    const raw = readFileSync(jsonFile, "utf-8");
    const parsed = JSON.parse(raw) as unknown;
    const rewritten = rewriteOriginValue(parsed, { fromOrigin, toOrigin });
    const next = `${JSON.stringify(rewritten, null, 2)}\n`;
    if (next !== raw) {
      writeFileSync(jsonFile, next);
      changed += 1;
    }
  }

  return { changed, total: files.length };
}

// Not in the public barrel — only used by shadcn/build.ts
export interface ResolveAndRewriteOriginOptions {
  dir: string;
  originRaw?: string;
  defaultOrigin: string;
  fromOrigin?: string;
}

// Not in the public barrel — only used by shadcn/build.ts
export function resolveAndRewriteOrigin(options: ResolveAndRewriteOriginOptions): {
  origin: string;
  rewriteResult: RewriteOriginsResult;
} {
  const { dir, originRaw, defaultOrigin, fromOrigin = defaultOrigin } = options;
  const origin = normalizeOrigin(originRaw, { defaultOrigin });
  const rewriteResult = rewriteOriginsInDir(dir, { fromOrigin, toOrigin: origin });
  return { origin, rewriteResult };
}
