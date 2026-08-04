import type { Readiness, ReadinessAction, ReadinessStatus } from "../schemas/config/readiness.js";
import type { TransportFamily } from "../schemas/config/transports.js";
import type { BadgeVariant } from "../schemas/presentation/index.js";

interface ReadinessBadge {
  readonly label: string;
  /** One lowercase word for compact surfaces such as the header status chip. */
  readonly shortLabel: string;
  readonly variant: BadgeVariant;
}

const READINESS_BADGES = {
  unconfigured: { label: "Not configured", shortLabel: "setup", variant: "warning" },
  "credential-invalid": { label: "Credential invalid", shortLabel: "invalid", variant: "error" },
  "endpoint-invalid": { label: "Endpoint invalid", shortLabel: "invalid", variant: "error" },
  unreachable: { label: "Service unreachable", shortLabel: "unreachable", variant: "error" },
  "model-missing": { label: "Model missing", shortLabel: "missing", variant: "warning" },
  "conformance-pending": {
    label: "Compatibility check needed",
    shortLabel: "pending",
    variant: "info",
  },
  "conformance-failed": {
    label: "Compatibility check failed",
    shortLabel: "failed",
    variant: "error",
  },
  "acknowledgement-required": {
    label: "Acknowledgement required",
    shortLabel: "setup",
    variant: "warning",
  },
  unsupported: { label: "Unsupported", shortLabel: "unsupported", variant: "warning" },
  skipped: { label: "Readiness check skipped", shortLabel: "skipped", variant: "warning" },
  "local-endpoint-unreachable": {
    label: "Local endpoint unreachable",
    shortLabel: "unreachable",
    variant: "error",
  },
  "local-endpoint-forbidden": {
    label: "Local endpoint forbidden",
    shortLabel: "forbidden",
    variant: "error",
  },
  "local-api-incompatible": {
    label: "Local API incompatible",
    shortLabel: "incompatible",
    variant: "error",
  },
  "local-no-review-capable-model": {
    label: "No review-capable local model",
    shortLabel: "missing",
    variant: "error",
  },
  "local-selected-model-missing": {
    label: "Local model missing",
    shortLabel: "missing",
    variant: "error",
  },
  "local-conformance-failed": {
    label: "Local conformance failed",
    shortLabel: "failed",
    variant: "error",
  },
  "local-cancellation-failed": {
    label: "Local cancellation failed",
    shortLabel: "failed",
    variant: "error",
  },
  ready: { label: "Ready", shortLabel: "ready", variant: "success" },
} as const satisfies Record<ReadinessStatus, ReadinessBadge>;

export interface ProviderDisplayStatus {
  readonly status: ReadinessStatus;
  readonly action: ReadinessAction;
  readonly label: string;
  readonly shortLabel: string;
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
    return { label: "CLI unsupported", shortLabel: "unsupported", variant: "warning" };
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
    shortLabel: badge.shortLabel,
    variant: badge.variant,
    explanation: readiness.explanation,
    remediation,
    accessibleText: `${badge.label}. ${readiness.explanation} ${remediation}`,
  };
}

/**
 * The status an app shell shows before any configuration is known: no readiness
 * has been observed, so there is nothing to explain or remediate yet. A shell
 * that is still loading, or that failed to load, overrides the wording; the
 * label doubles as the accessible text because no readiness prose exists to
 * append to it.
 */
export function getUnconfiguredDisplayStatus(overrides?: {
  label?: string;
  shortLabel?: string;
}): ProviderDisplayStatus {
  const badge = READINESS_BADGES.unconfigured;
  const label = overrides?.label ?? badge.label;

  return {
    status: "unconfigured",
    action: "create",
    label,
    shortLabel: overrides?.shortLabel ?? badge.shortLabel,
    variant: badge.variant,
    explanation: "",
    remediation: "",
    accessibleText: label,
  };
}

export function getProviderDisplay(productName?: string, modelId?: string): string {
  if (!productName) return "Not configured";
  if (modelId) return `${productName} / ${modelId}`;
  return productName;
}
