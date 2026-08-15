import { extractImportSpecifierRanges } from "@diffgazer/registry";
import type { ResolvedConfig } from "../context.js";
import { SOURCE_ALIASES } from "../context.js";

// Shared with keys-imports.ts only; not part of dgadd's public transform surface.
export function escapeForRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function mapImportSpecifier(specifier: string, aliases: ResolvedConfig["aliases"]): string | null {
  if (specifier === SOURCE_ALIASES.utils) return aliases.utils;

  if (specifier.startsWith(SOURCE_ALIASES.lib)) {
    return `${aliases.lib}/${specifier.slice(SOURCE_ALIASES.lib.length)}`;
  }

  if (specifier.startsWith(SOURCE_ALIASES.hooks)) {
    return `${aliases.hooks}/${specifier.slice(SOURCE_ALIASES.hooks.length)}`;
  }

  if (specifier.startsWith(SOURCE_ALIASES.components)) {
    return `${aliases.components}/${specifier.slice(SOURCE_ALIASES.components.length)}`;
  }

  return null;
}

export function transformImports(content: string, aliases: ResolvedConfig["aliases"]): string {
  const ranges = extractImportSpecifierRanges(content);
  if (ranges.length === 0) return content;

  let result = "";
  let cursor = 0;
  for (const { start, end, specifier } of ranges) {
    result += content.slice(cursor, start);
    const mapped = mapImportSpecifier(specifier, aliases);
    result += mapped ?? specifier;
    cursor = end;
  }

  return result + content.slice(cursor);
}

export function handleRscDirective(content: string, isClient: boolean, rsc: boolean): string {
  const directive = /^\uFEFF?\s*["']use client["'];?\s*(\r?\n)*/;
  const hasDirective = directive.test(content);
  if (hasDirective) return content;
  return rsc && isClient ? `"use client";\n\n${content}` : content;
}
