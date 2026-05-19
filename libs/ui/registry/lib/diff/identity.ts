import type { ParsedDiff } from "./parse.js";

export function parsedDiffIdentity(parsed: ParsedDiff): string {
  const hunks = parsed.hunks
    .map(
      (h) =>
        `${h.oldStart},${h.oldCount},${h.newStart},${h.newCount},${h.changes.length},${h.heading}`,
    )
    .join(";");
  return `${parsed.oldPath ?? ""}\x00${parsed.newPath ?? ""}\x00${parsed.hunks.length}\x00${hunks}`;
}
