import { readdirSync } from "node:fs";
import { join } from "node:path";

const REVIEW_FILE_SUFFIX = ".json";

function storedReviewIds(reviewsDir: string): string[] {
  let entries: string[];
  try {
    entries = readdirSync(reviewsDir);
  } catch {
    return [];
  }
  return entries
    .filter((entry) => entry.endsWith(REVIEW_FILE_SUFFIX))
    .map((entry) => entry.slice(0, -REVIEW_FILE_SUFFIX.length));
}

/**
 * Settles review storage's only fire-and-forget work: the migration rewrite
 * `reviews.ts` starts with `void persistMigrationLocked(id)`, serialized behind
 * `withReviewLock`. Chaining an empty operation onto each stored review's lock
 * resolves once that review's pending write has landed, so a fixture can remove its
 * temp home without racing a recreated `triage-reviews/` directory.
 *
 * Call it before the fixture drops DIFFGAZER_HOME.
 */
export async function drainReviewWrites(home: string): Promise<void> {
  const ids = storedReviewIds(join(home, "triage-reviews"));
  if (ids.length === 0) return;

  const { withReviewLock } = await import("../storage/lock.js");
  await Promise.all(ids.map((id) => withReviewLock(id, async () => {})));
}
