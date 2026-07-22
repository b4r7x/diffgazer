import { stripRelativeJsExtensions } from "@diffgazer/registry";
import type { ResolvedConfig } from "../context.js";
import { SOURCE_ALIASES } from "../context.js";

const IMPORT_PREFIX = String.raw`(from\s+|import\(\s*|require\(\s*)(["'])`;

// Shared with keys-imports.ts only; not part of dgadd's public transform surface.
export function escapeForRegex(value: string): string {
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
