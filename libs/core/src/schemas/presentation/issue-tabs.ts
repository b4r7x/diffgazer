export const ISSUE_TABS = ["details", "explain", "trace", "patch"] as const;
export type IssueTab = (typeof ISSUE_TABS)[number];

export function isIssueTab(value: string): value is IssueTab {
  return ISSUE_TABS.some((tab) => tab === value);
}
