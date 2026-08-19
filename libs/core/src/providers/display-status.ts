import { CATALOG_MODEL_DERIVED } from "../catalog/model-derived.js";
import type { Readiness, ReadinessAction, ReadinessStatus } from "../schemas/config/readiness.js";
import type { RunnableProductId, TransportFamily } from "../schemas/config/transports.js";
import type { BadgeVariant } from "../schemas/presentation/index.js";
import { PRODUCT_REGISTRY } from "./product-registry.js";

interface ReadinessBadge {
  readonly label: string;
  /** One lowercase word for compact surfaces such as the header status chip. */
  readonly shortLabel: string;
  readonly variant: BadgeVariant;
}

const READINESS_BADGES = {
  unconfigured: { label: "Not configured", shortLabel: "setup", variant: "warning" },
  "credential-invalid": { label: "Credential invalid", shortLabel: "invalid", variant: "error" },
  "model-missing": { label: "Model missing", shortLabel: "missing", variant: "warning" },
  "conformance-pending": { label: "Not verified", shortLabel: "pending", variant: "info" },
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
  skipped: { label: "Verification skipped", shortLabel: "skipped", variant: "warning" },
  "local-conformance-failed": {
    label: "Local conformance failed",
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

/**
 * "Not configured · Not configured" says one thing twice. When either header
 * chip segment already contains the other (case-insensitively), the name alone
 * carries the row; distinct segments keep the "name · status" join. Each shell
 * passes the status string it actually renders — the full label or the short
 * word.
 */
export function isRedundantStatusSegment(providerName: string, statusText: string): boolean {
  const name = providerName.toLowerCase();
  const status = statusText.toLowerCase();
  return name.includes(status) || status.includes(name);
}

/**
 * The catalog display name for a model, or the id itself when the bounded
 * catalog does not carry it — a model outside the catalog has one identity, and
 * inventing a prettier one would name something the review cannot pin.
 */
export function getCatalogModelName(productId: RunnableProductId, modelId: string): string {
  return CATALOG_MODEL_DERIVED[productId]?.[modelId]?.name ?? modelId;
}

export function getProviderDisplay(productId?: RunnableProductId, modelId?: string): string {
  if (!productId) return "Not configured";
  const productName = PRODUCT_REGISTRY[productId].presentation.name;
  if (modelId) return `${productName} / ${getCatalogModelName(productId, modelId)}`;
  return productName;
}

/**
 * What an app shell knows about its configuration when it draws the header: it
 * is still loading, it failed to load, none is configured, or one is selected.
 */
export type ShellProviderState =
  | { readonly status: "loading" }
  | { readonly status: "error" }
  | { readonly status: "unconfigured" }
  | {
      readonly status: "configured";
      readonly readiness: Readiness;
      readonly transportFamily: TransportFamily;
      readonly productId: RunnableProductId;
      readonly modelId?: string | null;
    };

export interface ShellProviderIdentity {
  readonly providerName: string;
  readonly providerStatus: ProviderDisplayStatus;
}

/**
 * The provider identity a shell header shows for each state it can be in. Both
 * shells ask the same question of the same data, so the pre-configuration
 * wording lives here instead of being written once per surface and drifting.
 */
export function resolveShellProviderIdentity(state: ShellProviderState): ShellProviderIdentity {
  if (state.status === "loading") {
    return {
      providerName: "Loading configuration",
      providerStatus: getUnconfiguredDisplayStatus({ label: "Loading", shortLabel: "loading" }),
    };
  }

  if (state.status === "error") {
    return {
      providerName: "Configuration unavailable",
      providerStatus: getUnconfiguredDisplayStatus({
        label: "Unavailable",
        shortLabel: "unavailable",
      }),
    };
  }

  if (state.status === "unconfigured") {
    return { providerName: getProviderDisplay(), providerStatus: getUnconfiguredDisplayStatus() };
  }

  return {
    providerName: getProviderDisplay(state.productId, state.modelId ?? undefined),
    providerStatus: getProviderDisplayStatus(state.readiness, state.transportFamily),
  };
}
