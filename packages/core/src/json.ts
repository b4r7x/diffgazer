import type { Result } from "./result.js";
import { ok, err } from "./result.js";

export function safeParseJson<E>(
  content: string,
  errorFactory: (message: string, details?: string) => E
): Result<unknown, E> {
  try {
    return ok(JSON.parse(content));
  } catch (error) {
    const details = error instanceof Error ? error.message : undefined;
    return err(errorFactory("Invalid JSON", details));
  }
}

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
