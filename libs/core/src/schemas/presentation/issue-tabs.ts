import { z } from "zod";

export const ISSUE_TABS = ["details", "explain", "trace", "patch"] as const;
const IssueTabSchema = z.enum(ISSUE_TABS);
export type IssueTab = z.infer<typeof IssueTabSchema>;

export function isIssueTab(value: string): value is IssueTab {
  return ISSUE_TABS.includes(value as IssueTab);
}
