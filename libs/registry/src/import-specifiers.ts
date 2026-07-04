export type ImportSpecifierKind =
  | "import"
  | "export"
  | "dynamic-import"
  | "require"
  | "side-effect";

export interface ImportSpecifier {
  specifier: string;
  kind: ImportSpecifierKind;
  isTypeOnly: boolean;
}

const IMPORT_PATTERNS: Array<{
  kind: ImportSpecifierKind;
  pattern: RegExp;
  specifierGroup: number;
  typeOnlyGroup?: number;
}> = [
  {
    kind: "import",
    pattern: /\bimport\s+(type\s+)?[^;]*?\s+from\s+["']([^"']+)["']/g,
    specifierGroup: 2,
    typeOnlyGroup: 1,
  },
  {
    kind: "export",
    pattern: /\bexport\s+(type\s+)?[^;]*?\s+from\s+["']([^"']+)["']/g,
    specifierGroup: 2,
    typeOnlyGroup: 1,
  },
  {
    kind: "dynamic-import",
    pattern: /\bimport\s*\(\s*["']([^"']+)["']\s*\)/g,
    specifierGroup: 1,
  },
  {
    kind: "require",
    pattern: /\brequire\s*\(\s*["']([^"']+)["']\s*\)/g,
    specifierGroup: 1,
  },
  {
    kind: "side-effect",
    pattern: /\bimport\s+["']([^"']+)["']/g,
    specifierGroup: 1,
  },
];

export function stripTemplateLiterals(source: string): string {
  return source.replace(/`(?:\\[\s\S]|[^`\\])*`/g, "``");
}

function findQuotedLiteralEnd(source: string, start: number, quote: '"' | "'" | "`"): number {
  let index = start + 1;
  while (index < source.length) {
    const char = source[index];
    if (char === "\\") {
      index += 2;
      continue;
    }
    index += 1;
    if (char === quote) return index;
  }
  return source.length;
}

function stripCommentsAndTemplateLiterals(source: string): string {
  const output: string[] = [];
  let index = 0;

  while (index < source.length) {
    const char = source[index];
    if (char === undefined) break;
    const next = source[index + 1];

    if (char === '"' || char === "'") {
      const end = findQuotedLiteralEnd(source, index, char);
      output.push(source.slice(index, end));
      index = end;
      continue;
    }

    if (char === "`") {
      const end = findQuotedLiteralEnd(source, index, char);
      output.push("``");
      index = end;
      continue;
    }

    if (char === "/" && next === "/") {
      output.push("  ");
      index += 2;
      while (index < source.length && source[index] !== "\n" && source[index] !== "\r") {
        output.push(" ");
        index += 1;
      }
      continue;
    }

    if (char === "/" && next === "*") {
      output.push("  ");
      index += 2;
      while (index < source.length) {
        if (source[index] === "*" && source[index + 1] === "/") {
          output.push("  ");
          index += 2;
          break;
        }
        const commentChar = source[index];
        if (commentChar === undefined) break;
        output.push(commentChar === "\n" || commentChar === "\r" ? commentChar : " ");
        index += 1;
      }
      continue;
    }

    output.push(char);
    index += 1;
  }

  return output.join("");
}

export function extractImportSpecifiers(source: string): ImportSpecifier[] {
  const cleaned = stripCommentsAndTemplateLiterals(source);
  const specifiers: ImportSpecifier[] = [];

  for (const { kind, pattern, specifierGroup, typeOnlyGroup } of IMPORT_PATTERNS) {
    pattern.lastIndex = 0;
    let match = pattern.exec(cleaned);
    while (match !== null) {
      const specifier = match[specifierGroup];
      if (specifier) {
        specifiers.push({
          specifier,
          kind,
          isTypeOnly: typeOnlyGroup !== undefined && match[typeOnlyGroup] !== undefined,
        });
      }
      match = pattern.exec(cleaned);
    }
  }

  return specifiers;
}
