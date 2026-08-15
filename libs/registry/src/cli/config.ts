import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { z } from "zod";
import { detectSourceDir } from "./detect.js";
import { isEnoent } from "./fs/path-safety.js";
import { atomicWriteFile } from "./fs/writes.js";
import { toErrorMessage } from "./terminal.js";

const IMPORT_ALIAS_PREFIX = /^[@~#][\w-]*\//;
const IMPORT_ALIAS_BODY = /^[\w./-]*$/;
const UNSAFE_ALIAS_LITERALS = /["'`\\]/;
const PATH_TRAVERSAL = /\.\./;

function hasControlCharacters(value: string): boolean {
  for (const char of value) {
    const code = char.charCodeAt(0);
    if (code < 32 || code === 127) return true;
  }
  return false;
}

/** Validate an import-alias prefix that is interpolated verbatim into module specifiers. */
export function validateImportAlias(value: string): string | undefined {
  const prefixMatch = value.match(IMPORT_ALIAS_PREFIX);
  if (!prefixMatch) {
    return 'Must start with an import alias such as "@/" or "~/". Relative paths belong in *FsPath fields.';
  }
  const suffix = value.slice(prefixMatch[0].length);
  if (!IMPORT_ALIAS_BODY.test(suffix)) {
    return "Alias must contain only letters, numbers, dots, slashes, and hyphens.";
  }
  if (UNSAFE_ALIAS_LITERALS.test(value) || /\s/.test(value) || hasControlCharacters(value)) {
    return "Alias must not contain quotes, backslashes, whitespace, or control characters.";
  }
  if (PATH_TRAVERSAL.test(value)) {
    return 'Alias must not contain ".." path segments.';
  }
  return undefined;
}

export const aliasPathSchema = z
  .string()
  .superRefine((value, ctx) => {
    const message = validateImportAlias(value);
    if (message) {
      ctx.addIssue({ code: "custom", message });
    }
  })
  .optional();

function aliasToFsPath(alias: string, sourceDir?: string): string {
  const stripped = alias.replace(/^[@~#][\w-]*\//, "");
  return sourceDir && sourceDir !== "." ? `${sourceDir}/${stripped}` : stripped;
}

type ConfigLoadFailure = {
  ok: false;
  error: "not_found" | "read_error" | "parse_error" | "validation_error" | "unknown_error";
  message?: string;
};

export type ConfigLoadResult<T> = { ok: true; config: T } | ConfigLoadFailure;

export type ConfigLoadWithRawResult<T> = { ok: true; config: T; raw: unknown } | ConfigLoadFailure;

function readJsonConfig(
  configFileName: string,
  cwd: string,
): { ok: true; parsed: unknown } | ConfigLoadFailure {
  const configPath = resolve(cwd, configFileName);
  let raw: string;
  try {
    raw = readFileSync(configPath, "utf-8");
  } catch (e) {
    if (isEnoent(e)) return { ok: false, error: "not_found" };
    return {
      ok: false,
      error: "read_error",
      message: `Could not read ${configPath}: ${toErrorMessage(e)}`,
    };
  }

  try {
    return { ok: true, parsed: JSON.parse(raw) };
  } catch (e) {
    return { ok: false, error: "parse_error", message: toErrorMessage(e) };
  }
}

export function loadJsonConfig<T>(
  configFileName: string,
  schema: z.ZodType<T>,
  cwd: string,
): ConfigLoadResult<T> {
  const loaded = readJsonConfig(configFileName, cwd);
  if (!loaded.ok) return loaded;
  return validateParsed(configFileName, schema, loaded.parsed);
}

function loadJsonConfigWithRaw<T>(
  configFileName: string,
  schema: z.ZodType<T>,
  cwd: string,
): ConfigLoadWithRawResult<T> {
  const loaded = readJsonConfig(configFileName, cwd);
  if (!loaded.ok) return loaded;
  const validated = validateParsed(configFileName, schema, loaded.parsed);
  return validated.ok ? { ...validated, raw: loaded.parsed } : validated;
}

function validateParsed<T>(
  configFileName: string,
  schema: z.ZodType<T>,
  parsed: unknown,
): ConfigLoadResult<T> {
  try {
    return { ok: true, config: schema.parse(parsed) };
  } catch (e) {
    if (e instanceof z.ZodError) {
      const details = e.issues.map((i) => `  - ${i.path.join(".")}: ${i.message}`).join("\n");
      return {
        ok: false,
        error: "validation_error",
        message: `Invalid ${configFileName}:\n${details}`,
      };
    }
    return { ok: false, error: "unknown_error", message: toErrorMessage(e) };
  }
}

function writeJsonConfig(configFileName: string, data: unknown, cwd: string): void {
  const configPath = resolve(cwd, configFileName);
  try {
    atomicWriteFile(configPath, `${JSON.stringify(data, null, 2)}\n`);
  } catch (e) {
    throw new Error(`Failed to write config to ${configPath}: ${toErrorMessage(e)}`);
  }
}

export function resolveAliasedPaths<K extends string>(
  rawPaths: Record<K, string | undefined>,
  aliases: Record<K, string>,
  cwd?: string,
): Record<K, string> {
  const sourceDir = cwd ? detectSourceDir(cwd) : ".";
  const entries = (Object.keys(rawPaths) as K[]).map(
    (key) => [key, rawPaths[key] ?? aliasToFsPath(aliases[key], sourceDir)] as const,
  );
  return Object.fromEntries(entries) as Record<K, string>;
}

export function createConfigModule<
  TRaw extends Record<string, unknown>,
  TResolved,
  TManifestItem = unknown,
>(opts: {
  configFileName: string;
  schema: z.ZodType<TRaw>;
  resolveConfig: (raw: TRaw, cwd: string) => TResolved;
  manifestKey: string;
}) {
  const { configFileName, schema, resolveConfig, manifestKey } = opts;

  function load(cwd: string): ConfigLoadResult<TRaw> {
    return loadJsonConfig(configFileName, schema, cwd);
  }

  function loadWithRaw(cwd: string): ConfigLoadWithRawResult<TRaw> {
    return loadJsonConfigWithRaw(configFileName, schema, cwd);
  }

  function loadResolved(cwd: string): ConfigLoadResult<TResolved> {
    const result = load(cwd);
    if (!result.ok) return result;
    return { ok: true, config: resolveConfig(result.config, cwd) };
  }

  function write(cwd: string, config: TRaw): void {
    writeJsonConfig(configFileName, config, cwd);
  }

  // The schema has already validated `result.config`, so the manifest value (an
  // optional record keyed by item name) carries the shape the consumer's
  // `TManifestItem` describes; the runtime guard only narrows the absent/invalid
  // case to `undefined`.
  function getItems(cwd: string): Record<string, TManifestItem> | undefined {
    const result = load(cwd);
    if (!result.ok) return undefined;
    const val = result.config[manifestKey];
    return val && typeof val === "object" && !Array.isArray(val)
      ? (val as Record<string, TManifestItem>)
      : undefined;
  }

  return {
    loadConfig: load,
    loadConfigWithRaw: loadWithRaw,
    loadResolvedConfig: loadResolved,
    writeConfig: write,
    getManifestItems: getItems,
  };
}
