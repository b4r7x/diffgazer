import { rewriteKeysPackageImportsInContent, stripRelativeJsExtensions } from "@diffgazer/registry";
import type { ResolvedConfig } from "../context.js";
import { SOURCE_ALIASES } from "../context.js";
import { getKeysHookImportNames } from "./keys-copy-bundle.js";

const IMPORT_PREFIX = String.raw`(from\s+|import\(\s*|require\(\s*)(["'])`;

// Kept local on purpose. `dgadd` publishes as a self-contained npm bundle, so
// pulling a one-line regex-escape from a workspace package would drag that
// package's whole dependency graph into the binary. Same decoupling rationale
// as `sha256` (utils/hashing.ts) and registry `computeIntegrity`.
function escapeForRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function replaceSubpathAlias(options: { text: string; regex: RegExp; aliasBase: string }): string {
  const { text, regex, aliasBase } = options;
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
    rePrefixLib: new RegExp(
      `${IMPORT_PREFIX}${escapeForRegex(SOURCE_ALIASES.lib)}([^"']+)\\2`,
      "g",
    ),
    rePrefixHooks: new RegExp(
      `${IMPORT_PREFIX}${escapeForRegex(SOURCE_ALIASES.hooks)}([^"']+)\\2`,
      "g",
    ),
    rePrefixComponents: new RegExp(
      `${IMPORT_PREFIX}${escapeForRegex(SOURCE_ALIASES.components)}([^"']+)\\2`,
      "g",
    ),
  };
}

function replaceLine(
  text: string,
  aliases: ResolvedConfig["aliases"],
  regexes: CompiledAliasRegexes,
): string {
  let result = text.replace(
    regexes.reExactUtils,
    (_: string, prefix: string, quote: string) => `${prefix}${quote}${aliases.utils}${quote}`,
  );
  result = result.replace(regexes.rePrefixLib, (match, prefix, quote, subpath) => {
    if (subpath === "utils") return match;
    return `${prefix}${quote}${aliases.lib}/${subpath}${quote}`;
  });
  result = replaceSubpathAlias({
    text: result,
    regex: regexes.rePrefixHooks,
    aliasBase: aliases.hooks,
  });
  result = replaceSubpathAlias({
    text: result,
    regex: regexes.rePrefixComponents,
    aliasBase: aliases.components,
  });
  return result;
}

function replaceClosingBlockComment(options: {
  line: string;
  aliases: ResolvedConfig["aliases"];
  regexes: CompiledAliasRegexes;
}): { result: string; stillInBlock: boolean } {
  const { line, aliases, regexes } = options;
  const closeIdx = line.indexOf("*/");
  if (closeIdx === -1) return { result: line, stillInBlock: true };
  return {
    result: line.slice(0, closeIdx + 2) + replaceLine(line.slice(closeIdx + 2), aliases, regexes),
    stillInBlock: false,
  };
}

function replaceWithBlockComment(options: {
  line: string;
  openIdx: number;
  aliases: ResolvedConfig["aliases"];
  regexes: CompiledAliasRegexes;
}): { result: string; opensBlock: boolean } {
  const { line, openIdx, aliases, regexes } = options;
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

export function transformImports(content: string, aliases: ResolvedConfig["aliases"]): string {
  const regexes = compileAliasRegexes();
  const lines = content.split("\n");
  let inBlockComment = false;
  const transformed = lines.map((line) => {
    if (inBlockComment) {
      const out = replaceClosingBlockComment({ line, aliases, regexes });
      inBlockComment = out.stillInBlock;
      return out.result;
    }

    const openIdx = findBlockCommentStart(line);
    if (openIdx !== -1) {
      const out = replaceWithBlockComment({ line, openIdx, aliases, regexes });
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
      if (ch === "\\") {
        i++;
        continue;
      }
      if (ch === inString) inString = null;
      continue;
    }
    if (ch === '"' || ch === "'" || ch === "`") {
      inString = ch;
      continue;
    }
    if (ch === "/" && line[i + 1] === "/") return i;
  }
  return -1;
}

// Find the first real `/*` block-comment opener, skipping `/*` that appears
// inside a string literal (so `const x = "/*"` does not flip the transformer
// into comment mode and suppress alias rewriting for the rest of the file).
// A `//` line comment encountered first wins: any `/*` after it is inside that
// line comment, not a block opener.
function findBlockCommentStart(line: string): number {
  let inString: string | null = null;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inString) {
      if (ch === "\\") {
        i++;
        continue;
      }
      if (ch === inString) inString = null;
      continue;
    }
    if (ch === '"' || ch === "'" || ch === "`") {
      inString = ch;
      continue;
    }
    if (ch === "/" && line[i + 1] === "/") return -1;
    if (ch === "/" && line[i + 1] === "*") return i;
  }
  return -1;
}

export function handleRscDirective(content: string, isClient: boolean, rsc: boolean): string {
  const directive = /^\uFEFF?\s*["']use client["'];?\s*(\r?\n)*/;
  const hasDirective = directive.test(content);
  if (hasDirective) return content;
  return rsc && isClient ? `"use client";\n\n${content}` : content;
}

export function rewriteRelativeJsExtensionsForCopy(content: string): string {
  return stripRelativeJsExtensions(content);
}

function renderImport(specifiers: string[], target: string, quote: string): string {
  const hooksBase = SOURCE_ALIASES.hooks.replace(/\/$/, "");
  return `import { ${specifiers.join(", ")} } from ${quote}${hooksBase}/${target}${quote};`;
}

export function rewriteKeysPackageImportsForCopy(content: string): string {
  return rewriteKeysPackageImportsInContent(content, {
    renderImport: (specifiers, target, quote, indent) =>
      indent + renderImport(specifiers, target, quote),
  });
}

// Both are derived from the copy bundle, which `@diffgazer/registry` loads once
// and treats as immutable for the process lifetime. They are memoized for the
// process and intentionally never invalidated: the alternation regex below is
// O(hooks) to build and the inputs cannot change between CLI commands in a
// single run. A long-lived process that hot-swaps the bundle is not a supported
// mode; if that ever changes, expose a reset alongside the bundle reload.
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

interface ParseKeysImportLineOptions {
  line: string;
  lineIndex: number;
  regex: RegExp;
  hookNames: Set<string>;
}

function parseKeysImportLine(options: ParseKeysImportLineOptions): ParsedKeysImport | null {
  const { line, lineIndex, regex, hookNames } = options;
  const m = regex.exec(line);
  if (!m) return null;

  const hookFile = m[3];
  if (!hookFile || !hookNames.has(hookFile)) return null;

  return {
    lineIndex,
    quote: m[2] ?? '"',
    specifiers: (m[1] ?? "")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean),
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
      const line = lines[i];
      if (line !== undefined) result.push(line);
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
    const result = parseKeysImportLine({ line, lineIndex: i, regex, hookNames });
    if (result) parsed.push(result);
  }

  if (parsed.length === 0) return content;

  const matchedIndices = new Set(parsed.map((p) => p.lineIndex));
  const built = buildConsolidatedImport(parsed);
  const replacement = built ? [built.consolidated] : [];

  return replaceMatchedLines(lines, matchedIndices, replacement).join("\n");
}
