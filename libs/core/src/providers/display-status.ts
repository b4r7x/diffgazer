import type { Readiness, ReadinessAction, ReadinessStatus } from "../schemas/config/readiness.js";
import type { TransportFamily } from "../schemas/config/transports.js";
import type { BadgeVariant } from "../schemas/presentation/index.js";

interface ReadinessBadge {
  readonly label: string;
  readonly variant: BadgeVariant;
}

const READINESS_BADGES = {
  unconfigured: { label: "Not configured", variant: "warning" },
  "credential-invalid": { label: "Credential invalid", variant: "error" },
  "endpoint-invalid": { label: "Endpoint invalid", variant: "error" },
  unreachable: { label: "Service unreachable", variant: "error" },
  "model-missing": { label: "Model missing", variant: "error" },
  "conformance-pending": { label: "Conformance pending", variant: "info" },
  "conformance-failed": { label: "Conformance failed", variant: "error" },
  "acknowledgement-required": { label: "Acknowledgement required", variant: "warning" },
  unsupported: { label: "Unsupported", variant: "warning" },
  removed: { label: "Removed", variant: "error" },
  skipped: { label: "Readiness check skipped", variant: "warning" },
  "local-endpoint-unreachable": { label: "Local endpoint unreachable", variant: "error" },
  "local-endpoint-forbidden": { label: "Local endpoint forbidden", variant: "error" },
  "local-api-incompatible": { label: "Local API incompatible", variant: "error" },
  "local-no-review-capable-model": {
    label: "No review-capable local model",
    variant: "error",
  },
  "local-selected-model-missing": { label: "Local model missing", variant: "error" },
  "local-conformance-failed": { label: "Local conformance failed", variant: "error" },
  "local-cancellation-failed": { label: "Local cancellation failed", variant: "error" },
  ready: { label: "Ready", variant: "success" },
} as const satisfies Record<ReadinessStatus, ReadinessBadge>;

export interface ProviderDisplayStatus {
  readonly status: ReadinessStatus;
  readonly action: ReadinessAction;
  readonly label: string;
  readonly variant: BadgeVariant;
  readonly explanation: string;
  readonly remediation: string;
  readonly accessibleText: string;
}

function getReadinessBadge(
  status: ReadinessStatus,
  transportFamily: TransportFamily,
): ReadinessBadge {
  if (status === "unsupported" && transportFamily === "local-cli") {
    return { label: "CLI unsupported", variant: "warning" };
  }

  return READINESS_BADGES[status];
}

export function getProviderDisplayStatus(
  readiness: Readiness,
  transportFamily: TransportFamily,
): ProviderDisplayStatus {
  const badge = getReadinessBadge(readiness.status, transportFamily);
  const remediation = readiness.remediation.message;

  return {
    status: readiness.status,
    action: readiness.action,
    label: badge.label,
    variant: badge.variant,
    explanation: readiness.explanation,
    remediation,
    accessibleText: `${badge.label}. ${readiness.explanation} ${remediation}`,
  };
}

export function getDisplayStatusBadge(
  readiness: Readiness,
  transportFamily: TransportFamily,
): ReadinessBadge {
  return getReadinessBadge(readiness.status, transportFamily);
}

export function getProviderDisplay(productName?: string, modelId?: string): string {
  if (!productName) return "Not configured";
  if (modelId) return `${productName} / ${modelId}`;
  return productName;
}
