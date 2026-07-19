import { describe, expect, it } from "vitest";
import { SavedReviewSchema } from "../schemas/review/index.js";
import { canonicalReviewFixture, reviewFacts } from "./review-facts.js";

describe("canonical review facts", () => {
  it("provides one valid, realistic cross-surface review fixture", () => {
    expect(() => SavedReviewSchema.parse(canonicalReviewFixture)).not.toThrow();
    expect(canonicalReviewFixture.result.issues).toHaveLength(8);
    expect(new Set(canonicalReviewFixture.result.issues.map((issue) => issue.severity))).toEqual(
      new Set(["blocker", "high", "medium", "low", "nit"]),
    );
    expect(canonicalReviewFixture.result.issues.every((issue) => issue.file.length > 50)).toBe(
      true,
    );
    expect(canonicalReviewFixture.lensStats).toHaveLength(5);
    expect(canonicalReviewFixture.droppedDuplicates).toBe(3);
  });

  it("derives every parity fact through shared presentation contracts", () => {
    expect(reviewFacts(canonicalReviewFixture)).toEqual({
      runId: "#c0ffee00",
      severityCounts: [
        { severity: "blocker", label: "BLOCKER", count: 1 },
        { severity: "high", label: "HIGH", count: 2 },
        { severity: "medium", label: "MED", count: 2 },
        { severity: "low", label: "LOW", count: 2 },
        { severity: "nit", label: "NIT", count: 1 },
      ],
      issueTitles: [
        "Session tokens remain valid after account revocation",
        "Concurrent review writes can replace newer persisted results",
        "Provider key errors expose unsanitized terminal control sequences",
        "Results navigation recomputes the complete issue collection on every keypress",
        "History pagination skips the first review after a stale cursor",
        "Mobile dialog focus restoration has no behavior-level regression coverage",
        "Settings zone transitions duplicate boundary-navigation decisions",
        "Registry validation output uses inconsistent item-count wording",
      ],
      issueLocations: [
        "cli/server/src/features/authentication/services/session-revocation-service.ts:184-211",
        "cli/server/src/features/review/storage/persistence/write-saved-review.ts:97-132",
        "cli/diffgazer/src/features/providers/components/api-key-overlay.tsx:143-149",
        "apps/web/src/features/review/hooks/use-review-results-keyboard.ts:218-246",
        "libs/core/src/review/history/paginated-review-history.ts:76-101",
        "libs/ui/registry/ui/dialog/tests/dialog-focus-restoration.integration.test.tsx:58-88",
        "cli/diffgazer/src/features/settings/hooks/use-settings-zone.ts:41-67",
        "libs/registry/src/validation/public-registry-contract.ts:119",
      ],
      categoryRows: [
        { id: "security", label: "Security", count: 2 },
        { id: "correctness", label: "Correctness", count: 2 },
        { id: "performance", label: "Performance", count: 1 },
        { id: "tests", label: "Tests", count: 1 },
        { id: "readability", label: "Readability", count: 1 },
        { id: "style", label: "Style", count: 1 },
      ],
      lensRows: [
        { lensId: "correctness", label: "Correctness", issueCount: 2, status: "success" },
        { lensId: "security", label: "Security", issueCount: 2, status: "success" },
        { lensId: "performance", label: "Performance", issueCount: 1, status: "success" },
        { lensId: "simplicity", label: "Simplicity", issueCount: 2, status: "success" },
        { lensId: "tests", label: "Tests", issueCount: 1, status: "success" },
      ],
      duplicateCollapseNotice: "3 duplicate issues collapsed across lenses (11 → 8 issues)",
    });
  });
});
