import { findJsxExpressionEnd, maskJsxRawText } from "./jsx-source-mask.js";
import {
  findQuotedLiteralEnd,
  isIdentifierPart,
  isIdentifierStart,
} from "./source-lexical-utils.js";

interface SourceRange {
  start: number;
  end: number;
}

export type SourceToken =
  | (SourceRange & { kind: "identifier"; value: string })
  | (SourceRange & { kind: "number"; value: string })
  | (SourceRange & {
      kind: "punctuator";
      value: string;
      allowsRegexAfter?: boolean;
      startsExpressionBody?: boolean;
    })
  | (SourceRange & { kind: "string"; value: string; quote: '"' | "'" })
  | (SourceRange & { kind: "template"; value?: string });

const REGEX_PREFIX_IDENTIFIERS = new Set([
  "await",
  "case",
  "delete",
  "do",
  "else",
  "in",
  "instanceof",
  "of",
  "return",
  "throw",
  "typeof",
  "void",
  "yield",
]);

const CONTROL_CONDITION_IDENTIFIERS = new Set(["catch", "for", "if", "switch", "while", "with"]);
const BLOCK_PREFIX_IDENTIFIERS = new Set(["do", "else", "finally", "try"]);

const TWO_CHARACTER_PUNCTUATORS = new Set([
  "&&",
  "++",
  "--",
  "=>",
  "==",
  ">=",
  "<=",
  "!=",
  "??",
  "?.",
  "||",
]);

function isDeclarationContext(tokens: SourceToken[], keywordIndex: number): boolean {
  let cursor = keywordIndex - 1;
  let token = tokens[cursor];

  if (isToken(token, "identifier", "async")) {
    cursor -= 1;
    token = tokens[cursor];
  }
  if (isToken(token, "identifier", "default")) {
    cursor -= 1;
    token = tokens[cursor];
  }
  if (isToken(token, "identifier", "export")) return true;
  if (!token) return true;
  return (
    token.kind === "punctuator" &&
    (token.value === ";" || token.value === "{" || token.value === "}")
  );
}

function findFunctionKeyword(tokens: SourceToken[]): number | undefined {
  let namedIdentifierSeen = false;
  for (let index = tokens.length - 1; index >= Math.max(0, tokens.length - 5); index -= 1) {
    const token = tokens[index];
    if (!token) break;
    if (isToken(token, "identifier", "function")) return index;
    if (isToken(token, "punctuator", "*")) continue;
    if (token.kind === "identifier" && !namedIdentifierSeen) {
      namedIdentifierSeen = true;
      continue;
    }
    break;
  }
  return undefined;
}

function findClassKeyword(tokens: SourceToken[]): number | undefined {
  for (let index = tokens.length - 1; index >= Math.max(0, tokens.length - 12); index -= 1) {
    const token = tokens[index];
    if (!token) break;
    if (isToken(token, "identifier", "class")) return index;
    if (
      token.kind === "punctuator" &&
      (token.value === ";" || token.value === "{" || token.value === "}")
    ) {
      return undefined;
    }
  }
  return undefined;
}

function isRegexLiteralStart(
  previous: SourceToken | undefined,
  source: string,
  index: number,
): boolean {
  if (source[index + 1] === ">") return false;
  if (!previous) return true;
  const next = source[index + 1];
  if (isToken(previous, "punctuator", "<") && next !== undefined && isIdentifierStart(next)) {
    return false;
  }
  if (previous.kind === "identifier") return REGEX_PREFIX_IDENTIFIERS.has(previous.value);
  if (previous.kind === "number" || previous.kind === "string" || previous.kind === "template") {
    return false;
  }
  if (previous.value === ")" && previous.allowsRegexAfter) return true;
  if (previous.value === "}" && previous.allowsRegexAfter) return true;
  return (
    previous.value !== ")" &&
    previous.value !== "]" &&
    previous.value !== "}" &&
    previous.value !== "++" &&
    previous.value !== "--"
  );
}

