import { extractImportSpecifiers } from "../../import-specifiers.js";

const DEFAULT_PEER_DEPS = new Set<string>();
const DEFAULT_ALIAS_PREFIXES = ["@/", "./", "../", "node:"];

export interface DetectNpmImportsOptions {
  peerDeps?: Set<string>;
  aliasPrefixes?: string[];
}

export function detectNpmImports(content: string, options?: DetectNpmImportsOptions): string[] {
  const peerDeps = options?.peerDeps ?? DEFAULT_PEER_DEPS;
  const aliasPrefixes = options?.aliasPrefixes ?? DEFAULT_ALIAS_PREFIXES;
  const imports: string[] = [];

  for (const { specifier: pkg, isTypeOnly } of extractImportSpecifiers(content)) {
    if (isTypeOnly || aliasPrefixes.some((p) => pkg.startsWith(p))) continue;

    const parts = pkg.split("/");
    let pkgName = parts[0] ?? pkg;
    if (pkg.startsWith("@")) {
      pkgName = parts[0] && parts[1] ? `${parts[0]}/${parts[1]}` : pkg;
    }
    if (!peerDeps.has(pkgName)) imports.push(pkgName);
  }

  return [...new Set(imports)];
}
