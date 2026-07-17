import {
  getStaticModuleSpecifier,
  isToken,
  type SourceToken,
  tokenizeSource,
} from "./import-specifier-lexer.js";

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

export interface StaticNamedImport {
  /** Half-open range covering the import declaration, including its semicolon when present. */
  declarationStart: number;
  declarationEnd: number;
  /** Half-open range containing the raw text between the named-import braces. */
  specifiersStart: number;
  specifiersEnd: number;
  specifier: string;
  quote: '"' | "'";
  typePrefix: "" | "type ";
  isTypeOnly: boolean;
}

export function stripTemplateLiterals(source: string): string {
  return source.replace(/`(?:\\[\s\S]|[^`\\])*`/g, "``");
}

function findFromSpecifier(
  tokens: SourceToken[],
  start: number,
): { token: Extract<SourceToken, { kind: "string" }>; index: number } | undefined {
  for (let index = start; index < tokens.length; index += 1) {
    const token = tokens[index];
    if (isToken(token, "punctuator", ";")) return undefined;
    const specifier = tokens[index + 1];
    if (isToken(token, "identifier", "from") && specifier?.kind === "string") {
      return { token: specifier, index: index + 1 };
    }
  }
  return undefined;
}

function findNamedImportClose(tokens: SourceToken[], openIndex: number): SourceToken | undefined {
  for (let index = openIndex + 1; index < tokens.length; index += 1) {
    const token = tokens[index];
    if (isToken(token, "punctuator", "}")) return token;
    if (isToken(token, "punctuator", ";")) return undefined;
  }
  return undefined;
}

export function extractStaticNamedImports(source: string): StaticNamedImport[] {
  const tokens = tokenizeSource(source);
  const declarations: StaticNamedImport[] = [];

  for (let index = 0; index < tokens.length; index += 1) {
    const token = tokens[index];
    if (!token || !isToken(token, "identifier", "import")) continue;
    const previous = tokens[index - 1];
    if (isToken(previous, "punctuator", ".") || isToken(previous, "punctuator", "?.")) continue;

    const next = tokens[index + 1];
    const isTypeOnly = isToken(next, "identifier", "type");
    const openIndex = isTypeOnly ? index + 2 : index + 1;
    const open = tokens[openIndex];
    if (!open || !isToken(open, "punctuator", "{")) continue;
    const close = findNamedImportClose(tokens, openIndex);
    const from = findFromSpecifier(tokens, openIndex + 1);
    if (!close || !from || close.end > from.token.start) continue;
    const semicolon = tokens[from.index + 1];

    declarations.push({
      declarationStart: token.start,
      declarationEnd:
        semicolon && isToken(semicolon, "punctuator", ";") ? semicolon.end : from.token.end,
      specifiersStart: open.end,
      specifiersEnd: close.start,
      specifier: from.token.value,
      quote: from.token.quote,
      typePrefix: isTypeOnly ? "type " : "",
      isTypeOnly,
    });
  }

  return declarations;
}

export function extractImportSpecifiers(source: string): ImportSpecifier[] {
  const tokens = tokenizeSource(source);
  const imports: ImportSpecifier[] = [];
  const exports: ImportSpecifier[] = [];
  const dynamicImports: ImportSpecifier[] = [];
  const requires: ImportSpecifier[] = [];
  const sideEffects: ImportSpecifier[] = [];

  for (let index = 0; index < tokens.length; index += 1) {
    const token = tokens[index];
    const previous = tokens[index - 1];

    if (
      isToken(token, "identifier", "import") &&
      !isToken(previous, "punctuator", ".") &&
      !isToken(previous, "punctuator", "?.")
    ) {
      const next = tokens[index + 1];
      if (next?.kind === "string") {
        sideEffects.push({ specifier: next.value, kind: "side-effect", isTypeOnly: false });
        continue;
      }
      const dynamicSpecifierValue = getStaticModuleSpecifier(tokens[index + 2]);
      if (isToken(next, "punctuator", "(") && dynamicSpecifierValue !== undefined) {
        dynamicImports.push({
          specifier: dynamicSpecifierValue,
          kind: "dynamic-import",
          isTypeOnly: false,
        });
        continue;
      }
      if (
        next?.kind === "identifier" ||
        isToken(next, "punctuator", "{") ||
        isToken(next, "punctuator", "*")
      ) {
        const specifier = findFromSpecifier(tokens, index + 2)?.token;
        if (specifier) {
          imports.push({
            specifier: specifier.value,
            kind: "import",
            isTypeOnly: isToken(next, "identifier", "type"),
          });
        }
      }
      continue;
    }

    if (isToken(token, "identifier", "export")) {
      const next = tokens[index + 1];
      const isTypeOnly = isToken(next, "identifier", "type");
      const exportedShape = isTypeOnly ? tokens[index + 2] : next;
      if (isToken(exportedShape, "punctuator", "{") || isToken(exportedShape, "punctuator", "*")) {
        const specifier = findFromSpecifier(tokens, index + 2)?.token;
        if (specifier) {
          exports.push({ specifier: specifier.value, kind: "export", isTypeOnly });
        }
      }
      continue;
    }

    const requiredSpecifierValue = getStaticModuleSpecifier(tokens[index + 2]);
    if (
      isToken(token, "identifier", "require") &&
      !isToken(previous, "punctuator", ".") &&
      !isToken(previous, "punctuator", "?.") &&
      isToken(tokens[index + 1], "punctuator", "(") &&
      requiredSpecifierValue !== undefined
    ) {
      requires.push({
        specifier: requiredSpecifierValue,
        kind: "require",
        isTypeOnly: false,
      });
    }
  }

  return [...imports, ...exports, ...dynamicImports, ...requires, ...sideEffects];
}
