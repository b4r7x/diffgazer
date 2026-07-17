export function findQuotedLiteralEnd(
  source: string,
  start: number,
  quote: '"' | "'" | "`",
): number {
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

export function isIdentifierStart(char: string): boolean {
  return /[A-Z_a-z$]/.test(char);
}

export function isIdentifierPart(char: string): boolean {
  return /[\w$]/.test(char);
}
