import { formatRunId } from "../format.js";
import {
  buildCategoryStats,
  buildDuplicateCollapseNotice,
  buildLensSummaryRows,
  buildReviewSummary,
  type LensSummaryRow,
} from "../review/build-summary.js";
import { toIssueDetailsPresentation } from "../review/presentation.js";
import { SEVERITY_LABELS, SEVERITY_ORDER } from "../schemas/presentation/index.js";
import type { ReviewSeverity, SavedReview } from "../schemas/review/index.js";
import { makeIssue } from "./factories.js";

export const canonicalReviewFixture: SavedReview = {
  metadata: {
    id: "c0ffee00-1234-4567-89ab-cdef01234567",
    projectPath: "/workspace/diffgazer-workspace",
    createdAt: "2026-07-18T10:33:48.000Z",
    mode: "unstaged",
    branch: "feature/mobile-tui-parity",
    profile: "strict",
    lenses: ["correctness", "security", "performance", "simplicity", "tests"],
    issueCount: 8,
    blockerCount: 1,
    highCount: 2,
    mediumCount: 2,
    lowCount: 2,
    nitCount: 1,
    fileCount: 23,
    durationMs: 42_780,
  },
  result: {
    issues: [
      makeIssue({
        id: "fixture-blocker-session-auth",
        severity: "blocker",
        category: "security",
        title: "Session tokens remain valid after account revocation",
        file: "cli/server/src/features/authentication/services/session-revocation-service.ts",
        line_start: 184,
        line_end: 211,
      }),
      makeIssue({
        id: "fixture-high-review-persistence",
        severity: "high",
        category: "correctness",
        title: "Concurrent review writes can replace newer persisted results",
        file: "cli/server/src/features/review/storage/persistence/write-saved-review.ts",
        line_start: 97,
        line_end: 132,
      }),
      makeIssue({
        id: "fixture-high-provider-key",
        severity: "high",
        category: "security",
        title: "Provider key errors expose unsanitized terminal control sequences",
        file: "cli/diffgazer/src/features/providers/components/api-key-overlay.tsx",
        line_start: 143,
        line_end: 149,
      }),
      makeIssue({
        id: "fixture-medium-results-window",
        severity: "medium",
        category: "performance",
        title: "Results navigation recomputes the complete issue collection on every keypress",
        file: "apps/web/src/features/review/hooks/use-review-results-keyboard.ts",
        line_start: 218,
        line_end: 246,
      }),
      makeIssue({
        id: "fixture-medium-history-cursor",
        severity: "medium",
        category: "correctness",
        title: "History pagination skips the first review after a stale cursor",
        file: "libs/core/src/review/history/paginated-review-history.ts",
        line_start: 76,
        line_end: 101,
      }),
      makeIssue({
        id: "fixture-low-mobile-dialog",
        severity: "low",
        category: "tests",
        title: "Mobile dialog focus restoration has no behavior-level regression coverage",
        file: "libs/ui/registry/ui/dialog/tests/dialog-focus-restoration.integration.test.tsx",
        line_start: 58,
        line_end: 88,
      }),
      makeIssue({
        id: "fixture-low-settings-zones",
        severity: "low",
        category: "readability",
        title: "Settings zone transitions duplicate boundary-navigation decisions",
        file: "cli/diffgazer/src/features/settings/hooks/use-settings-zone.ts",
        line_start: 41,
        line_end: 67,
      }),
      makeIssue({
        id: "fixture-nit-registry-copy",
        severity: "nit",
        category: "style",
        title: "Registry validation output uses inconsistent item-count wording",
        file: "libs/registry/src/validation/public-registry-contract.ts",
        line_start: 119,
        line_end: null,
      }),
    ],
  },
  gitContext: {
    branch: "feature/mobile-tui-parity",
    commit: "7e6c4c83f9b8b6a91782150b22428f1a71cfed42",
    fileCount: 23,
    additions: 1_482,
    deletions: 391,
  },
  lensStats: [
    { lensId: "correctness", issueCount: 2, status: "success" },
    { lensId: "security", issueCount: 2, status: "success" },
    { lensId: "performance", issueCount: 1, status: "success" },
    { lensId: "simplicity", issueCount: 2, status: "success" },
    { lensId: "tests", issueCount: 1, status: "success" },
  ],
  droppedDuplicates: 3,
};

export interface ReviewSeverityFact {
  severity: ReviewSeverity;
  label: string;
  count: number;
}

export interface ReviewCategoryFact {
  id: string;
  label: string;
  count: number;
}

export interface ReviewFacts {
  runId: string;
  severityCounts: ReviewSeverityFact[];
  issueTitles: string[];
  issueLocations: string[];
  categoryRows: ReviewCategoryFact[];
  lensRows: LensSummaryRow[];
  duplicateCollapseNotice: string | null;
}

export function reviewFacts(fixture: SavedReview): ReviewFacts {
  const issues = fixture.result.issues;
  const summary = buildReviewSummary(issues);

  return {
    runId: formatRunId(fixture.metadata.id),
    severityCounts: SEVERITY_ORDER.map((severity) => ({
      severity,
      label: SEVERITY_LABELS[severity],
      count: summary.severityCounts[severity],
    })),
    issueTitles: issues.map((issue) => issue.title),
    issueLocations: issues.map((issue) => toIssueDetailsPresentation(issue).location),
    categoryRows: buildCategoryStats(issues).map((row) => ({
      id: row.id,
      label: row.name,
      count: row.count,
    })),
    lensRows: buildLensSummaryRows(fixture.lensStats),
    duplicateCollapseNotice: buildDuplicateCollapseNotice(fixture.droppedDuplicates, issues.length),
  };
}
