/**
 * Deterministic recovery of a JSON object from model output that failed a bare
 * `JSON.parse`: a markdown fence strip, then a string-aware scan for the
 * largest balanced top-level `{…}`. A candidate either parses as-is or is
 * rejected — no comma/quote repair, which could silently corrupt findings.
 */

const FENCE_PATTERN = /^```[A-Za-z0-9_-]*[ \t]*\r?\n([\s\S]*?)\r?\n?```$/;

function parseObject(text: string): Record<string, unknown> | null {
  try {
    const parsed: unknown = JSON.parse(text);
    return typeof parsed === "object" && parsed !== null && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : null;
  } catch {
    return null;
  }
}

type Span = Readonly<{ start: number; end: number }>;

/**
 * Top-level `{…}` spans. Outside an object every character except `{` is
 * prose and ignored (stray quotes in prose must not flip string state);
 * inside one, braces within JSON strings do not count.
 */
function balancedObjectSpans(text: string): Span[] {
  const spans: Span[] = [];
  let depth = 0;
  let start = 0;
  let inString = false;
  let escaped = false;
  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    if (depth === 0) {
      if (char === "{") {
        depth = 1;
        start = index;
      }
      continue;
    }
    if (inString) {
      if (escaped) escaped = false;
      else if (char === "\\") escaped = true;
      else if (char === '"') inString = false;
      continue;
    }
    if (char === '"') inString = true;
    else if (char === "{") depth += 1;
    else if (char === "}") {
      depth -= 1;
      if (depth === 0) spans.push({ start, end: index + 1 });
    }
  }
  return spans;
}

/** The recovered top-level object, or null when nothing parses without repair. */
export function recoverJsonObject(content: string): Record<string, unknown> | null {
  const trimmed = content.trim();
  const unfenced = FENCE_PATTERN.exec(trimmed)?.[1];
  if (unfenced !== undefined) {
    const parsed = parseObject(unfenced.trim());
    if (parsed) return parsed;
  }
  const haystack = unfenced ?? trimmed;
  const spans = balancedObjectSpans(haystack).sort((a, b) => b.end - b.start - (a.end - a.start));
  for (const span of spans) {
    const parsed = parseObject(haystack.slice(span.start, span.end));
    if (parsed) return parsed;
  }
  return null;
}
