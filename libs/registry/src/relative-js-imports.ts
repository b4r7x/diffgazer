import { extractImportSpecifierRanges } from "./import-specifiers.js";

/**
 * Canonical matcher for relative `.js` import specifiers in registry source.
 *
 * Public registry/copy source must not ship `from "./x.js"`-style specifiers:
 * the registry distributes `.ts(x)` sources and copy consumers resolve them
 * without the build-time `.js` rewrite. This single definition is the union of
 * every form the registry writers and the validate-artifacts gate must catch:
 * `from "…"`, bare `import "…"`, `export … from "…"`, and `import(…)`/`require(…)`
 * with optional whitespace before `(`. The bare-`import` branch uses a quote
 * lookahead so non-string parens never match.
 *
 * Group 1 is the prefix including the opening quote, group 2 the quote, and
 * group 3 the specifier without its `.js` extension.
 */
export const RELATIVE_JS_IMPORT_RE =
  /((?:\bfrom\s+|\bimport\s*\(\s*|\brequire\s*\(\s*|\bimport\s+(?=["']))(["']))(\.{1,2}\/[^"']+)\.js\2/g;

function isRelativeJsSpecifier(specifier: string): boolean {
  return /^\.{1,2}\//.test(specifier) && specifier.endsWith(".js");
}

/**
 * Removes the `.js` extension from every executable relative import specifier.
 *
 * Uses the lexical import-specifier scanner so `.js`-looking text inside
 * comments, ordinary strings, template literals, JSX strings, and regex
 * literals is left byte-identical.
 */
export function stripRelativeJsExtensions(content: string): string {
  const ranges = extractImportSpecifierRanges(content);
  let result = "";
  let cursor = 0;

  for (const { start, end, specifier } of ranges) {
    result += content.slice(cursor, start);
    result += isRelativeJsSpecifier(specifier) ? specifier.slice(0, -".js".length) : specifier;
    cursor = end;
  }

  return result + content.slice(cursor);
}
