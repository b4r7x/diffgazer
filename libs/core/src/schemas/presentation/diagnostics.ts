import type { DiagnosticsSetupGaps } from "../config/index.js";
import type { BadgeVariant } from "./log.js";

export type ContextStatus = "loading" | "ready" | "missing" | "error";

export type ServerState =
  | { status: "checking" }
  | { status: "connected" }
  | { status: "error"; message: string };

interface DiagnosticsPresentation {
  label: string;
  variant: Extract<BadgeVariant, "success" | "warning" | "error" | "info">;
}

export function getServerStatusPresentation(serverState: ServerState): DiagnosticsPresentation {
  if (serverState.status === "checking") return { label: "Checking...", variant: "info" };
  if (serverState.status === "connected") return { label: "Connected", variant: "success" };
  return { label: `Error: ${serverState.message}`, variant: "error" };
}

interface SetupPresentationInput {
  isLoading: boolean;
  error: string | null;
  setupStatus: DiagnosticsSetupGaps | null;
}

export function getSetupPresentation({
  isLoading,
  error,
  setupStatus,
}: SetupPresentationInput): DiagnosticsPresentation {
  if (isLoading) return { label: "Loading...", variant: "info" };
  if (error) return { label: `Error: ${error}`, variant: "error" };
  if (!setupStatus) return { label: "Unavailable", variant: "warning" };
  if (setupStatus.isReady) return { label: "Ready", variant: "success" };
  if (setupStatus.missing.length > 0) {
    return {
      label: `Incomplete (${setupStatus.missing.join(", ")})`,
      variant: "warning",
    };
  }
  if (setupStatus.readiness) {
    return { label: setupStatus.readiness.explanation, variant: "warning" };
  }
  return { label: "Incomplete", variant: "warning" };
}

export function getContextPresentation(
  status: ContextStatus,
  errorMessage: string | null,
): DiagnosticsPresentation {
  switch (status) {
    case "loading":
      return { label: "Loading...", variant: "info" };
    case "ready":
      return { label: "Ready", variant: "success" };
    case "missing":
      return { label: "Missing", variant: "warning" };
    case "error":
      return { label: `Error: ${errorMessage ?? "unknown"}`, variant: "error" };
    default: {
      const _exhaustive: never = status;
      return _exhaustive;
    }
  }
}

export function getContextActionLabel(isRefreshing: boolean, status: ContextStatus): string {
  if (isRefreshing) return "Regenerating...";
  if (status === "ready") return "Regenerate Context";
  return "Generate Context";
}

interface DiagnosticsActionsInput {
  canRegenerate: boolean;
  isRefreshing: boolean;
  isRefreshingAll: boolean;
}

interface DiagnosticsActions {
  refreshAllDisabled: boolean;
  contextActionDisabled: boolean;
}

export function deriveDiagnosticsActions({
  canRegenerate,
  isRefreshing,
  isRefreshingAll,
}: DiagnosticsActionsInput): DiagnosticsActions {
  return {
    refreshAllDisabled: isRefreshingAll || isRefreshing,
    contextActionDisabled: !canRegenerate || isRefreshing || isRefreshingAll,
  };
}
