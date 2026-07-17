import { findQuotedLiteralEnd, isIdentifierStart } from "./source-lexical-utils.js";

interface JsxTag {
  name: string;
  end: number;
  closing: boolean;
  selfClosing: boolean;
}

function parseJsxTag(source: string, start: number): JsxTag | undefined {
  if (source[start] !== "<") return undefined;
  let index = start + 1;
  const closing = source[index] === "/";
  if (closing) index += 1;

  let name = "";
  if (source[index] !== ">") {
    const first = source[index];
    if (first === undefined || !isIdentifierStart(first)) return undefined;
    const nameStart = index;
    index += 1;
    while (index < source.length && /[-.:\w$]/.test(source[index] ?? "")) index += 1;
    name = source.slice(nameStart, index);
  }

  let braceDepth = 0;
  while (index < source.length) {
    const char = source[index];
    if (char === undefined) return undefined;
    if (char === '"' || char === "'" || char === "`") {
      index = findQuotedLiteralEnd(source, index, char);
      continue;
    }
    if (char === "{") braceDepth += 1;
    if (char === "}") braceDepth = Math.max(0, braceDepth - 1);
    if (char === ">" && braceDepth === 0) {
      const header = source.slice(start, index);
      return {
        name,
        end: index + 1,
        closing,
        selfClosing: !closing && /\/\s*$/.test(header),
      };
    }
    index += 1;
  }
  return undefined;
}

export function findJsxExpressionEnd(source: string, start: number): number {
  let depth = 1;
  let index = start + 1;
  while (index < source.length) {
    const char = source[index];
    const next = source[index + 1];
    if (char === undefined) return source.length;
    if (char === '"' || char === "'" || char === "`") {
      index = findQuotedLiteralEnd(source, index, char);
      continue;
    }
    if (char === "/" && next === "/") {
      index += 2;
      while (index < source.length && source[index] !== "\n" && source[index] !== "\r") index += 1;
      continue;
    }
    if (char === "/" && next === "*") {
      const close = source.indexOf("*/", index + 2);
      index = close === -1 ? source.length : close + 2;
      continue;
    }
    if (char === "{") depth += 1;
    if (char === "}") {
      depth -= 1;
      if (depth === 0) return index + 1;
    }
    index += 1;
  }
  return source.length;
}

function maskJsxElement(source: string, output: string[], opening: JsxTag): number {
  const tagStack = [opening.name];
  let index = opening.end;

  while (index < source.length && tagStack.length > 0) {
    const char = source[index];
    if (char === "{") {
      const end = findJsxExpressionEnd(source, index);
      const expression = source.slice(index + 1, Math.max(index + 1, end - 1));
      const maskedExpression = maskJsxRawText(expression);
      for (let offset = 0; offset < maskedExpression.length; offset += 1) {
        output[index + 1 + offset] = maskedExpression[offset] ?? " ";
      }
      index = end;
      continue;
    }

    if (char === "<") {
      const tag = parseJsxTag(source, index);
      if (tag) {
        if (tag.closing) {
          if (tag.name === tagStack.at(-1)) tagStack.pop();
        } else if (!tag.selfClosing) {
          tagStack.push(tag.name);
        }
        index = tag.end;
        continue;
      }
    }

    if (char !== "\n" && char !== "\r") output[index] = " ";
    index += 1;
  }

  return index;
}

export function maskJsxRawText(source: string): string {
  const output = [...source];
  let index = 0;

  while (index < source.length) {
    const char = source[index];
    const next = source[index + 1];
    if (char === '"' || char === "'" || char === "`") {
      index = findQuotedLiteralEnd(source, index, char);
      continue;
    }
    if (char === "/" && next === "/") {
      index += 2;
      while (index < source.length && source[index] !== "\n" && source[index] !== "\r") index += 1;
      continue;
    }
    if (char === "/" && next === "*") {
      const close = source.indexOf("*/", index + 2);
      index = close === -1 ? source.length : close + 2;
      continue;
    }
    if (char === "<") {
      const tag = parseJsxTag(source, index);
      if (tag && !tag.closing) {
        if (tag.selfClosing) {
          index = tag.end;
          continue;
        }
        const closingTag = tag.name === "" ? "</>" : `</${tag.name}`;
        if (source.indexOf(closingTag, tag.end) !== -1) {
          index = maskJsxElement(source, output, tag);
          continue;
        }
      }
    }
    index += 1;
  }

  return output.join("");
}
