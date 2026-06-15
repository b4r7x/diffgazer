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

/** Removes the `.js` extension from every relative import specifier. */
export function stripRelativeJsExtensions(content: string): string {
  return content.replace(
    RELATIVE_JS_IMPORT_RE,
    (_match, prefix: string, quote: string, specifier: string) => `${prefix}${specifier}${quote}`,
  );
}
