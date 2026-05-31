import type { Result } from "./result.js";
import { ok, err } from "./result.js";

function stripMarkdownCodeBlock(content: string): string {
  let cleaned = content.trim();

  // Strip an opening ``` fence with any optional language tag (json, ts, js, …).
  const openingFence = /^```[a-zA-Z0-9_-]*\s*\n?/;
  cleaned = cleaned.replace(openingFence, "");

  if (cleaned.endsWith("```")) {
    cleaned = cleaned.slice(0, -3);
  }

  return cleaned.trim();
}

export function safeParseJson<E = undefined>(
  content: string,
  errorFactory: (message: string, details?: string) => E
): Result<unknown, E> {
  const cleaned = stripMarkdownCodeBlock(content);

  try {
    return ok(JSON.parse(cleaned));
  } catch (error) {
    const details = error instanceof Error ? error.message : undefined;
    return err(errorFactory("Invalid JSON", details));
  }
}
