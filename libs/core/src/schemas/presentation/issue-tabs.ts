import { isMember } from "../fields.js";

export const ISSUE_TABS = ["details", "explain", "trace", "patch"] as const;
export type IssueTab = (typeof ISSUE_TABS)[number];

export function isIssueTab(value: string): value is IssueTab {
  return isMember(ISSUE_TABS, value);
}
