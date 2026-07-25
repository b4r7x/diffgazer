import type { SetupStatus } from "../config/index.js";
import type { BadgeVariant } from "./log.js";

export type ContextStatus = "loading" | "ready" | "missing" | "error";

export type ServerState =
  | { status: "checking" }
  | { status: "connected" }
  | { status: "error"; message: string };

export interface DiagnosticsPresentation {
  label: string;
  variant: Extract<BadgeVariant, "success" | "warning" | "error" | "info">;
}

export function getServerStatusPresentation(serverState: ServerState): DiagnosticsPresentation {
  if (serverState.status === "checking") return { label: "Checking...", variant: "info" };
  if (serverState.status === "connected") return { label: "Connected", variant: "success" };
  return { label: `Error: ${serverState.message}`, variant: "error" };
}

export interface SetupPresentationInput {
  isLoading: boolean;
  error: string | null;
  setupStatus: SetupStatus | null;
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
  return {
    label: `Incomplete (${setupStatus.missing.join(", ") || "unknown"})`,
    variant: "warning",
  };
}

const CONTEXT_VARIANT_BY_STATUS = {
  ready: "success",
  missing: "warning",
  loading: "info",
  error: "error",
} as const satisfies Record<ContextStatus, DiagnosticsPresentation["variant"]>;

export function getContextPresentation(
  status: ContextStatus,
  errorMessage: string | null,
): DiagnosticsPresentation {
  if (status === "loading") {
    return { label: "Loading...", variant: CONTEXT_VARIANT_BY_STATUS.loading };
  }
  if (status === "ready") return { label: "Ready", variant: CONTEXT_VARIANT_BY_STATUS.ready };
  if (status === "missing") {
    return { label: "Missing", variant: CONTEXT_VARIANT_BY_STATUS.missing };
  }
  return { label: `Error: ${errorMessage ?? "unknown"}`, variant: CONTEXT_VARIANT_BY_STATUS.error };
}

export function getContextActionLabel(isRefreshing: boolean, status: ContextStatus): string {
  if (isRefreshing) return "Regenerating...";
  if (status === "ready") return "Regenerate Context";
  return "Generate Context";
}

export interface DiagnosticsActionsInput {
  canRegenerate: boolean;
  isRefreshing: boolean;
  isRefreshingAll: boolean;
}

export interface DiagnosticsActions {
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
