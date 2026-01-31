import { z } from "zod";
import { TriageSeveritySchema, type TriageSeverity } from "./triage.js";

// ============================================================================
// Severity Display Constants
// ============================================================================

/**
 * Canonical order of severity levels from most to least severe.
 */
export const SEVERITY_ORDER = ["blocker", "high", "medium", "low", "nit"] as const;

/**
 * Severity levels to display in histograms (excludes 'nit').
 */
export const HISTOGRAM_SEVERITIES = SEVERITY_ORDER.filter((s) => s !== "nit");

/**
 * Display labels for severity levels.
 */
export const SEVERITY_LABELS: Record<TriageSeverity, string> = {
  blocker: "BLOCKER",
  high: "HIGH",
  medium: "MED",
  low: "LOW",
  nit: "NIT",
};

/**
 * Icons for severity levels.
 */
export const SEVERITY_ICONS: Record<TriageSeverity, string> = {
  blocker: "X",
  high: "!",
  medium: "-",
  low: ".",
  nit: "~",
};

/**
 * Terminal colors for severity levels (for CLI/Ink).
 */
export const SEVERITY_COLORS: Record<TriageSeverity, string> = {
  blocker: "red",
  high: "magenta",
  medium: "yellow",
  low: "blue",
  nit: "gray",
};

// ============================================================================
// Severity Filter (UI-specific, distinct from triage SeverityFilter)
// ============================================================================

export type UISeverityFilter = TriageSeverity | "all";

// ============================================================================
// Shortcuts
// ============================================================================

export const ShortcutSchema = z.object({
  key: z.string(),
  label: z.string(),
  disabled: z.boolean().optional(),
});
export type Shortcut = z.infer<typeof ShortcutSchema>;

export const ModeShortcutsSchema = z.object({
  keys: z.array(ShortcutSchema),
  menu: z.array(ShortcutSchema),
});
export type ModeShortcuts = z.infer<typeof ModeShortcutsSchema>;

// ============================================================================
// Lens Stats
// ============================================================================

