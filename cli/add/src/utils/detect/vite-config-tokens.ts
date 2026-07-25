type ConfigTokenKind = "identifier" | "string" | "punctuator" | "other";

export interface ConfigToken {
  kind: ConfigTokenKind;
  value: string;
}

export interface TokenRange {
  start: number;
  end: number;
}

const IDENTIFIER_START_RE = /[A-Za-z_$]/;
const IDENTIFIER_PART_RE = /[A-Za-z0-9_$]/;
const REGEX_PREFIXES = new Set(["(", "[", "{", ",", ":", "=", "!", "?", ";", "=>"]);
export const TOKEN_PAIRS: Readonly<Record<string, string>> = { "(": ")", "[": "]", "{": "}" };

function canStartRegex(previous: ConfigToken | undefined): boolean {
  if (!previous) return true;
  if (previous.kind === "punctuator") return REGEX_PREFIXES.has(previous.value);
  return previous.kind === "identifier" && ["case", "return", "throw"].includes(previous.value);
}

export function tokenizeViteConfig(source: string): ConfigToken[] {
  const tokens: ConfigToken[] = [];
  let index = 0;

  while (index < source.length) {
    const character = source[index];
    const next = source[index + 1];

    if (character === undefined || /\s/.test(character)) {
      index += 1;
      continue;
    }

    if (character === "/" && next === "/") {
      index += 2;
      while (index < source.length && source[index] !== "\n") index += 1;
      continue;
    }

    if (character === "/" && next === "*") {
      index += 2;
      while (index < source.length && !(source[index] === "*" && source[index + 1] === "/")) {
        index += 1;
      }
      index = Math.min(index + 2, source.length);
      continue;
    }

    if (character === '"' || character === "'") {
      const quote = character;
      let value = "";
      index += 1;
      while (index < source.length) {
        const current = source[index];
        if (current === undefined) break;
        if (current === "\\") {
          const escaped = source[index + 1];
          if (escaped !== undefined) value += escaped;
          index += 2;
          continue;
        }
        if (current === quote) {
          index += 1;
          break;
        }
        value += current;
        index += 1;
      }
      tokens.push({ kind: "string", value });
      continue;
    }

    if (character === "`") {
      index += 1;
      while (index < source.length) {
        if (source[index] === "\\") {
          index += 2;
          continue;
        }
        if (source[index] === "`") {
          index += 1;
          break;
        }
        index += 1;
      }
      tokens.push({ kind: "other", value: "template" });
      continue;
    }

    if (character === "/" && canStartRegex(tokens.at(-1))) {
      let inCharacterClass = false;
      index += 1;
      while (index < source.length) {
        const current = source[index];
        if (current === "\\") {
          index += 2;
          continue;
        }
        if (current === "[") inCharacterClass = true;
        if (current === "]") inCharacterClass = false;
        index += 1;
        if (current === "/" && !inCharacterClass) break;
      }
      while (index < source.length && /[A-Za-z]/.test(source[index] ?? "")) index += 1;
      tokens.push({ kind: "other", value: "regex" });
      continue;
    }

    if (IDENTIFIER_START_RE.test(character)) {
      const start = index;
      index += 1;
      while (index < source.length && IDENTIFIER_PART_RE.test(source[index] ?? "")) index += 1;
      tokens.push({ kind: "identifier", value: source.slice(start, index) });
      continue;
    }

    if (character === "=" && next === ">") {
      tokens.push({ kind: "punctuator", value: "=>" });
      index += 2;
      continue;
    }

    tokens.push({ kind: "punctuator", value: character });
    index += 1;
  }

  return tokens;
}

export function findMatchingToken(
  tokens: ConfigToken[],
  start: number,
  open: string,
  close: string,
): number | null {
  if (tokens[start]?.value !== open) return null;
  let depth = 0;
  for (let index = start; index < tokens.length; index += 1) {
    const value = tokens[index]?.value;
    if (value === open) depth += 1;
    if (value !== close) continue;
    depth -= 1;
    if (depth === 0) return index;
  }
  return null;
}

export function findExpressionEnd(tokens: ConfigToken[], start: number, limit: number): number {
  const closingTokens: string[] = [];

  for (let index = start; index < limit; index += 1) {
    const value = tokens[index]?.value;
    if (value === undefined) return index;
    const close = TOKEN_PAIRS[value];
    if (close) {
      closingTokens.push(close);
      continue;
    }
    if (closingTokens.at(-1) === value) {
      closingTokens.pop();
      continue;
    }
    if (closingTokens.length === 0 && (value === "," || value === ";")) return index;
  }
  return limit;
}

