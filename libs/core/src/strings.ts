export function capitalize(str: string): string {
  if (str.length === 0) return str;
  return str.charAt(0).toUpperCase() + str.slice(1);
}

const graphemeSegmenter = new Intl.Segmenter(undefined, { granularity: "grapheme" });

function toGraphemes(value: string): string[] {
  return Array.from(graphemeSegmenter.segment(value), (segment) => segment.segment);
}

/**
 * Truncates by grapheme cluster, so a cut never splits an astral character into
 * unpaired surrogates or separates a combining mark from its base.
 */
export function truncate(str: string, maxLength: number, suffix = "..."): string {
  if (str.length <= maxLength) return str;

  const graphemes = toGraphemes(str);
  if (graphemes.length <= maxLength) return str;

  const suffixGraphemes = toGraphemes(suffix);
  if (maxLength <= suffixGraphemes.length) return suffixGraphemes.slice(0, maxLength).join("");
  return graphemes.slice(0, maxLength - suffixGraphemes.length).join("") + suffix;
}

export function pluralize(count: number, word: string, plural = `${word}s`): string {
  return `${count} ${count === 1 ? word : plural}`;
}
