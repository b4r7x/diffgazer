import { randomBytes } from "node:crypto";
import {
  cpSync,
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  realpathSync,
  renameSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import {
  lstat as lstatAsync,
  mkdir as mkdirAsync,
  readFile as readFileAsync,
  unlink as unlinkAsync,
  writeFile as writeFileAsync,
} from "node:fs/promises";
import { createRequire } from "node:module";
import { dirname, isAbsolute, join, relative, resolve, sep } from "node:path";
import { isWithinDir } from "../utils/fs.js";

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

export function isEnoent(e: unknown): boolean {
  if (!(e instanceof Error) || !("code" in e)) return false;
  const err: Error & { code: unknown } = e;
  return err.code === "ENOENT";
}

export function ensureWithinDir(targetPath: string, baseDir: string): void {
  const resolvedTarget = resolve(targetPath);
  const resolvedBase = resolve(baseDir);
  if (!isWithinDir(resolvedTarget, resolvedBase)) {
    throw new Error(`Path traversal detected: "${targetPath}" escapes "${baseDir}"`);
  }

  ensureRealPathWithinDir(resolvedTarget, resolvedBase);
}

export function ensureWithinAnyDir(targetPath: string, baseDirs: string[]): void {
  const resolvedTarget = resolve(targetPath);
  for (const dir of baseDirs) {
    const resolvedBase = resolve(dir);
    if (
      isWithinDir(resolvedTarget, resolvedBase) &&
      isRealPathWithinDir(resolvedTarget, resolvedBase)
    )
      return;
  }
  throw new Error(
    `Path traversal detected: "${targetPath}" escapes all allowed directories: ${baseDirs.map((d) => `"${d}"`).join(", ")}`,
  );
}

function realpathExisting(path: string): string | null {
  try {
    return realpathSync.native(path);
  } catch (e) {
    if (isEnoent(e)) return null;
    throw e;
  }
}

function nearestExistingRealpath(path: string): string | null {
  let current = path;
  while (!existsSync(current)) {
    const parent = dirname(current);
    if (parent === current) return null;
    current = parent;
  }
  try {
    return realpathSync.native(current);
  } catch {
    return null;
  }
}

function isRealPathWithinDir(targetPath: string, baseDir: string): boolean {
  const realBase =
    realpathExisting(baseDir) ?? nearestExistingRealpath(baseDir) ?? resolve(baseDir);
  const realTarget =
    realpathExisting(targetPath) ??
    nearestExistingRealpath(dirname(targetPath)) ??
    resolve(dirname(targetPath));
  return isWithinDir(realTarget, realBase);
}

function ensureRealPathWithinDir(targetPath: string, baseDir: string): void {
  if (isRealPathWithinDir(targetPath, baseDir)) return;
  throw new Error(
    `Path traversal detected: "${targetPath}" escapes "${baseDir}" through a symlink or realpath.`,
  );
}

export function cleanEmptyDirs(dirs: string[]): void {
  for (const dir of dirs) {
    tryRemoveIfEmpty(dir);
  }
}

function tryRemoveIfEmpty(dir: string): void {
  try {
    if (existsSync(dir) && readdirSync(dir).length === 0) rmSync(dir, { recursive: true });
  } catch {
    /* Best-effort cleanup of empty dirs */
  }
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

export function atomicWriteFile(
  targetPath: string,
  content: string,
  opts?: { ensureDir?: boolean },
): void {
  if (opts?.ensureDir !== false) {
    mkdirSync(dirname(targetPath), { recursive: true });
  }
  const tmpPath = join(dirname(targetPath), `.tmp-${randomBytes(6).toString("hex")}`);
  try {
    writeFileSync(tmpPath, content);
    renameSync(tmpPath, targetPath);
  } catch (e) {
    try {
      rmSync(tmpPath);
    } catch {
      /* Best-effort temp file cleanup; original error is re-thrown */
    }
    throw e;
  }
}

interface FileLockOwner {
  pid: number;
  token: string;
}

interface FileLockSnapshot {
  content: string;
  owner: FileLockOwner | null;
  stat: {
    ctimeMs: number;
    dev: number;
    ino: number;
    mtimeMs: number;
    size: number;
  };
}

const MALFORMED_LOCK_GRACE_MS = 50;

function isFileLockOwner(value: unknown): value is FileLockOwner {
  if (typeof value !== "object" || value === null) return false;
  const record = value as Record<string, unknown>;
  return (
    typeof record.pid === "number" &&
    Number.isSafeInteger(record.pid) &&
    record.pid > 0 &&
    typeof record.token === "string" &&
    record.token.length > 0
  );
}

function sameFileStat(left: FileLockSnapshot["stat"], right: FileLockSnapshot["stat"]): boolean {
  return (
    left.dev === right.dev &&
    left.ino === right.ino &&
    left.size === right.size &&
    left.mtimeMs === right.mtimeMs &&
    left.ctimeMs === right.ctimeMs
  );
}

async function readFileLockSnapshot(lockPath: string): Promise<FileLockSnapshot | null> {
  try {
    const before = await lstatAsync(lockPath);
    const content = await readFileAsync(lockPath, "utf8");
    const after = await lstatAsync(lockPath);
    const beforeStat = {
      ctimeMs: before.ctimeMs,
      dev: before.dev,
      ino: before.ino,
      mtimeMs: before.mtimeMs,
      size: before.size,
    };
    const afterStat = {
      ctimeMs: after.ctimeMs,
      dev: after.dev,
      ino: after.ino,
      mtimeMs: after.mtimeMs,
      size: after.size,
    };
    if (!sameFileStat(beforeStat, afterStat)) return null;

    let parsed: unknown;
    try {
      parsed = JSON.parse(content);
    } catch {
      parsed = null;
    }
    return {
      content,
      owner: isFileLockOwner(parsed) ? parsed : null,
      stat: afterStat,
    };
  } catch {
    return null;
  }
}

function sameFileLock(left: FileLockSnapshot, right: FileLockSnapshot): boolean {
  return left.content === right.content && sameFileStat(left.stat, right.stat);
}

async function removeFileLockIfUnchanged(
  lockPath: string,
  expected: FileLockSnapshot,
): Promise<boolean> {
  const confirmed = await readFileLockSnapshot(lockPath);
  if (!confirmed || !sameFileLock(confirmed, expected)) return false;

  try {
    await unlinkAsync(lockPath);
    return true;
  } catch (error) {
    if (isEnoent(error)) return false;
    throw error;
  }
}

function isProcessRunning(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    return !(error instanceof Error && "code" in error && error.code === "ESRCH");
  }
}

function waitForFileLock(): Promise<void> {
  return new Promise((resolveWait) => setTimeout(resolveWait, 10));
}

export async function withFileLock<T>(lockPath: string, operation: () => Promise<T>): Promise<T> {
  await mkdirAsync(dirname(lockPath), { recursive: true });
  const owner: FileLockOwner = {
    pid: process.pid,
    token: randomBytes(12).toString("hex"),
  };
  const serializedOwner = JSON.stringify(owner);
  let malformedLock: { firstSeenAt: number; snapshot: FileLockSnapshot } | null = null;

  while (true) {
    try {
      await writeFileAsync(lockPath, serializedOwner, { flag: "wx" });
      break;
    } catch (error) {
      if (!(error instanceof Error && "code" in error && error.code === "EEXIST")) throw error;
      const current = await readFileLockSnapshot(lockPath);
      if (current?.owner) {
        malformedLock = null;
        if (!isProcessRunning(current.owner.pid)) {
          await removeFileLockIfUnchanged(lockPath, current);
          continue;
        }
      } else if (current) {
        if (!malformedLock || !sameFileLock(malformedLock.snapshot, current)) {
          malformedLock = { firstSeenAt: Date.now(), snapshot: current };
        } else if (Date.now() - malformedLock.firstSeenAt >= MALFORMED_LOCK_GRACE_MS) {
          await removeFileLockIfUnchanged(lockPath, current);
          malformedLock = null;
          continue;
        }
      } else {
        malformedLock = null;
      }
      await waitForFileLock();
    }
  }

  try {
    return await operation();
  } finally {
    const current = await readFileLockSnapshot(lockPath);
    if (current?.owner?.token === owner.token) {
      await removeFileLockIfUnchanged(lockPath, current);
    }
  }
}

export type WriteResult = "written" | "skipped" | "overwritten";

export function writeFileSafe(
  filePath: string,
  content: string,
  overwrite: boolean = false,
): WriteResult {
  const exists = existsSync(filePath);

  if (exists && !overwrite) {
    return "skipped";
  }

  atomicWriteFile(filePath, content);

  return exists ? "overwritten" : "written";
}

export function copyGeneratedDir(pkgRoot: string, srcRelative: string, distRelative: string): void {
  const src = resolve(pkgRoot, srcRelative);
  if (!existsSync(src)) {
    throw new Error(`${srcRelative}/ not found. Run prebuild first.`);
  }
  cpSync(src, resolve(pkgRoot, distRelative), { recursive: true, force: true });
}

export function getRelativePath(file: { path: string }, prefixes: string[]): string {
  for (const prefix of prefixes) {
    if (file.path.startsWith(prefix)) {
      return file.path.slice(prefix.length);
    }
  }
  throw new Error(
    `Unsupported registry file path "${file.path}". Expected path to start with one of: ${prefixes.map((p) => `"${p}"`).join(", ")}.`,
  );
}
