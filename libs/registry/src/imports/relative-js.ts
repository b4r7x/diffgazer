import { extractImportSpecifierRanges } from "./specifiers.js";

function isRelativeJsSpecifier(specifier: string): boolean {
  return /^\.{1,2}\//.test(specifier) && specifier.endsWith(".js");
}

/**
 * Every relative `.js` import specifier the writer below would rewrite, in source order.
 *
 * Public registry/copy source must not ship `from "./x.js"`-style specifiers: the
 * registry distributes `.ts(x)` sources and copy consumers resolve them without the
 * build-time `.js` rewrite. Gates use this so they flag exactly what
 * `stripRelativeJsExtensions` fixes — a comment or string mentioning `"./x.js"` is
 * not an offence, and a form the lexer sees is never missed.
 */
export function findRelativeJsSpecifiers(content: string): string[] {
  return extractImportSpecifierRanges(content)
    .map(({ specifier }) => specifier)
    .filter(isRelativeJsSpecifier);
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
