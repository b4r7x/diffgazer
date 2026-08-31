import { CATALOG_MODEL_DERIVED } from "../catalog/model-derived.js";
import type { Readiness, ReadinessAction, ReadinessStatus } from "../schemas/config/readiness.js";
import type { RunnableProductId } from "../schemas/config/transports.js";
import type { BadgeVariant } from "../schemas/presentation/index.js";
import { getEndpointPoolContext, poolBadgeLabel } from "./endpoint-pools.js";
import { PRODUCT_REGISTRY, type RunnableProductDescriptor } from "./product-registry.js";

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

export function getProviderDisplayStatus(readiness: Readiness): ProviderDisplayStatus {
  const badge = READINESS_BADGES[readiness.status];
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

/**
 * The provider a record names: the full product name, whatever endpoint the
 * configuration is bound to. History rows, receipts, and detail panes read the
 * same string for one product, so a pool binding can never relabel only the
 * records written after it.
 */
export function getProviderDisplay(
  productId?: RunnableProductId,
  modelId?: string,
  _endpoint?: string,
): string {
  if (!productId) return "Not configured";
  const name = PRODUCT_REGISTRY[productId].presentation.name;
  if (modelId) return `${name} / ${getCatalogModelName(productId, modelId)}`;
  return name;
}

/**
 * The provider a compact surface names: the short human name where the registry
 * publishes one, with the bound pool appended for a product whose endpoints are
 * billing pools — a header has room for the wallet, not for the catalog's full
 * product name.
 */
export function getProviderShortDisplay(productId: RunnableProductId, endpoint?: string): string {
  // The registry is declared `as const`, so a product that publishes no
  // shortName has no such key on its literal type; the descriptor type is where
  // the optional field is declared.
  const { presentation }: RunnableProductDescriptor<RunnableProductId> =
    PRODUCT_REGISTRY[productId];
  const name = presentation.shortName ?? presentation.name;
  const poolContext = endpoint ? getEndpointPoolContext(productId, endpoint) : null;
  if (!poolContext) return name;
  return `${name} · ${poolBadgeLabel(poolContext.bound)}`;
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
      readonly productId: RunnableProductId;
      readonly modelId?: string | null;
      /** The configuration's bound endpoint, so a pool product headers as its pool. */
      readonly endpoint?: string;
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

  const providerName = getProviderShortDisplay(state.productId, state.endpoint);
  const modelId = state.modelId ?? undefined;

  return {
    providerName: modelId
      ? `${providerName} / ${getCatalogModelName(state.productId, modelId)}`
      : providerName,
    providerStatus: getProviderDisplayStatus(state.readiness),
  };
}
