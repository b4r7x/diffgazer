import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { collectJsonFiles } from "./utils/fs.js";

export interface OriginRewriteOptions {
  fromOrigin: string;
  toOrigin: string;
}

export interface NormalizeOriginOptions {
  defaultOrigin: string;
}

export function normalizeOrigin(raw: string | undefined | null, options: NormalizeOriginOptions): string {
  const { defaultOrigin } = options;
  const value = (raw ?? defaultOrigin).trim();
  if (!/^https?:\/\//.test(value)) {
    throw new Error(`REGISTRY_ORIGIN must start with http:// or https:// (received "${value}")`);
  }
  return value.replace(/\/+$/, "");
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

export function rewriteOriginsInDir(dir: string, options: OriginRewriteOptions): RewriteOriginsResult {
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
export function resolveAndRewriteOrigin(options: ResolveAndRewriteOriginOptions): { origin: string; rewriteResult: RewriteOriginsResult } {
  const { dir, originRaw, defaultOrigin, fromOrigin = defaultOrigin } = options;
  const origin = normalizeOrigin(originRaw, { defaultOrigin });
  const rewriteResult = rewriteOriginsInDir(dir, { fromOrigin, toOrigin: origin });
  return { origin, rewriteResult };
}
