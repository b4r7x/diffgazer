import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join, relative, resolve } from "node:path";
import { registryItemToDistKey } from "./dist-keys.js";

interface RscRegistryItem {
  name: string;
  type: string;
  meta?: { client?: boolean; hidden?: boolean };
}

interface RscRegistry {
  items: RscRegistryItem[];
}

interface AssertRscClientDirectivesOptions {
  rootDir: string;
  registryPath: string;
  packagePath?: string;
  /** Public client subpaths the consuming package ships outside its registry. */
  extraClientOutputs?: Record<string, string>;
}

function isWhitespace(char: string | undefined): boolean {
  return char !== undefined && /\s/u.test(char);
}

function isLineTerminator(char: string | undefined): boolean {
  return char === "\n" || char === "\r" || char === "\u2028" || char === "\u2029";
}

interface TriviaResult {
  index: number;
  hasLineTerminator: boolean;
}

interface StringLiteralResult {
  end: number;
  raw: string;
}

const IDENTIFIER_PART = /[\p{ID_Continue}\u200c\u200d]/u;

function skipTrivia(content: string, start: number): TriviaResult {
  let index = start;
  let hasLineTerminator = false;

  while (index < content.length) {
    if (isWhitespace(content[index])) {
      hasLineTerminator ||= isLineTerminator(content[index]);
      index += 1;
      continue;
    }

    if (content.startsWith("//", index)) {
      const lineEnd = /[\r\n\u2028\u2029]/u.exec(content.slice(index + 2));
      if (!lineEnd) return { index: content.length, hasLineTerminator };
      hasLineTerminator = true;
      index = index + 2 + lineEnd.index + 1;
      continue;
    }

    if (content.startsWith("/*", index)) {
      const end = content.indexOf("*/", index + 2);
      if (end === -1) return { index: -1, hasLineTerminator };
      hasLineTerminator ||= /[\r\n\u2028\u2029]/u.test(content.slice(index, end + 2));
      index = end + 2;
      continue;
    }

    break;
  }

  return { index, hasLineTerminator };
}

/**
 * A hashbang is only legal as the very first token of a source, after an optional
 * BOM. Consuming it here instead of inside the trivia scan keeps that position
 * requirement: a `#!` reached after whitespace or a comment is not a hashbang.
 */
function skipHashbang(content: string): number {
  const start = content.startsWith("\ufeff") ? 1 : 0;
  if (!content.startsWith("#!", start)) return start;

  const lineEnd = /[\r\n\u2028\u2029]/u.exec(content.slice(start + 2));
  return lineEnd ? start + 2 + lineEnd.index + 1 : content.length;
}

function parseStringLiteral(content: string, start: number): StringLiteralResult | null {
  const quote = content[start];
  if (quote !== '"' && quote !== "'") return null;

  let index = start + 1;
  while (index < content.length) {
    const char = content[index];
    if (char === quote) {
      return { end: index + 1, raw: content.slice(start + 1, index) };
    }
    if (char === "\\") {
      const escaped = content[index + 1];
      if (escaped === "\r") {
        // A CRLF line continuation is one escaped line terminator. Consuming
        // only the CR would expose the LF as an illegal raw line break.
        index += content[index + 2] === "\n" ? 3 : 2;
        continue;
      }
      if (escaped === "\n") {
        index += 2;
        continue;
      }
      index += 2;
      continue;
    }
    // ECMAScript permits raw U+2028/U+2029 in string literals. Raw CR/LF
    // remain illegal; escaped forms were consumed above as continuations.
    if (char === "\r" || char === "\n") return null;
    index += 1;
  }

  return null;
}

function parseUnicodeEscape(content: string, index: number): number | null {
  if (content[index] !== "\\" || content[index + 1] !== "u") return null;

  if (content[index + 2] === "{") {
    const close = content.indexOf("}", index + 3);
    if (close === -1) return null;
    const digits = content.slice(index + 3, close);
    if (!/^[\da-f]{1,6}$/iu.test(digits)) return null;
    const codePoint = Number.parseInt(digits, 16);
    return codePoint <= 0x10ffff ? codePoint : null;
  }

  const digits = content.slice(index + 2, index + 6);
  if (!/^[\da-f]{4}$/iu.test(digits)) return null;
  return Number.parseInt(digits, 16);
}

function isIdentifierPartAt(content: string, index: number): boolean {
  const char = content[index];
  if (char === undefined) return false;
  if (char === "\\") {
    const codePoint = parseUnicodeEscape(content, index);
    return codePoint !== null && isIdentifierPartAt(String.fromCodePoint(codePoint), 0);
  }

  const codePoint = content.codePointAt(index);
  if (codePoint === undefined) return false;
  const value = String.fromCodePoint(codePoint);
  return value === "$" || value === "_" || IDENTIFIER_PART.test(value);
}

function startsKeyword(content: string, index: number, keyword: string): boolean {
  return content.startsWith(keyword, index) && !isIdentifierPartAt(content, index + keyword.length);
}

function continuesStringExpression(content: string, index: number): boolean {
  const char = content[index];
  if (char === "+" || char === "-") return content[index + 1] !== char;
  // `!` continues the expression only as `!=`/`!==`; on its own it opens a new
  // unary statement, so ASI terminates the directive before it.
  if (char === "!") return content[index + 1] === "=";
  if (char !== undefined && ".[(`*/%&|^<>=?:,".includes(char)) return true;

  return startsKeyword(content, index, "in") || startsKeyword(content, index, "instanceof");
}

