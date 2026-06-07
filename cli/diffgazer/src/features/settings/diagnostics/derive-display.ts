import type { SetupStatus } from "@diffgazer/core/schemas/config";
import type { BadgeVariant } from "@diffgazer/core/schemas/presentation";
import type { ContextStatus } from "./derive-actions";

export type ServerStatus = "checking" | "connected" | "error";

const SERVER_BADGE_VARIANT_BY_STATUS = {
  connected: "success",
  checking: "info",
  error: "error",
} as const satisfies Record<ServerStatus, BadgeVariant>;

const CONTEXT_BADGE_VARIANT_BY_STATUS = {
  ready: "success",
  missing: "warning",
  loading: "info",
  error: "error",
} as const satisfies Record<ContextStatus, BadgeVariant>;

export function getServerBadgeVariant(status: ServerStatus): BadgeVariant {
  return SERVER_BADGE_VARIANT_BY_STATUS[status];
}

export function getServerLabel(status: ServerStatus, errorMessage: string | null): string {
  if (status === "checking") return "checking...";
  if (status === "connected") return "connected";
  return `error: ${errorMessage ?? "unknown"}`;
}

export interface SetupDisplayInput {
  isLoading: boolean;
  error: string | null;
  setupStatus: SetupStatus | null;
}

export function getSetupLabel({ isLoading, error, setupStatus }: SetupDisplayInput): string {
  if (isLoading) return "loading...";
  if (error) return `error: ${error}`;
  if (setupStatus?.isReady) return "ready";
  return `incomplete (${setupStatus?.missing.join(", ") ?? "unknown"})`;
}

export function getSetupVariant({
  isLoading,
  error,
  setupStatus,
}: SetupDisplayInput): BadgeVariant {
  if (isLoading) return "info";
  if (error) return "error";
  if (setupStatus?.isReady) return "success";
  return "warning";
}

export function getContextLabel(status: ContextStatus, errorMessage: string | null): string {
  if (status === "loading") return "loading...";
  if (status === "ready") return "ready";
  if (status === "missing") return "missing";
  return `error: ${errorMessage ?? "unknown"}`;
}

export function getContextVariant(status: ContextStatus): BadgeVariant {
  return CONTEXT_BADGE_VARIANT_BY_STATUS[status];
}
