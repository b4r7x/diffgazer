import { z } from "zod";
import { REVIEW_SEVERITY, ReviewSeveritySchema, type ReviewSeverity } from "../review/issues.js";

// ============================================================================
// Severity Display Constants
// ============================================================================

/**
 * Canonical order of severity levels from most to least severe.
 * Re-exported from review.ts to avoid duplication.
 */
export { REVIEW_SEVERITY as SEVERITY_ORDER };

/**
 * Severity levels to display in histograms (excludes 'nit').
 */
export const HISTOGRAM_SEVERITIES = REVIEW_SEVERITY.filter((s) => s !== "nit");

/**
 * Get numeric rank of a severity level (lower = more severe).
 */
export const severityRank = (severity: ReviewSeverity): number =>
  REVIEW_SEVERITY.indexOf(severity);

/**
 * Display labels for severity levels.
 */
export const SEVERITY_LABELS: Record<ReviewSeverity, string> = {
  blocker: "BLOCKER",
  high: "HIGH",
  medium: "MED",
  low: "LOW",
  nit: "NIT",
};

/**
 * Icons for severity levels.
 */
export const SEVERITY_ICONS: Record<ReviewSeverity, string> = {
  blocker: "X",
  high: "!",
  medium: "-",
  low: ".",
  nit: "~",
};

/**
 * Terminal colors for severity levels (for CLI/Ink).
 */
export const SEVERITY_COLORS: Record<ReviewSeverity, string> = {
  blocker: "red",
  high: "magenta",
  medium: "yellow",
  low: "blue",
  nit: "gray",
};

// ============================================================================
// Severity Filter (UI-specific, distinct from review SeverityFilter)
// ============================================================================

export type UISeverityFilter = ReviewSeverity | "all";

// ============================================================================
// Shortcuts
// ============================================================================

const ShortcutSchema = z.object({
  key: z.string(),
  label: z.string(),
  disabled: z.boolean().optional(),
});
export type Shortcut = z.infer<typeof ShortcutSchema>;

// ============================================================================
// Lens Stats
// ============================================================================

const LensStatsSchema = z.object({
  id: z.string(),
  name: z.string(),
  icon: z.string(),
  iconColor: z.string().optional(),
  count: z.number(),
  change: z.number(),
});
export type LensStats = z.infer<typeof LensStatsSchema>;

// ============================================================================
// Log Types
// ============================================================================

const LOG_TAG_TYPES = ["system", "tool", "lens", "warning", "error", "agent", "thinking"] as const;
const LogTagTypeSchema = z.enum(LOG_TAG_TYPES);
export type LogTagType = z.infer<typeof LogTagTypeSchema>;

const LogEntryDataSchema = z.object({
  id: z.string(),
  timestamp: z.union([z.date(), z.string()]),
  tag: z.string(),
  tagType: LogTagTypeSchema.optional(),
  message: z.string(),
  isWarning: z.boolean().optional(),
  source: z.string().optional(),
  isError: z.boolean().optional(),
});
export type LogEntryData = z.infer<typeof LogEntryDataSchema>;

// ============================================================================
// Progress Types
// ============================================================================

const PROGRESS_STATUSES = ["completed", "active", "pending"] as const;
const ProgressStatusSchema = z.enum(PROGRESS_STATUSES);
export type ProgressStatus = z.infer<typeof ProgressStatusSchema>;

const ProgressSubstepDataSchema = z.object({
  id: z.string(),
  tag: z.string(),
  label: z.string(),
  status: z.enum(["pending", "active", "completed", "error"]),
  detail: z.string().optional(),
  progress: z.number().min(0).max(100).optional(),
});
export type ProgressSubstepData = z.infer<typeof ProgressSubstepDataSchema>;

const ProgressStepDataSchema = z.object({
  id: z.string(),
  label: z.string(),
  status: ProgressStatusSchema,
  substeps: z.array(ProgressSubstepDataSchema).optional(),
});
export type ProgressStepData = z.infer<typeof ProgressStepDataSchema>;

const ReviewProgressMetricsSchema = z.object({
  filesProcessed: z.number().nonnegative(),
  filesTotal: z.number().nonnegative(),
  issuesFound: z.number().nonnegative(),
  elapsed: z.number().nonnegative(),
});
export type ReviewProgressMetrics = z.infer<typeof ReviewProgressMetricsSchema>;

// ============================================================================
// Analysis Types
// ============================================================================

const AnalysisStatsSchema = z.object({
  runId: z.string(),
  totalIssues: z.number(),
  filesAnalyzed: z.number(),
  criticalCount: z.number(),
});
export type AnalysisStats = z.infer<typeof AnalysisStatsSchema>;

const SeverityCountsSchema = z.object({
  blocker: z.number(),
  high: z.number(),
  medium: z.number(),
  low: z.number(),
  nit: z.number(),
});
export type SeverityCounts = z.infer<typeof SeverityCountsSchema>;

/**
 * Calculate the count of each severity level from a list of issues.
 */
export function calculateSeverityCounts(issues: { severity: ReviewSeverity }[]): SeverityCounts {
  const counts: SeverityCounts = { blocker: 0, high: 0, medium: 0, low: 0, nit: 0 };
  for (const issue of issues) {
    counts[issue.severity]++;
  }
  return counts;
}

const IssuePreviewSchema = z.object({
  id: z.string(),
  title: z.string(),
  file: z.string(),
  line: z.number(),
  category: z.string(),
  severity: ReviewSeveritySchema,
});
export type IssuePreview = z.infer<typeof IssuePreviewSchema>;

// ============================================================================
// Context Info
// ============================================================================

const ContextInfoSchema = z.object({
  trustedDir: z.string().optional(),
  providerName: z.string().optional(),
  providerMode: z.string().optional(),
  lastRunId: z.string().optional(),
  lastRunIssueCount: z.number().optional(),
});
export type ContextInfo = z.infer<typeof ContextInfoSchema>;

// ============================================================================
// Toast Types
// ============================================================================

const TOAST_VARIANTS = ["success", "error", "warning", "info"] as const;
const ToastVariantSchema = z.enum(TOAST_VARIANTS);
export type ToastVariant = z.infer<typeof ToastVariantSchema>;

const ToastItemSchema = z.object({
  id: z.string(),
  message: z.string(),
  variant: ToastVariantSchema.optional(),
  duration: z.number().optional(),
});
export type ToastItem = z.infer<typeof ToastItemSchema>;

// ============================================================================
// Issue Tab Types
// ============================================================================

export const ISSUE_TABS = ["details", "explain", "trace", "patch"] as const;
const IssueTabSchema = z.enum(ISSUE_TABS);
export type IssueTab = z.infer<typeof IssueTabSchema>;

// ============================================================================
// Timeline Types
// ============================================================================

const TimelineItemSchema = z.object({
  id: z.string(),
  label: z.string(),
  count: z.number(),
});
export type TimelineItem = z.infer<typeof TimelineItemSchema>;

// ============================================================================
// Code Snippet Types
// ============================================================================

const CODE_LINE_TYPES = ["normal", "added", "removed", "highlight"] as const;
const CodeLineTypeSchema = z.enum(CODE_LINE_TYPES);

export const CodeLineSchema = z.object({
  number: z.number(),
  content: z.string(),
  type: CodeLineTypeSchema.optional(),
});
export type CodeLine = z.infer<typeof CodeLineSchema>;

// ============================================================================
// Table Types
// ============================================================================

const TableColumnSchema = z.object({
  key: z.string(),
  header: z.string(),
  width: z.union([z.number(), z.string()]).optional(),
});
export type TableColumn = z.infer<typeof TableColumnSchema>;
