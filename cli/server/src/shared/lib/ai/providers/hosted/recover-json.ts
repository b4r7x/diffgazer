/**
 * Deterministic recovery of JSON objects from model output that failed a bare
 * `JSON.parse`: a markdown fence strip, then a string-aware scan for balanced
 * `{…}` spans — the largest top-level one for the whole answer, the outermost
 * ones anywhere for per-issue salvage. A candidate either parses as-is or is
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

/** `depth` is the nesting level the object closed at: 0 is a top-level object. */
type Span = Readonly<{ start: number; end: number; depth: number }>;

/**
 * Every balanced `{…}` span, at any nesting level. Outside an object every
 * character except `{` is prose and ignored (stray quotes in prose must not
 * flip string state); inside one, braces within JSON strings do not count.
 */
function balancedObjectSpans(text: string): Span[] {
  const spans: Span[] = [];
  const starts: number[] = [];
  let inString = false;
  let escaped = false;
  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    if (starts.length === 0) {
      if (char === "{") starts.push(index);
      continue;
    }
    if (inString) {
      if (escaped) escaped = false;
      else if (char === "\\") escaped = true;
      else if (char === '"') inString = false;
      continue;
    }
    if (char === '"') inString = true;
    else if (char === "{") starts.push(index);
    else if (char === "}") {
      const start = starts.pop();
      if (start !== undefined) spans.push({ start, end: index + 1, depth: starts.length });
    }
  }
  return spans;
}

function unfencedText(content: string): string {
  const trimmed = content.trim();
  return FENCE_PATTERN.exec(trimmed)?.[1]?.trim() ?? trimmed;
}

/** The recovered top-level object, or null when nothing parses without repair. */
export function recoverJsonObject(content: string): Record<string, unknown> | null {
  const haystack = unfencedText(content);
  const direct = parseObject(haystack);
  if (direct) return direct;
  const spans = balancedObjectSpans(haystack)
    .filter((span) => span.depth === 0)
    .sort((a, b) => b.end - b.start - (a.end - a.start));
  for (const span of spans) {
    const parsed = parseObject(haystack.slice(span.start, span.end));
    if (parsed) return parsed;
  }
  return null;
}

/**
 * The outermost objects that parse, in document order — including objects
 * nested inside a top-level object the model never closed, which is the only
 * thing left of a truncated answer. Contained spans are skipped, so an object
 * inside a kept one is never emitted a second time on its own.
 */
export function recoverJsonObjects(content: string): Record<string, unknown>[] {
  const haystack = unfencedText(content);
  const spans = balancedObjectSpans(haystack).sort((a, b) => a.start - b.start);
  const objects: Record<string, unknown>[] = [];
  let keptEnd = 0;
  for (const span of spans) {
    if (span.start < keptEnd) continue;
    const parsed = parseObject(haystack.slice(span.start, span.end));
    if (!parsed) continue;
    objects.push(parsed);
    keptEnd = span.end;
  }
  return objects;
}
