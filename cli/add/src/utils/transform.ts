import { KEYS_PACKAGE_IMPORT_TARGETS } from "@diffgazer/registry";
import type { ResolvedConfig } from "../context.js";
import { SOURCE_ALIASES } from "../context.js";
import { getKeysHookImportNames } from "./integration.js";

const IMPORT_PREFIX = String.raw`(from\s+|import\(\s*|require\(\s*)(["'])`;

// Canonical: shared/string-utils.ts — duplicated here because CLI rootDir: "src" prevents external imports
const escapeForRegex = (s: string): string => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

function replaceSubpathAlias(
  text: string,
  regex: RegExp,
  aliasBase: string,
): string {
  return text.replace(
    regex,
    (_: string, prefix: string, quote: string, subpath: string) =>
      `${prefix}${quote}${aliasBase}/${subpath}${quote}`,
  );
}

interface CompiledAliasRegexes {
  reExactUtils: RegExp;
  rePrefixLib: RegExp;
  rePrefixHooks: RegExp;
  rePrefixComponents: RegExp;
}

function compileAliasRegexes(): CompiledAliasRegexes {
  return {
    reExactUtils: new RegExp(`${IMPORT_PREFIX}${escapeForRegex(SOURCE_ALIASES.utils)}\\2`, "g"),
    rePrefixLib: new RegExp(`${IMPORT_PREFIX}${escapeForRegex(SOURCE_ALIASES.lib)}([^"']+)\\2`, "g"),
    rePrefixHooks: new RegExp(`${IMPORT_PREFIX}${escapeForRegex(SOURCE_ALIASES.hooks)}([^"']+)\\2`, "g"),
    rePrefixComponents: new RegExp(`${IMPORT_PREFIX}${escapeForRegex(SOURCE_ALIASES.components)}([^"']+)\\2`, "g"),
  };
}

function replaceLine(text: string, aliases: ResolvedConfig["aliases"], regexes: CompiledAliasRegexes): string {
  let result = text.replace(
    regexes.reExactUtils,
    (_: string, prefix: string, quote: string) => `${prefix}${quote}${aliases.utils}${quote}`,
  );
  result = result.replace(regexes.rePrefixLib, (match, prefix, quote, subpath) => {
    if (subpath === "utils") return match;
    return `${prefix}${quote}${aliases.lib}/${subpath}${quote}`;
  });
  result = replaceSubpathAlias(result, regexes.rePrefixHooks, aliases.hooks);
  result = replaceSubpathAlias(result, regexes.rePrefixComponents, aliases.components);
  return result;
}

function replaceClosingBlockComment(
  line: string,
  aliases: ResolvedConfig["aliases"],
  regexes: CompiledAliasRegexes,
): { result: string; stillInBlock: boolean } {
  const closeIdx = line.indexOf("*/");
  if (closeIdx === -1) return { result: line, stillInBlock: true };
  return {
    result: line.slice(0, closeIdx + 2) + replaceLine(line.slice(closeIdx + 2), aliases, regexes),
    stillInBlock: false,
  };
}

function replaceWithBlockComment(
  line: string,
  openIdx: number,
  aliases: ResolvedConfig["aliases"],
  regexes: CompiledAliasRegexes,
): { result: string; opensBlock: boolean } {
  const closeIdx = line.indexOf("*/", openIdx + 2);
  if (closeIdx === -1) {
    return {
      result: replaceLine(line.slice(0, openIdx), aliases, regexes) + line.slice(openIdx),
      opensBlock: true,
    };
  }
  const before = replaceLine(line.slice(0, openIdx), aliases, regexes);
  const comment = line.slice(openIdx, closeIdx + 2);
  const after = replaceLine(line.slice(closeIdx + 2), aliases, regexes);
  return { result: before + comment + after, opensBlock: false };
}

function replaceLineSkippingComments(
  line: string,
  aliases: ResolvedConfig["aliases"],
  regexes: CompiledAliasRegexes,
): string {
  if (line.trimStart().startsWith("//")) return line;

  const commentStart = findLineCommentStart(line);
  if (commentStart !== -1) {
    return replaceLine(line.slice(0, commentStart), aliases, regexes) + line.slice(commentStart);
  }

  return replaceLine(line, aliases, regexes);
}

export function transformImports(
  content: string,
  aliases: ResolvedConfig["aliases"],
): string {
  const regexes = compileAliasRegexes();
  const lines = content.split("\n");
  let inBlockComment = false;
  const transformed = lines.map((line) => {
    if (inBlockComment) {
      const out = replaceClosingBlockComment(line, aliases, regexes);
      inBlockComment = out.stillInBlock;
      return out.result;
    }

    const openIdx = line.indexOf("/*");
    if (openIdx !== -1) {
      const out = replaceWithBlockComment(line, openIdx, aliases, regexes);
      inBlockComment = out.opensBlock;
      return out.result;
    }

    return replaceLineSkippingComments(line, aliases, regexes);
  });

  return transformed.join("\n");
}

function findLineCommentStart(line: string): number {
  let inString: string | null = null;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inString) {
      if (ch === "\\") { i++; continue; }
      if (ch === inString) inString = null;
      continue;
    }
    if (ch === '"' || ch === "'" || ch === "`") { inString = ch; continue; }
    if (ch === "/" && line[i + 1] === "/") return i;
  }
  return -1;
}