function statementBoundary(content: string, end: number): number | null {
  const trailing = skipTrivia(content, end);
  if (trailing.index < 0) return null;
  if (trailing.index === content.length) return trailing.index;
  if (content[trailing.index] === ";") return trailing.index + 1;
  if (!trailing.hasLineTerminator || continuesStringExpression(content, trailing.index)) {
    return null;
  }
  return trailing.index;
}

/** Returns true only for a real leading string-literal directive prologue entry. */
export function hasUseClientDirective(content: string): boolean {
  let index = skipTrivia(content, skipHashbang(content)).index;
  if (index < 0) return false;

  while (index < content.length) {
    const literal = parseStringLiteral(content, index);
    if (!literal) return false;

    const next = statementBoundary(content, literal.end);
    if (next === null) return false;
    if (literal.raw === "use client") return true;

    index = skipTrivia(content, next).index;
    if (index < 0) return false;
  }

  return false;
}

export function getPublicClientOutputMap(
  items: readonly RscRegistryItem[],
  extraClientOutputs: Record<string, string> = {},
): ReadonlyMap<string, string> {
  const outputs = new Map<string, string>();
  for (const item of items) {
    if (!item.meta?.client || item.meta.hidden) continue;
    const output = registryItemToDistKey(item);
    outputs.set(`./${output}`, output);
  }
  for (const [publicSubpath, output] of Object.entries(extraClientOutputs)) {
    outputs.set(publicSubpath, output);
  }
  return outputs;
}

export function assertRscClientDirectives({
  rootDir,
  registryPath,
  packagePath = resolve(rootDir, "package.json"),
  extraClientOutputs,
}: AssertRscClientDirectivesOptions): void {
  const registry = JSON.parse(readFileSync(registryPath, "utf-8")) as RscRegistry;
  const packageJson = JSON.parse(readFileSync(packagePath, "utf-8")) as {
    exports?: Record<string, string | { import?: string }>;
  };

  const missing: string[] = [];

  for (const [publicSubpath, output] of getPublicClientOutputMap(
    registry.items,
    extraClientOutputs,
  )) {
    const relativePath = `dist/${output}.js`;
    const exportValue = packageJson.exports?.[publicSubpath];
    const importTarget = typeof exportValue === "string" ? exportValue : exportValue?.import;
    if (importTarget !== `./${relativePath}`) {
      missing.push(`${publicSubpath} (missing package export to ./${relativePath})`);
    }
    if (!existsSync(resolve(rootDir, relativePath))) {
      missing.push(`${relativePath} (missing public client output)`);
      continue;
    }
    if (!hasUseClientDirective(readFileSync(resolve(rootDir, relativePath), "utf-8"))) {
      missing.push(relativePath);
    }
  }

  if (missing.length > 0) {
    throw new Error(
      `Missing "use client" directive in built client output:\n${missing
        .map((path) => `- ${path}`)
        .join("\n")}`,
    );
  }
}

interface AssertSourceRscClientDirectivesOptions {
  srcDir: string;
  distDir: string;
  packageLabel: string;
  skipDirs?: string[];
}

function collectSourceFiles(dir: string, skipDirs: Set<string>): string[] {
  const files: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      if (skipDirs.has(entry.name)) continue;
      files.push(...collectSourceFiles(join(dir, entry.name), skipDirs));
    } else if (
      (entry.name.endsWith(".ts") || entry.name.endsWith(".tsx")) &&
      !entry.name.endsWith(".test.ts") &&
      !entry.name.endsWith(".test.tsx") &&
      !entry.name.endsWith(".d.ts")
    ) {
      files.push(join(dir, entry.name));
    }
  }
  return files;
}

/**
 * Source-of-truth RSC guard for tsc-built packages (src→dist 1:1 layout). Every
 * source file that authors a leading "use client" directive must keep it in its
 * mapped dist output (`src/x/y.ts(x)` → `dist/x/y.js`). A missing dist file is a
 * failure, not a silent skip — a silent skip is exactly the hole this closes.
 */
export function assertSourceRscClientDirectives({
  srcDir,
  distDir,
  packageLabel,
  skipDirs = [],
}: AssertSourceRscClientDirectivesOptions): number {
  const skip = new Set(skipDirs);
  const missing: string[] = [];
  let guarded = 0;

  for (const sourceFile of collectSourceFiles(srcDir, skip)) {
    if (!hasUseClientDirective(readFileSync(sourceFile, "utf-8"))) continue;

    const distPath = resolve(distDir, relative(srcDir, sourceFile).replace(/\.tsx?$/, ".js"));
    if (!existsSync(distPath)) {
      missing.push(`${distPath} (missing dist output)`);
      continue;
    }
    if (!hasUseClientDirective(readFileSync(distPath, "utf-8"))) {
      missing.push(distPath);
      continue;
    }
    guarded += 1;
  }

  if (missing.length > 0) {
    throw new Error(
      [
        `Missing "use client" directive in built ${packageLabel} output:`,
        ...missing.map((path) => `- ${path}`),
        "The source authors a leading directive that did not survive into dist.",
      ].join("\n"),
    );
  }

  return guarded;
}