function findRegexLiteralEnd(source: string, start: number): number {
  let index = start + 1;
  let inCharacterClass = false;

  while (index < source.length) {
    const char = source[index];
    if (char === "\\") {
      index += 2;
      continue;
    }
    if (char === "[") inCharacterClass = true;
    if (char === "]") inCharacterClass = false;
    if (char === "/" && !inCharacterClass) {
      index += 1;
      while (index < source.length) {
        const flag = source[index];
        if (flag === undefined || !isIdentifierPart(flag)) break;
        index += 1;
      }
      return index;
    }
    if (char === "\n" || char === "\r") return index;
    index += 1;
  }

  return source.length;
}

interface TokenizedTemplate {
  end: number;
  expressionTokens: SourceToken[];
  value?: string;
}

function tokenizeTemplateLiteral(source: string, start: number, offset: number): TokenizedTemplate {
  const expressionTokens: SourceToken[] = [];
  let hasSubstitution = false;
  let index = start + 1;

  while (index < source.length) {
    const char = source[index];
    if (char === "\\") {
      index += 2;
      continue;
    }
    if (char === "`") {
      return {
        end: index + 1,
        expressionTokens,
        ...(hasSubstitution ? {} : { value: source.slice(start + 1, index) }),
      };
    }
    if (char === "$" && source[index + 1] === "{") {
      hasSubstitution = true;
      const expressionStart = index + 2;
      const expressionEnd = findJsxExpressionEnd(source, index + 1);
      const contentEnd = source[expressionEnd - 1] === "}" ? expressionEnd - 1 : expressionEnd;
      expressionTokens.push(
        ...tokenizeSource(source.slice(expressionStart, contentEnd), offset + expressionStart),
      );
      index = expressionEnd;
      continue;
    }
    index += 1;
  }

  return { end: source.length, expressionTokens };
}

