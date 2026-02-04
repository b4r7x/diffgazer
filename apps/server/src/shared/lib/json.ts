import type { Result } from "./result.js";
import { ok, err } from "./result.js";

const stripMarkdownCodeBlock = (content: string): string => {
  let cleaned = content.trim();

  if (cleaned.startsWith("```json")) {
    cleaned = cleaned.slice(7);
  } else if (cleaned.startsWith("```")) {
    cleaned = cleaned.slice(3);
  }

  if (cleaned.endsWith("```")) {
    cleaned = cleaned.slice(0, -3);
  }

  return cleaned.trim();
};

export const safeParseJson = <E = undefined>(
  content: string,
  errorFactory: (message: string, details?: string) => E
): Result<unknown, E> => {
  const cleaned = stripMarkdownCodeBlock(content);

  try {
    return ok(JSON.parse(cleaned));
  } catch (error) {
    const details = error instanceof Error ? error.message : undefined;
    return err(errorFactory("Invalid JSON", details));
  }
};
