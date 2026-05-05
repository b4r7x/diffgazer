import { z } from "zod";
import { REVIEW_SEVERITY, ReviewSeveritySchema, type ReviewSeverity } from "../review/issues.js";
import { LIFECYCLE_STATUSES } from "../shared/statuses.js";

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
export const HISTOGRAM_SEVERITIES = ["blocker", "high", "medium", "low"] as const;

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

/**
 * Shallow equality check for two shortcut arrays.
 */
export function areShortcutsEqual(a: Shortcut[], b: Shortcut[]): boolean {
  if (a === b) return true;
  if (a.length !== b.length) return false;

  for (let i = 0; i < a.length; i++) {
    const left = a[i]!;
    const right = b[i]!;
    if (left.key !== right.key || left.label !== right.label || left.disabled !== right.disabled) {
      return false;
    }
  }

  return true;
}

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

/** Canonical badge variant values. @see libs/ui/registry/ui/badge/badge.tsx for the component-library copy. */
const BADGE_VARIANTS = ["success", "warning", "error", "info", "neutral"] as const;
export const BadgeVariantSchema = z.enum(BADGE_VARIANTS);
export type BadgeVariant = z.infer<typeof BadgeVariantSchema>;

export const TAG_BADGE_VARIANTS: Record<string, BadgeVariant> = {
  system: "neutral",
  agent: "info",
  tool: "info",
  lens: "info",
  warning: "warning",
  error: "error",
  thinking: "neutral",
};

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
  status: z.enum(LIFECYCLE_STATUSES),
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

/** @see libs/ui/registry/ui/toast/toast-variants.ts ToastVariant (superset with "loading", used for component-library styling) */
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
// Navigation Types & Constants (shared between CLI and Web)
// ============================================================================

export type MenuAction =
  | "review-unstaged"
  | "review-staged"
  | "review-files"
  | "resume-review"
  | "history"
  | "settings"
  | "help"
  | "quit";

export type SettingsAction =
  | "trust"
  | "theme"
  | "provider"
  | "storage"
  | "agent-execution"
  | "analysis"
  | "diagnostics";

export interface NavItem {
  id: MenuAction;
  label: string;
  shortcut?: string;
  variant?: "default" | "danger";
  group: "review" | "navigation" | "system";
}

export interface SettingsMenuItem {
  id: SettingsAction;
  label: string;
  description: string;
}

export const MENU_ITEMS: NavItem[] = [
  { id: "review-unstaged", label: "Review Unstaged", shortcut: "r", group: "review" },
  { id: "review-staged", label: "Review Staged", shortcut: "R", group: "review" },
  { id: "resume-review", label: "Resume Last Review", shortcut: "l", group: "review" },
  { id: "history", label: "History", shortcut: "h", group: "navigation" },
  { id: "settings", label: "Settings", shortcut: "s", group: "navigation" },
  { id: "help", label: "Help", shortcut: "?", group: "system" },
  { id: "quit", label: "Quit", shortcut: "q", variant: "danger", group: "system" },
];

export const SETTINGS_MENU_ITEMS: SettingsMenuItem[] = [
  { id: "trust", label: "Trust & Permissions", description: "Manage directory trust and capabilities" },
  { id: "theme", label: "Theme", description: "Change color theme preferences" },
  { id: "provider", label: "Provider", description: "Select AI provider for code review" },
  { id: "storage", label: "Secrets Storage", description: "Choose where API keys are stored" },
  { id: "agent-execution", label: "Agent Execution", description: "Control how analysis agents are scheduled" },
  { id: "analysis", label: "Analysis", description: "Configure agents and context depth" },
  { id: "diagnostics", label: "Diagnostics", description: "Run system health checks" },
];
