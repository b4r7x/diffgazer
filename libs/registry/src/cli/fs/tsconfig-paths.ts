import { existsSync, readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, isAbsolute, relative, resolve, sep } from "node:path";
import { realpathExisting } from "./path-safety.js";

function stripJsonComments(json: string): string {
  let result = "";
  let i = 0;
  let inString = false;
  const len = json.length;
  while (i < len) {
    const ch = json[i];

    if (inString) {
      [result, i, inString] = consumeStringChar(json, result, i, len);
      continue;
    }

    if (ch === '"') {
      inString = true;
      result += ch;
      i++;
      continue;
    }
    if (ch === "/" && json[i + 1] === "/") {
      i = skipLineComment(json, i, len);
      continue;
    }
    if (ch === "/" && json[i + 1] === "*") {
      i = skipBlockComment(json, i, len);
      continue;
    }

    result += ch;
    i++;
  }
  return result;
}

function stripJsonTrailingCommas(json: string): string {
  let result = "";
  let inString = false;

  for (let i = 0; i < json.length; i++) {
    const ch = json[i];
    if (inString) {
      const [nextResult, nextIndex, nextInString] = consumeStringChar(json, result, i, json.length);
      result = nextResult;
      i = nextIndex - 1;
      inString = nextInString;
      continue;
    }

    if (ch === '"') {
      inString = true;
      result += ch;
      continue;
    }

    if (ch === ",") {
      let next = i + 1;
      while (/\s/.test(json[next] ?? "")) next += 1;
      if (json[next] === "}" || json[next] === "]") continue;
    }

    result += ch;
  }

  return result;
}

function consumeStringChar(
  json: string,
  result: string,
  i: number,
  len: number,
): [string, number, boolean] {
  const ch = json[i];
  if (ch === "\\" && i + 1 < len) return [result + ch + json[i + 1], i + 2, true];
  return [result + ch, i + 1, ch !== '"'];
}

function skipLineComment(json: string, i: number, len: number): number {
  while (i < len && json[i] !== "\n") i++;
  return i;
}

function skipBlockComment(json: string, i: number, len: number): number {
  i += 2;
  while (i + 1 < len && !(json[i] === "*" && json[i + 1] === "/")) i++;
  return i + 2;
}

export function readTsConfigPaths(cwd: string): Record<string, string[]> | null {
  const root = realpathExisting(cwd) ?? resolve(cwd);
  for (const configFile of ["tsconfig.json", "tsconfig.app.json", "jsconfig.json"]) {
    const paths = tryReadPaths(resolve(root, configFile), root, new Set());
    if (paths) return paths;
  }
  return null;
}

interface EffectiveTsConfigOptions {
  baseUrl?: string;
  paths?: Record<string, string[]>;
  pathsBasePath?: string;
}

function tryReadPaths(
  configPath: string,
  cwd: string,
  seen: Set<string>,
): Record<string, string[]> | null {
  const resolvedConfigPath = resolve(configPath);
  if (seen.has(resolvedConfigPath)) return null;
  seen.add(resolvedConfigPath);

  try {
    const config = readTsConfig(configPath);
    const effective = resolveEffectiveOptions(configPath, new Set());
    if (effective?.paths) {
      const basePath = effective.baseUrl ?? effective.pathsBasePath ?? dirname(configPath);
      return normalizePathTargets(effective.paths, basePath, cwd);
    }
    const references = Array.isArray(config.references) ? config.references : [];
    for (const reference of references) {
      if (!isRecord(reference) || typeof reference.path !== "string") continue;
      const referenced = resolve(dirname(configPath), reference.path);
      const referencedConfig = referenced.endsWith(".json")
        ? referenced
        : resolve(referenced, "tsconfig.json");
      const referencedPaths = tryReadPaths(referencedConfig, cwd, seen);
      if (referencedPaths) return referencedPaths;
    }
  } catch {
    /* Optional tsconfig reading; missing file is OK */
  }
  return null;
}