export function objectEntries(
  tokens: ConfigToken[],
  objectStart: number,
): Array<{ key: string; value: TokenRange }> | null {
  const objectEnd = findMatchingToken(tokens, objectStart, "{", "}");
  if (objectEnd === null) return null;
  const entries: Array<{ key: string; value: TokenRange }> = [];
  const keys = new Set<string>();
  let index = objectStart + 1;

  while (index < objectEnd) {
    if (tokens[index]?.value === ",") {
      index += 1;
      continue;
    }

    const key = tokens[index];
    const separator = tokens[index + 1]?.value;
    if ((key?.kind === "identifier" || key?.kind === "string") && separator === ":") {
      if (keys.has(key.value)) return null;
      const start = index + 2;
      const end = findExpressionEnd(tokens, start, objectEnd);
      if (start === end) return null;
      keys.add(key.value);
      entries.push({ key: key.value, value: { start, end } });
      index = end;
      continue;
    }

    if (key?.kind === "identifier" && (separator === "," || index + 1 === objectEnd)) {
      if (keys.has(key.value)) return null;
      keys.add(key.value);
      entries.push({ key: key.value, value: { start: index, end: index + 1 } });
      index += 1;
      continue;
    }

    return null;
  }

  return entries;
}

export function findVariableInitializer(
  tokens: ConfigToken[],
  name: string,
  before: number,
  useAt: number,
): TokenRange | null {
  let found: TokenRange | null = null;
  const closingTokens: string[] = [];

  for (let index = 0; index + 3 < before; index += 1) {
    const value = tokens[index]?.value;
    if (closingTokens.at(-1) === value) {
      closingTokens.pop();
      continue;
    }
    const close = value ? TOKEN_PAIRS[value] : undefined;
    if (close) {
      closingTokens.push(close);
      continue;
    }
    if (closingTokens.length > 0) continue;
    if (tokens[index]?.value !== "const") continue;
    if (tokens[index + 1]?.value !== name || tokens[index + 2]?.value !== "=") continue;
    const start = index + 3;
    found = { start, end: findExpressionEnd(tokens, start, before) };
  }
  return found && hasNoBindingUse(tokens, name, found.end + 1, useAt) ? found : null;
}

function hasNoBindingUse(
  tokens: ConfigToken[],
  name: string,
  after: number,
  before: number,
): boolean {
  for (let index = after; index < before; index += 1) {
    if (tokens[index]?.value === "function") {
      let bodyStart = index + 1;
      while (bodyStart < before && tokens[bodyStart]?.value !== "{") bodyStart += 1;
      const bodyEnd = findMatchingToken(tokens, bodyStart, "{", "}");
      if (bodyEnd !== null) index = bodyEnd;
      continue;
    }
    if (tokens[index]?.value === "=>") {
      const bodyStart = index + 1;
      const opening = tokens[bodyStart]?.value;
      const closing = opening ? TOKEN_PAIRS[opening] : undefined;
      const bodyEnd =
        opening && closing ? findMatchingToken(tokens, bodyStart, opening, closing) : null;
      if (bodyEnd !== null) index = bodyEnd;
      continue;
    }
    if (tokens[index]?.kind !== "identifier" || tokens[index]?.value !== name) continue;
    if (tokens[index + 1]?.value === ":") continue;
    return false;
  }
  return true;
}

export function findTopLevelToken(
  tokens: ConfigToken[],
  range: TokenRange,
  expected: string,
): number | null {
  const closingTokens: string[] = [];
  for (let index = range.start; index < range.end; index += 1) {
    const value = tokens[index]?.value;
    if (value === expected && closingTokens.length === 0) return index;
    const close = value ? TOKEN_PAIRS[value] : undefined;
    if (close) closingTokens.push(close);
    else if (closingTokens.at(-1) === value) closingTokens.pop();
  }
  return null;
}

export function unwrapParenthesizedRange(tokens: ConfigToken[], range: TokenRange): TokenRange {
  let { start, end } = range;
  while (tokens[start]?.value === "(" && findMatchingToken(tokens, start, "(", ")") === end - 1) {
    start += 1;
    end -= 1;
  }
  return { start, end };
}

export function rangeMatches(tokens: ConfigToken[], range: TokenRange, values: string[]): boolean {
  if (range.end - range.start !== values.length) return false;
  return values.every((value, index) => tokens[range.start + index]?.value === value);
}

export function callArguments(
  tokens: ConfigToken[],
  openParenthesis: number,
  expressionEnd: number,
): TokenRange[] | null {
  const closeParenthesis = findMatchingToken(tokens, openParenthesis, "(", ")");
  if (closeParenthesis === null || closeParenthesis !== expressionEnd - 1) return null;
  if (closeParenthesis === openParenthesis + 1) return [];

  const argumentsList: TokenRange[] = [];
  let start = openParenthesis + 1;
  while (start < closeParenthesis) {
    const end = findExpressionEnd(tokens, start, closeParenthesis);
    if (end === start) return null;
    argumentsList.push({ start, end });
    if (end === closeParenthesis) return argumentsList;
    start = end + 1;
    if (start === closeParenthesis) return null;
  }
  return null;
}

export function arrayElementRanges(tokens: ConfigToken[], arrayStart: number): TokenRange[] | null {
  const arrayEnd = findMatchingToken(tokens, arrayStart, "[", "]");
  if (arrayEnd === null) return null;
  const elements: TokenRange[] = [];
  let index = arrayStart + 1;

  while (index < arrayEnd) {
    if (tokens[index]?.value === ",") {
      index += 1;
      continue;
    }
    const end = findExpressionEnd(tokens, index, arrayEnd);
    if (end === index || (end < arrayEnd && tokens[end]?.value !== ",")) return null;
    elements.push({ start: index, end });
    index = end + 1;
  }

  return elements;
}
