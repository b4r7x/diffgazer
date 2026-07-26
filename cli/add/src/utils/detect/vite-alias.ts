import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  aliasPrefixFromKey,
  pickSourceAlias,
  type SourceAlias,
  sourceDirFromTarget,
} from "./source-alias.js";

const ALIAS_COLLECTION_RE = /\bresolve\s*:\s*\{[^{}]*\balias\s*:\s*[{[]/;
const STRING_RE = /^(['"])([^'"]*)\1$/;

/**
 * Alias targets read from a config, each capturing the target path in group 2:
 * `"./src"`, `resolve(__dirname, "./src")`, `new URL("./src", import.meta.url).pathname`,
 * and `fileURLToPath(new URL("./src", import.meta.url))`. Anything else falls through to
 * the tsconfig paths / `"@"` default in `detectProject`.
 */
const TARGET_PATTERNS = [
  STRING_RE,
  /^[\w$.]+\(\s*(?:__dirname|import\.meta\.dirname)\s*,\s*(['"])([^'"]*)\1\s*\)$/,
  /^new\s+[\w$]+\(\s*(['"])([^'"]*)\1\s*,\s*import\.meta\.url\s*\)\.pathname$/,
  /^[\w$]+\(\s*new\s+[\w$]+\(\s*(['"])([^'"]*)\1\s*,\s*import\.meta\.url\s*\)\s*\)$/,
];

function stringValue(expression: string): string | null {
  return expression.match(STRING_RE)?.[2] ?? null;
}

function targetFromExpression(expression: string): string | null {
  for (const pattern of TARGET_PATTERNS) {
    const target = expression.match(pattern)?.[2];
    if (target !== undefined) return target;
  }
  return null;
}

/** Comma-separated entries of the object/array opening at `open`, ignoring nested and quoted text. */
function topLevelEntries(source: string, open: number): string[] | null {
  const entries: string[] = [];
  let depth = 0;
  let start = open + 1;

  for (let index = open; index < source.length; index += 1) {
    const character = source[index];
    if (character === "'" || character === '"' || character === "`") {
      const close = source.indexOf(character, index + 1);
      if (close === -1) return null;
      index = close;
      continue;
    }
    if (character === "{" || character === "[" || character === "(") {
      depth += 1;
      continue;
    }
    if (character === "}" || character === "]" || character === ")") {
      depth -= 1;
      if (depth > 0) continue;
      entries.push(source.slice(start, index));
      return entries.map((entry) => entry.trim()).filter((entry) => entry.length > 0);
    }
    if (character === "," && depth === 1) {
      entries.push(source.slice(start, index));
      start = index + 1;
    }
  }

  return null;
}

function entryParts(entry: string): { key: string; expression: string } | null {
  const colon = entry.indexOf(":");
  if (colon === -1) return null;
  const key = entry.slice(0, colon).trim();
  const expression = entry.slice(colon + 1).trim();
  if (!key || !expression) return null;
  return { key: stringValue(key) ?? key, expression };
}

function aliasesFromObject(entries: string[]): SourceAlias[] {
  const aliases: SourceAlias[] = [];

  for (const entry of entries) {
    const parts = entryParts(entry);
    if (!parts) continue;
    const importPrefix = aliasPrefixFromKey(parts.key);
    const target = targetFromExpression(parts.expression);
    const sourceDir = target ? sourceDirFromTarget(target) : null;
    if (importPrefix && sourceDir) aliases.push({ importPrefix, sourceDir });
  }

  return aliases;
}

function aliasesFromArray(elements: string[]): SourceAlias[] {
  const aliases: SourceAlias[] = [];

  for (const element of elements) {
    if (!element.startsWith("{")) continue;
    const entries = topLevelEntries(element, 0)?.map(entryParts) ?? [];
    const find = entries.find((entry) => entry?.key === "find")?.expression;
    const replacement = entries.find((entry) => entry?.key === "replacement")?.expression;
    const findValue = find ? stringValue(find) : null;
    const importPrefix = findValue ? aliasPrefixFromKey(findValue) : null;
    const target = replacement ? targetFromExpression(replacement) : null;
    const sourceDir = target ? sourceDirFromTarget(target) : null;
    if (importPrefix && sourceDir) aliases.push({ importPrefix, sourceDir });
  }

  return aliases;
}

function parseExportedViteAliases(content: string): SourceAlias[] {
  const exportIndex = content.indexOf("export default");
  if (exportIndex === -1) return [];

  const config = content.slice(exportIndex);
  const match = config.match(ALIAS_COLLECTION_RE);
  if (match?.index === undefined) return [];

  const open = match.index + match[0].length - 1;
  const entries = topLevelEntries(config, open);
  if (!entries) return [];
  return config[open] === "[" ? aliasesFromArray(entries) : aliasesFromObject(entries);
}

export function detectViteAlias(cwd: string): SourceAlias | null {
  for (const file of ["vite.config.ts", "vite.config.mts", "vite.config.js", "vite.config.mjs"]) {
    const configPath = resolve(cwd, file);
    if (!existsSync(configPath)) continue;

    const alias = pickSourceAlias(parseExportedViteAliases(readFileSync(configPath, "utf-8")));
    if (alias) return alias;
  }

  return null;
}
