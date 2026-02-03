export interface Shortcut {
  key: string;
  label: string;
  disabled?: boolean;
}

export type ToastVariant = "success" | "error" | "warning" | "info";

export interface ToastItem {
  id: string;
  message: string;
  variant?: ToastVariant;
  duration?: number;
}

export interface ContextInfo {
  trustedDir?: string;
  providerName?: string;
  providerMode?: string;
  lastRunId?: string;
  lastRunIssueCount?: number;
}
