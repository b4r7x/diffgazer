import { z } from "zod";
import { TriageIssueSchema } from "./triage.js";

// ============================================================================
// History Tab Types
// ============================================================================

export const HISTORY_TAB_IDS = ["runs"] as const;
export const HistoryTabIdSchema = z.enum(HISTORY_TAB_IDS);
export type HistoryTabId = z.infer<typeof HistoryTabIdSchema>;

// ============================================================================
// History Focus Zone
// ============================================================================

export const HISTORY_FOCUS_ZONES = ["timeline", "runs", "insights"] as const;
export const HistoryFocusZoneSchema = z.enum(HISTORY_FOCUS_ZONES);
export type HistoryFocusZone = z.infer<typeof HistoryFocusZoneSchema>;

// ============================================================================
// History Run
// ============================================================================

export const HistoryRunSchema = z.object({
  id: z.string(),
  displayId: z.string(),
  date: z.string(),
  branch: z.string(),
  provider: z.string(),
  timestamp: z.string(),
  summary: z.string(),
  issues: z.array(TriageIssueSchema),
  issueCount: z.number(),
  criticalCount: z.number(),
  warningCount: z.number(),
});
export type HistoryRun = z.infer<typeof HistoryRunSchema>;

// ============================================================================
// History State
// ============================================================================

export const HistoryStateSchema = z.object({
  activeTab: HistoryTabIdSchema,
  focusZone: HistoryFocusZoneSchema,
  selectedDateId: z.string(),
  selectedRunId: z.string().nullable(),
  expandedRunId: z.string().nullable(),
});
export type HistoryState = z.infer<typeof HistoryStateSchema>;