export const LensStatsSchema = z.object({
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

export const LOG_TAG_TYPES = ["system", "tool", "lens", "warning", "error"] as const;
export const LogTagTypeSchema = z.enum(LOG_TAG_TYPES);
export type LogTagType = z.infer<typeof LogTagTypeSchema>;

// Note: LogEntryData uses string for message (React components handled at render)
export const LogEntryDataSchema = z.object({
  id: z.string(),
  timestamp: z.union([z.date(), z.string()]),
  tag: z.string(),
  tagType: LogTagTypeSchema.optional(),
  message: z.string(),
  isWarning: z.boolean().optional(),
});
export type LogEntryData = z.infer<typeof LogEntryDataSchema>;

// ============================================================================
// Progress Types
// ============================================================================

export const PROGRESS_STATUSES = ["completed", "active", "pending"] as const;
export const ProgressStatusSchema = z.enum(PROGRESS_STATUSES);
export type ProgressStatus = z.infer<typeof ProgressStatusSchema>;

// Note: ProgressStepData.content is ReactNode at runtime, not serializable
export const ProgressStepDataSchema = z.object({
  id: z.string(),
  label: z.string(),
  status: ProgressStatusSchema,
});
export type ProgressStepData = z.infer<typeof ProgressStepDataSchema>;

// ============================================================================
// Analysis Types
// ============================================================================

export const AnalysisStatsSchema = z.object({
  runId: z.string(),
  totalIssues: z.number(),
  filesAnalyzed: z.number(),
  criticalCount: z.number(),
});
export type AnalysisStats = z.infer<typeof AnalysisStatsSchema>;

export const SeverityCountsSchema = z.object({
  blocker: z.number(),
  high: z.number(),
  medium: z.number(),
  low: z.number(),
  nit: z.number(),
});
export type SeverityCounts = z.infer<typeof SeverityCountsSchema>;

export const IssuePreviewSchema = z.object({
  id: z.string(),
  title: z.string(),
  file: z.string(),
  line: z.number(),
  category: z.string(),
  severity: TriageSeveritySchema,
});
export type IssuePreview = z.infer<typeof IssuePreviewSchema>;

// ============================================================================
// Context Info
// ============================================================================

export const ContextInfoSchema = z.object({
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

export const TOAST_VARIANTS = ["success", "error", "warning", "info"] as const;
export const ToastVariantSchema = z.enum(TOAST_VARIANTS);
export type ToastVariant = z.infer<typeof ToastVariantSchema>;

export const ToastItemSchema = z.object({
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
export const IssueTabSchema = z.enum(ISSUE_TABS);
export type IssueTab = z.infer<typeof IssueTabSchema>;

// ============================================================================
// Timeline Types
// ============================================================================

export const TimelineItemSchema = z.object({
  id: z.string(),
  label: z.string(),
  count: z.number(),
});
export type TimelineItem = z.infer<typeof TimelineItemSchema>;

// ============================================================================
// Code Snippet Types
// ============================================================================

export const CODE_LINE_TYPES = ["normal", "added", "removed", "highlight"] as const;
export const CodeLineTypeSchema = z.enum(CODE_LINE_TYPES);
export type CodeLineType = z.infer<typeof CodeLineTypeSchema>;

export const CodeLineSchema = z.object({
  number: z.number(),
  content: z.string(),
  type: CodeLineTypeSchema.optional(),
});
export type CodeLine = z.infer<typeof CodeLineSchema>;

// ============================================================================
// Table Types
// ============================================================================

export const TableColumnSchema = z.object({
  key: z.string(),
  header: z.string(),
  width: z.union([z.number(), z.string()]).optional(),
});
export type TableColumn = z.infer<typeof TableColumnSchema>;

// ============================================================================
// Menu Types
// ============================================================================

export const MenuItemDataSchema = z.object({
  id: z.string(),
  disabled: z.boolean().optional(),
  index: z.number(),
});
export type MenuItemData = z.infer<typeof MenuItemDataSchema>;

// ============================================================================
// Dialog Focus Types
// ============================================================================

export const API_KEY_DIALOG_FOCUS_ELEMENTS = ["paste", "input", "env", "cancel", "confirm", "remove"] as const;
export const ApiKeyDialogFocusElementSchema = z.enum(API_KEY_DIALOG_FOCUS_ELEMENTS);
export type ApiKeyDialogFocusElement = z.infer<typeof ApiKeyDialogFocusElementSchema>;

export const MODEL_DIALOG_FOCUS_ZONES = ["search", "filters", "list", "footer"] as const;
export const ModelDialogFocusZoneSchema = z.enum(MODEL_DIALOG_FOCUS_ZONES);
export type ModelDialogFocusZone = z.infer<typeof ModelDialogFocusZoneSchema>;

// ============================================================================
// Bar Chart Constants
// ============================================================================

/** Unicode filled block for bar charts */
export const BAR_FILLED_CHAR = "█";

/** Unicode empty block for bar charts */
export const BAR_EMPTY_CHAR = "░";

/** Default width for bar charts */
export const DEFAULT_BAR_WIDTH = 20;

// ============================================================================
// Severity Display Configuration (UI-specific)
// ============================================================================

/**
 * UI-specific severity configuration with Tailwind CSS classes.
 */
export interface SeverityConfig {
  icon: string;
  color: string;
  label: string;
  borderColor: string;
}

export const SEVERITY_CONFIG: Record<TriageSeverity, SeverityConfig> = {
  blocker: { icon: "✖", color: "text-tui-red", label: "BLOCKER", borderColor: "border-tui-red" },
  high: { icon: "▲", color: "text-tui-yellow", label: "HIGH", borderColor: "border-tui-yellow" },
  medium: { icon: "●", color: "text-gray-400", label: "MED", borderColor: "border-gray-400" },
  low: { icon: "○", color: "text-tui-blue", label: "LOW", borderColor: "border-tui-blue" },
  nit: { icon: "·", color: "text-gray-500", label: "NIT", borderColor: "border-gray-500" },
};