export function handleRscDirective(
  content: string,
  isClient: boolean,
  rsc: boolean
): string {
  const directive = /^\uFEFF?\s*["']use client["'];?\s*(\r?\n)*/;
  const hasDirective = directive.test(content);
  if (hasDirective) return content;
  return rsc && isClient ? `"use client";\n\n${content}` : content;
}

export function rewriteRelativeJsExtensionsForCopy(content: string): string {
  return content.replace(
    new RegExp(`${IMPORT_PREFIX}(\\.{1,2}/[^"']+)\\.js\\2`, "g"),
    (_: string, prefix: string, quote: string, specifier: string) => `${prefix}${quote}${specifier}${quote}`,
  );
}

function specifierName(specifier: string): string {
  return specifier
    .replace(/^type\s+/, "")
    .split(/\s+as\s+/)[0]
    ?.trim() ?? "";
}

function renderImport(specifiers: string[], target: string, quote: string): string {
  const hooksBase = SOURCE_ALIASES.hooks.replace(/\/$/, "");
  return `import { ${specifiers.join(", ")} } from ${quote}${hooksBase}/${target}${quote};`;
}

function rewriteKeysPackageImportLine(line: string): string {
  const match = /^(\s*)import\s+(type\s+)?\{([^}]+)\}\s+from\s+(["'])@diffgazer\/keys\4;?\s*$/.exec(line);
  if (!match) return line;

  const indent = match[1] ?? "";
  const typePrefix = match[2] ?? "";
  const quote = match[4] ?? "\"";
  const grouped = new Map<string, string[]>();
  const unknown: string[] = [];

  for (const rawSpecifier of (match[3] ?? "").split(",")) {
    const specifier = rawSpecifier.trim();
    if (!specifier) continue;

    const target = KEYS_PACKAGE_IMPORT_TARGETS.get(specifierName(specifier));
    if (!target) {
      unknown.push(`${typePrefix}${specifier}`.trim());
      continue;
    }

    const specifiers = grouped.get(target) ?? [];
    specifiers.push(`${typePrefix}${specifier}`.trim());
    grouped.set(target, specifiers);
  }

  const rewritten = [...grouped.entries()].map(([target, specifiers]) =>
    indent + renderImport(specifiers, target, quote)
  );
  if (unknown.length > 0) {
    rewritten.push(`${indent}import { ${unknown.join(", ")} } from ${quote}@diffgazer/keys${quote};`);
  }

  return rewritten.length > 0 ? rewritten.join("\n") : line;
}

export function rewriteKeysPackageImportsForCopy(content: string): string {
  return content.split("\n").map(rewriteKeysPackageImportLine).join("\n");
}

let _keysHookFiles: Set<string> | null = null;
let _reLocalHookImport: RegExp | null = null;

function getKeysHookFilesSet(): Set<string> {
  if (!_keysHookFiles) {
    _keysHookFiles = getKeysHookImportNames();
  }
  return _keysHookFiles;
}

function getLocalHookImportRegex(): RegExp {
  if (!_reLocalHookImport) {
    const hookNames = [...getKeysHookFilesSet()]
      .sort((a, b) => b.length - a.length)
      .map(escapeForRegex);
    const alternation = hookNames.join("|");
    _reLocalHookImport = new RegExp(
      `^\\s*import\\s+(?:type\\s+)?\\{([^}]+)\\}\\s+from\\s+(["'])@\\/hooks\\/(${alternation})\\2\\s*;?\\s*$`,
    );
  }
  return _reLocalHookImport;
}

interface ParsedKeysImport {
  lineIndex: number;
  quote: string;
  specifiers: string[];
  isTypeImport: boolean;
}

function parseKeysImportLine(
  line: string,
  lineIndex: number,
  regex: RegExp,
  hookNames: Set<string>,
): ParsedKeysImport | null {
  const m = regex.exec(line);
  if (!m) return null;

  const hookFile = m[3];
  if (!hookFile || !hookNames.has(hookFile)) return null;

  return {
    lineIndex,
    quote: m[2] ?? '"',
    specifiers: (m[1] ?? "").split(",").map((s) => s.trim()).filter(Boolean),
    isTypeImport: /^\s*import\s+type\s/.test(line),
  };
}

function buildConsolidatedImport(
  parsed: ParsedKeysImport[],
): { consolidated: string; quote: string } | null {
  const valueSpecs: string[] = [];
  const typeSpecs: string[] = [];
  let quote = '"';

  for (const p of parsed) {
    quote = p.quote;
    const target = p.isTypeImport ? typeSpecs : valueSpecs;
    target.push(...p.specifiers);
  }

  const allSpecs = [...valueSpecs, ...typeSpecs.map((s) => `type ${s}`)];
  if (allSpecs.length === 0) return null;

  return {
    consolidated: `import { ${allSpecs.join(", ")} } from ${quote}@diffgazer/keys${quote};`,
    quote,
  };
}

function replaceMatchedLines(
  lines: string[],
  matchedIndices: Set<number>,
  replacement: string[],
): string[] {
  let inserted = false;
  const result: string[] = [];
  for (let i = 0; i < lines.length; i++) {
    if (!matchedIndices.has(i)) {
      result.push(lines[i]!);
      continue;
    }
    if (!inserted) {
      result.push(...replacement);
      inserted = true;
    }
  }
  return result;
}

export function rewriteLocalImportsForKeysPackage(content: string): string {
  const lines = content.split("\n");
  const hookNames = getKeysHookFilesSet();
  const regex = getLocalHookImportRegex();

  const parsed: ParsedKeysImport[] = [];
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (!line) continue;
    const result = parseKeysImportLine(line, i, regex, hookNames);
    if (result) parsed.push(result);
  }

  if (parsed.length === 0) return content;

  const matchedIndices = new Set(parsed.map((p) => p.lineIndex));
  const built = buildConsolidatedImport(parsed);
  const replacement = built ? [built.consolidated] : [];

  return replaceMatchedLines(lines, matchedIndices, replacement).join("\n");
}