export function tokenizeSource(source: string, offset = 0): SourceToken[] {
  const lexicalSource = maskJsxRawText(source);
  const tokens: SourceToken[] = [];
  const parenContexts: Array<"control" | "function-expression" | "normal"> = [];
  const braceContexts: Array<"statement-block" | "expression-block" | "object"> = [];
  let index = 0;

  while (index < lexicalSource.length) {
    const char = lexicalSource[index];
    if (char === undefined) break;
    const next = lexicalSource[index + 1];

    if (char === '"' || char === "'") {
      const end = findQuotedLiteralEnd(lexicalSource, index, char);
      if (lexicalSource[end - 1] === char) {
        tokens.push({
          kind: "string",
          value: source.slice(index + 1, end - 1),
          quote: char,
          start: offset + index,
          end: offset + end,
        });
      }
      index = end;
      continue;
    }

    if (char === "`") {
      const template = tokenizeTemplateLiteral(source, index, offset);
      tokens.push(...template.expressionTokens, {
        kind: "template",
        ...(template.value === undefined ? {} : { value: template.value }),
        start: offset + index,
        end: offset + template.end,
      });
      index = template.end;
      continue;
    }

    if (char === "/" && next === "/") {
      index += 2;
      while (
        index < lexicalSource.length &&
        lexicalSource[index] !== "\n" &&
        lexicalSource[index] !== "\r"
      ) {
        index += 1;
      }
      continue;
    }

    if (char === "/" && next === "*") {
      index += 2;
      while (index < lexicalSource.length) {
        if (lexicalSource[index] === "*" && lexicalSource[index + 1] === "/") {
          index += 2;
          break;
        }
        index += 1;
      }
      continue;
    }

    if (char === "/" && isRegexLiteralStart(tokens.at(-1), lexicalSource, index)) {
      index = findRegexLiteralEnd(lexicalSource, index);
      continue;
    }

    if (isIdentifierStart(char)) {
      let end = index + 1;
      while (end < lexicalSource.length) {
        const part = lexicalSource[end];
        if (part === undefined || !isIdentifierPart(part)) break;
        end += 1;
      }
      tokens.push({
        kind: "identifier",
        value: lexicalSource.slice(index, end),
        start: offset + index,
        end: offset + end,
      });
      index = end;
      continue;
    }

    if (/[0-9]/.test(char)) {
      let end = index + 1;
      while (end < lexicalSource.length && /[0-9A-F_a-f.xX]/.test(lexicalSource[end] ?? "")) {
        end += 1;
      }
      tokens.push({
        kind: "number",
        value: lexicalSource.slice(index, end),
        start: offset + index,
        end: offset + end,
      });
      index = end;
      continue;
    }

    if (/\s/.test(char)) {
      index += 1;
      continue;
    }

    if (char === "(") {
      const previous = tokens.at(-1);
      const functionKeyword = findFunctionKeyword(tokens);
      let context: "control" | "function-expression" | "normal" = "normal";
      if (previous?.kind === "identifier" && CONTROL_CONDITION_IDENTIFIERS.has(previous.value)) {
        context = "control";
      } else if (functionKeyword !== undefined) {
        context = isDeclarationContext(tokens, functionKeyword) ? "normal" : "function-expression";
      }
      parenContexts.push(context);
      tokens.push({
        kind: "punctuator",
        value: char,
        start: offset + index,
        end: offset + index + 1,
      });
      index += 1;
      continue;
    }

    if (char === ")") {
      const context = parenContexts.pop();
      tokens.push({
        kind: "punctuator",
        value: char,
        start: offset + index,
        end: offset + index + 1,
        allowsRegexAfter: context === "control" || undefined,
        startsExpressionBody: context === "function-expression" || undefined,
      });
      index += 1;
      continue;
    }

    if (char === "{") {
      const previous = tokens.at(-1);
      const classKeyword = findClassKeyword(tokens);
      let context: "statement-block" | "expression-block" | "object" = "object";
      if (classKeyword !== undefined) {
        context = isDeclarationContext(tokens, classKeyword)
          ? "statement-block"
          : "expression-block";
      } else if (
        previous === undefined ||
        (previous.kind === "identifier" && BLOCK_PREFIX_IDENTIFIERS.has(previous.value)) ||
        (previous.kind === "punctuator" &&
          (previous.value === ";" ||
            (previous.value === "}" && previous.allowsRegexAfter === true)))
      ) {
        context = "statement-block";
      } else if (previous.kind === "punctuator" && previous.value === ")") {
        context = previous.startsExpressionBody ? "expression-block" : "statement-block";
      } else if (isToken(previous, "punctuator", "=>")) {
        context = "expression-block";
      }
      braceContexts.push(context);
      tokens.push({
        kind: "punctuator",
        value: char,
        start: offset + index,
        end: offset + index + 1,
      });
      index += 1;
      continue;
    }

    if (char === "}") {
      const context = braceContexts.pop();
      tokens.push({
        kind: "punctuator",
        value: char,
        start: offset + index,
        end: offset + index + 1,
        allowsRegexAfter: context === "statement-block" || undefined,
      });
      index += 1;
      continue;
    }

    const pair = lexicalSource.slice(index, index + 2);
    if (TWO_CHARACTER_PUNCTUATORS.has(pair)) {
      tokens.push({
        kind: "punctuator",
        value: pair,
        start: offset + index,
        end: offset + index + 2,
      });
      index += 2;
      continue;
    }

    tokens.push({
      kind: "punctuator",
      value: char,
      start: offset + index,
      end: offset + index + 1,
    });
    index += 1;
  }

  return tokens;
}

export function isToken(
  token: SourceToken | undefined,
  kind: SourceToken["kind"],
  value: string,
): boolean {
  return token?.kind === kind && token.value === value;
}

export function getStaticModuleSpecifier(token: SourceToken | undefined): string | undefined {
  if (token?.kind === "string") return token.value;
  if (token?.kind === "template") return token.value;
  return undefined;
}
