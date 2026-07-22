export interface SourceAlias {
  importPrefix: string;
  sourceDir: string;
}

export function normalizePath(value: string): string {
  return value.replace(/\\/g, "/").replace(/^\.\//, "").replace(/\/$/, "");
}

export function sourceDirFromTarget(target: string): string | null {
  const normalized = normalizePath(target.replace(/\*$/, ""));
  if (!normalized || normalized === ".") return ".";
  if (normalized.includes("node_modules")) return null;
  return normalized === "src" || normalized === "app" ? normalized : null;
}

export function aliasPrefixFromKey(key: string): string | null {
  if (key === "*" || key.length === 0) return null;
  return key.endsWith("/*") ? key.slice(0, -2) : key;
}

export function pickSourceAlias(aliases: SourceAlias[]): SourceAlias | null {
  if (aliases.length === 0) return null;
  const [firstAlias] = aliases;
  return (
    aliases.find((alias) => alias.importPrefix === "@") ??
    aliases.find((alias) => alias.importPrefix === "~") ??
    firstAlias ??
    null
  );
}
