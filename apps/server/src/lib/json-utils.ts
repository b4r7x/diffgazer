/**
 * JSON extraction utilities for parsing AI responses
 */

/**
 * Extract JSON from text that may contain markdown code fences or other formatting.
 * Handles cases where AI responses wrap JSON in ```json blocks.
 */
export function extractJson(text: string): string {
  const trimmed = text.trim();

  if (trimmed.startsWith("```")) {
    const firstNewline = trimmed.indexOf("\n");
    if (firstNewline === -1) return trimmed;

    const lastFenceIndex = trimmed.lastIndexOf("\n```");
    if (lastFenceIndex > firstNewline) {
      return trimmed.slice(firstNewline + 1, lastFenceIndex).trim();
    }

    const withoutOpening = trimmed.slice(firstNewline + 1);
    if (withoutOpening.endsWith("```")) {
      return withoutOpening.slice(0, -3).trim();
    }
    return withoutOpening.trim();
  }

  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (jsonMatch?.[0]) {
    return jsonMatch[0];
  }

  return text;
}
