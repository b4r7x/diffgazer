import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  aliasPrefixFromKey,
  pickSourceAlias,
  type SourceAlias,
  sourceDirFromTarget,
} from "./source-alias.js";

const STRING_RE = /^(['"])([^'"]*)\1$/;

const VITE_CONFIG_FILES = [
  "vite.config.ts",
  "vite.config.mts",
  "vite.config.js",
  "vite.config.mjs",
  "vite.config.cjs",
  "vite.config.cts",
] as const;

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

function skipString(source: string, start: number): number {
  const quote = source[start];
  if (quote !== "'" && quote !== '"' && quote !== "`") return start;
  let index = start + 1;
  while (index < source.length) {
    const character = source[index];
    if (character === "\\") {
      index += 2;
      continue;
    }
    if (character === quote) return index + 1;
    index += 1;
  }
  return source.length;
}

function skipWhitespaceAndComments(source: string, start: number): number {
  let index = start;
  while (index < source.length) {
    const character = source[index];
    if (/\s/.test(character ?? "")) {
      index += 1;
      continue;
    }
    if (character === "/" && source[index + 1] === "/") {
      index += 2;
      while (index < source.length && source[index] !== "\n") index += 1;
      continue;
    }
    if (character === "/" && source[index + 1] === "*") {
      index += 2;
      while (index < source.length && !(source[index] === "*" && source[index + 1] === "/")) {
        index += 1;
      }
      index = Math.min(source.length, index + 2);
      continue;
    }
    if (character === "'" || character === '"' || character === "`") {
      index = skipString(source, index);
      continue;
    }
    break;
  }
  return index;
}

function readPropertyKey(source: string, start: number): { key: string; end: number } | null {
  const index = skipWhitespaceAndComments(source, start);
  if (index >= source.length) return null;

  const character = source[index];
  if (character === "'" || character === '"' || character === "`") {
    const end = skipString(source, index);
    const literal = source.slice(index, end);
    const key = stringValue(literal.trim());
    return key ? { key, end } : null;
  }

  const match = source.slice(index).match(/^[\w$]+/);
  if (!match) return null;
  return { key: match[0], end: index + match[0].length };
}

function skipBalancedValue(source: string, start: number): number {
  let index = skipWhitespaceAndComments(source, start);
  if (index >= source.length) return index;

  const open = source[index];
  if (open !== "{" && open !== "[" && open !== "(") {
    while (index < source.length) {
      const character = source[index];
      if (character === "," || character === "}" || character === "]" || character === ")") {
        return index;
      }
      if (character === "'" || character === '"' || character === "`") {
        index = skipString(source, index);
        continue;
      }
      if (character === "/" && source[index + 1] === "/") {
        index += 2;
        while (index < source.length && source[index] !== "\n") index += 1;
        continue;
      }
      if (character === "/" && source[index + 1] === "*") {
        index += 2;
        while (index < source.length && !(source[index] === "*" && source[index + 1] === "/")) {
          index += 1;
        }
        index = Math.min(source.length, index + 2);
        continue;
      }
      index += 1;
    }
    return index;
  }

  let close: "}" | "]" | ")";
  if (open === "{") {
    close = "}";
  } else if (open === "[") {
    close = "]";
  } else {
    close = ")";
  }
  let depth = 0;
  while (index < source.length) {
    const character = source[index];
    if (character === "'" || character === '"' || character === "`") {
      index = skipString(source, index);
      continue;
    }
    if (character === "/" && source[index + 1] === "/") {
      index += 2;
      while (index < source.length && source[index] !== "\n") index += 1;
      continue;
    }
    if (character === "/" && source[index + 1] === "*") {
      index += 2;
      while (index < source.length && !(source[index] === "*" && source[index + 1] === "/")) {
        index += 1;
      }
      index = Math.min(source.length, index + 2);
      continue;
    }
    if (character === open) depth += 1;
    if (character === close) {
      depth -= 1;
      if (depth === 0) return index + 1;
    }
    index += 1;
  }
  return source.length;
}

function findTopLevelPropertyValueStart(
  source: string,
  objectOpen: number,
  propertyName: string,
): number | null {
  if (source[objectOpen] !== "{") return null;

  let index = objectOpen + 1;
  while (index < source.length) {
    index = skipWhitespaceAndComments(source, index);
    if (source[index] === "}") return null;

    const key = readPropertyKey(source, index);
    if (!key) return null;
    index = skipWhitespaceAndComments(source, key.end);
    if (source[index] !== ":") return null;
    index = skipWhitespaceAndComments(source, index + 1);

    if (key.key === propertyName) return index;

    index = skipBalancedValue(source, index);
    index = skipWhitespaceAndComments(source, index);
    if (source[index] === ",") index += 1;
  }

  return null;
}

function skipBalancedParens(source: string, open: number): number {
  if (source[open] !== "(") return open + 1;
  let depth = 0;
  let index = open;
  while (index < source.length) {
    const character = source[index];
    if (character === "'" || character === '"' || character === "`") {
      index = skipString(source, index);
      continue;
    }
    if (character === "/" && source[index + 1] === "/") {
      index += 2;
      while (index < source.length && source[index] !== "\n") index += 1;
      continue;
    }
    if (character === "/" && source[index + 1] === "*") {
      index += 2;
      while (index < source.length && !(source[index] === "*" && source[index + 1] === "/")) {
        index += 1;
      }
      index = Math.min(source.length, index + 2);
      continue;
    }
    if (character === "(") depth += 1;
    if (character === ")") {
      depth -= 1;
      if (depth === 0) return index + 1;
    }
    index += 1;
  }
  return source.length;
}

function findExportedConfigObjectOpen(source: string): number | null {
  const exportIndex = source.indexOf("export default");
  const moduleExportsIndex = source.indexOf("module.exports");
  let markerIndex = exportIndex;
  if (markerIndex === -1 || (moduleExportsIndex !== -1 && moduleExportsIndex < markerIndex)) {
    markerIndex = moduleExportsIndex;
  }
  if (markerIndex === -1) return null;

  const marker =
    markerIndex === exportIndex && exportIndex !== -1 ? "export default" : "module.exports";
  let index = skipWhitespaceAndComments(source, markerIndex + marker.length);
  if (marker === "module.exports") {
    index = skipWhitespaceAndComments(source, index);
    if (source[index] === "=") {
      index = skipWhitespaceAndComments(source, index + 1);
    }
  }

  index = skipWhitespaceAndComments(source, index);
  if (source.slice(index).startsWith("defineConfig")) {
    index += "defineConfig".length;
    index = skipWhitespaceAndComments(source, index);
    if (source[index] !== "(") return null;
    index = skipWhitespaceAndComments(source, index + 1);
    if (source[index] === "(") {
      index = skipBalancedParens(source, index);
      index = skipWhitespaceAndComments(source, index);
      if (!source.startsWith("=>", index)) return null;
      index = skipWhitespaceAndComments(source, index + 2);
      if (source[index] === "(") index = skipWhitespaceAndComments(source, index + 1);
    }
    return source[index] === "{" ? index : null;
  }

  while (index < source.length) {
    index = skipWhitespaceAndComments(source, index);
    const identifier = source.slice(index).match(/^[\w$]+/)?.[0];
    if (identifier) {
      index += identifier.length;
      index = skipWhitespaceAndComments(source, index);
      if (source[index] === "(") {
        index = skipBalancedParens(source, index);
        index = skipWhitespaceAndComments(source, index);
        if (source.startsWith("=>", index)) {
          index = skipWhitespaceAndComments(source, index + 2);
        }
        continue;
      }
    }
    if (source[index] === "{") return index;
    break;
  }

  return null;
}

function findRootResolveAliasOpen(source: string): number | null {
  const configOpen = findExportedConfigObjectOpen(source);
  if (configOpen === null) return null;

  const resolveValueStart = findTopLevelPropertyValueStart(source, configOpen, "resolve");
  if (resolveValueStart === null || source[resolveValueStart] !== "{") return null;

  const aliasValueStart = findTopLevelPropertyValueStart(source, resolveValueStart, "alias");
  if (aliasValueStart === null) return null;

  const open = source[aliasValueStart];
  if (open !== "{" && open !== "[") return null;
  return aliasValueStart;
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
  const aliasOpen = findRootResolveAliasOpen(content);
  if (aliasOpen === null) return [];

  const entries = topLevelEntries(content, aliasOpen);
  if (!entries) return [];
  return content[aliasOpen] === "[" ? aliasesFromArray(entries) : aliasesFromObject(entries);
}

export function detectViteAlias(cwd: string): SourceAlias | null {
  for (const file of VITE_CONFIG_FILES) {
    const configPath = resolve(cwd, file);
    if (!existsSync(configPath)) continue;

    const alias = pickSourceAlias(parseExportedViteAliases(readFileSync(configPath, "utf-8")));
    if (alias) return alias;
  }

  return null;
}