function resolveEffectiveOptions(
  configPath: string,
  stack: Set<string>,
): EffectiveTsConfigOptions | null {
  const resolvedConfigPath = resolve(configPath);
  if (stack.has(resolvedConfigPath)) return null;
  stack.add(resolvedConfigPath);

  try {
    const config = readTsConfig(resolvedConfigPath);
    const extended = resolveExtendsPath(config.extends, resolvedConfigPath);
    const inherited = extended ? resolveEffectiveOptions(extended, stack) : null;
    const compilerOptions = isRecord(config.compilerOptions) ? config.compilerOptions : {};
    const ownBaseUrl = typeof compilerOptions.baseUrl === "string" ? compilerOptions.baseUrl : null;
    const ownPaths = readPathMap(compilerOptions.paths);

    return {
      ...(inherited ?? {}),
      ...(ownBaseUrl === null ? {} : { baseUrl: resolve(dirname(configPath), ownBaseUrl) }),
      ...(ownPaths === null ? {} : { paths: ownPaths, pathsBasePath: dirname(resolvedConfigPath) }),
    };
  } catch {
    return null;
  } finally {
    stack.delete(resolvedConfigPath);
  }
}

function readTsConfig(configPath: string): Record<string, unknown> {
  const withoutComments = stripJsonComments(readFileSync(configPath, "utf-8"));
  const parsed: unknown = JSON.parse(stripJsonTrailingCommas(withoutComments));
  if (!isRecord(parsed)) throw new Error(`Invalid TypeScript config: ${configPath}`);
  return parsed;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function readPathMap(value: unknown): Record<string, string[]> | null {
  if (!isRecord(value)) return null;
  const paths: Record<string, string[]> = {};
  for (const [key, targets] of Object.entries(value)) {
    if (!Array.isArray(targets) || !targets.every((target) => typeof target === "string")) continue;
    paths[key] = targets;
  }
  return paths;
}

function normalizePathTargets(
  paths: Record<string, string[]>,
  basePath: string,
  cwd: string,
): Record<string, string[]> {
  return Object.fromEntries(
    Object.entries(paths).map(([key, targets]) => [
      key,
      targets.map((target) => {
        const targetPath = relative(cwd, resolve(basePath, target)).split(sep).join("/");
        return targetPath || ".";
      }),
    ]),
  );
}

function resolveExtendsPath(value: unknown, configPath: string): string | null {
  if (typeof value !== "string" || value.length === 0) return null;
  if (value.startsWith(".") || isAbsolute(value)) {
    return resolveConfigFile(resolve(dirname(configPath), value));
  }

  const requireFromConfig = createRequire(configPath);
  for (const request of [value, `${value}.json`]) {
    try {
      const resolved = requireFromConfig.resolve(request);
      if (resolved.endsWith(".json")) return resolved;
    } catch {
      /* Try the optional .json spelling next. */
    }
  }
  return resolvePackageConfig(value, dirname(configPath));
}

function resolvePackageConfig(value: string, configDir: string): string | null {
  const packageSpecifier = splitPackageSpecifier(value);
  if (!packageSpecifier) return null;

  let current = configDir;
  while (true) {
    const packageDir = resolve(current, "node_modules", packageSpecifier.name);
    if (existsSync(packageDir)) {
      const packageJsonPath = resolve(packageDir, "package.json");
      try {
        const packageJson = readTsConfig(packageJsonPath);
        if (packageJson.exports !== undefined) return null;
        if (packageSpecifier.subpath) {
          return resolvePackageConfigFile(resolve(packageDir, packageSpecifier.subpath));
        }
        if (typeof packageJson.tsconfig === "string") {
          return resolvePackageConfigFile(resolve(packageDir, packageJson.tsconfig));
        }
        return resolvePackageConfigFile(resolve(packageDir, "tsconfig"));
      } catch {
        return null;
      }
    }

    const parent = dirname(current);
    if (parent === current) return null;
    current = parent;
  }
}

function splitPackageSpecifier(value: string): { name: string; subpath: string } | null {
  const segments = value.split("/");
  const nameLength = value.startsWith("@") ? 2 : 1;
  if (segments.length < nameLength || segments.slice(0, nameLength).some((part) => !part)) {
    return null;
  }
  return {
    name: segments.slice(0, nameLength).join("/"),
    subpath: segments.slice(nameLength).join("/"),
  };
}

function resolvePackageConfigFile(path: string): string | null {
  return resolveConfigFile(path) ?? resolveConfigFile(resolve(path, "tsconfig"));
}

function resolveConfigFile(path: string): string | null {
  for (const candidate of [path, path.endsWith(".json") ? path : `${path}.json`]) {
    if (existsSync(candidate)) return candidate;
  }
  return null;
}
