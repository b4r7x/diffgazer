import { posix } from "node:path";
import { extractImportSpecifierRanges } from "./specifiers.js";

/** What to do with a relative specifier that resolves to no file in the copied set. */
export type UnresolvedSpecifierPolicy = "keep" | "throw";

export interface RewriteRelativeImportsForTargetLayoutOptions {
  content: string;
  /** Path of the file being copied, keyed as in `pathMap`. */
  sourcePath: string;
  /** Installed path of the file being copied. */
  targetPath: string;
  /** Source path to installed path for every file in the copied set. */
  pathMap: ReadonlyMap<string, string>;
  unresolved: UnresolvedSpecifierPolicy;
}

const RELATIVE_SPECIFIER = /^\.{1,2}\//;
const JS_EXTENSION = /\.js$/;
const SOURCE_EXTENSION = /\.(tsx?|jsx?)$/;

function resolveInstalledPath(
  specifier: string,
  sourceDir: string,
  pathMap: ReadonlyMap<string, string>,
): string | undefined {
  const base = posix.join(sourceDir, specifier.replace(JS_EXTENSION, ""));
  const candidates = [base, `${base}.ts`, `${base}.tsx`, `${base}/index.ts`, `${base}/index.tsx`];
  for (const candidate of candidates) {
    const installed = pathMap.get(candidate);
    if (installed) return installed;
  }
  return undefined;
}

function relocateSpecifier(
  specifier: string,
  options: RewriteRelativeImportsForTargetLayoutOptions,
): string {
  if (!RELATIVE_SPECIFIER.test(specifier)) return specifier;

  const sourceDir = posix.dirname(options.sourcePath);
  const installed = resolveInstalledPath(specifier, sourceDir, options.pathMap);
  if (!installed) {
    if (options.unresolved === "throw") {
      throw new Error(
        `Cannot rewrite ${specifier} in ${options.sourcePath}: it resolves to no file in the copied set`,
      );
    }
    return specifier;
  }

  const targetDir = posix.dirname(options.targetPath);
  const relocated = posix.relative(targetDir, installed.replace(SOURCE_EXTENSION, ""));
  return relocated.startsWith(".") ? relocated : `./${relocated}`;
}

/**
 * Re-expresses a copied file's relative imports against the installed layout.
 *
 * A registry may relocate files on install — keys hooks source their helpers from
 * `core/`, `dom/`, and nested hook dirs but all land under `hooks/utils/*` — so a
 * copied file's relative imports resolve to nothing unless they are recomputed
 * from the importer's install directory to each import's install path.
 *
 * Resolution mirrors a bundler: the specifier is resolved against the importer's
 * SOURCE directory, trying the bare path, `.ts`/`.tsx`, and a directory index.
 * Rewriting goes through the lexical import scanner, so relative-looking text in
 * comments, strings, template literals, JSX, and regex literals stays untouched.
 *
 * Callers own the policy for specifiers that resolve to no copied file: the dgadd
 * copy bundle throws (every keys import must land inside the bundle), while the
 * public shadcn build keeps them (its map covers one registry item at a time).
 */
export function rewriteRelativeImportsForTargetLayout(
  options: RewriteRelativeImportsForTargetLayoutOptions,
): string {
  const { content } = options;
  let result = "";
  let cursor = 0;

  for (const { start, end, specifier } of extractImportSpecifierRanges(content)) {
    result += content.slice(cursor, start);
    result += relocateSpecifier(specifier, options);
    cursor = end;
  }

  return result + content.slice(cursor);
}
