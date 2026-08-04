import type { Result } from "./result.js";
import { err, ok } from "./result.js";

export {
  type JsonScanFailure,
  type JsonScanLimits,
  scanJsonRejectingDuplicateKeys,
} from "./schemas/canonical-json.js";

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

export function safeParseJson(content: string): Result<unknown, string> {
  const cleaned = stripMarkdownCodeBlock(content);

  try {
    return ok(JSON.parse(cleaned));
  } catch (error) {
    const details = error instanceof Error ? error.message : null;
    return err(details ? `Invalid JSON: ${details}` : "Invalid JSON");
  }
}
