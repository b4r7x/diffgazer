export function encodeDomIdSegment(value: string): string {
  const segments: string[] = [];
  for (const char of value) {
    const codePoint = char.codePointAt(0);
    if (codePoint !== undefined) segments.push(codePoint.toString(36));
  }
  return segments.join("-");
}
