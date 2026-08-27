import { formatLocaleDateTimeOrFallback } from "../../format.js";
import type {
  ClientMetadataPayload,
  ClientProductMetadata,
} from "../../providers/client-metadata.js";
import { getProviderDisplayStatus } from "../../providers/display-status.js";
import { pluralize } from "../../strings.js";
import type { SettingsAction } from "../presentation/navigation.js";
import type { Readiness } from "./readiness.js";
import {
  type AgentExecution,
  describeAcceptedProviderConsent,
  type ProviderConsent,
  type SecretsStorage,
  type Theme,
} from "./settings.js";
import type { RunnableProductId } from "./transports.js";

type BillingMode = ClientProductMetadata["billing"]["modes"][number];

export type ProviderSettingsRowId =
  | "product"
  | "transport"
  | "billing"
  | "privacy"
  | "readiness"
  | "verification";

export interface ProviderSettingsRow {
  readonly id: ProviderSettingsRowId;
  /**
   * Presentation shape, so surfaces group rows by kind instead of by an id
   * allowlist that silently drops a row added here later. `fact` is a short
   * label/value pair; `prose` is a paragraph the surface gives its own block.
   */
  readonly kind: "fact" | "prose";
  readonly label: string;
  readonly value: string;
  readonly description?: string;
}

const BILLING_MODE_LABELS = {
  "free-tier": "Evaluation/free quota",
  "pay-as-you-go": "Pay as you go (PAYG)",
  "route-specific": "Route-specific billing",
  "subscription-credit": "Subscription credit/rate limits",
} as const satisfies Record<BillingMode, string>;

/** The last recorded verification of the exact tuple: a Verify probe or a review. */
function describeVerification(readiness: Readiness): string {
  const checkedAt = formatLocaleDateTimeOrFallback(readiness.checkedAt);
  switch (readiness.status) {
    case "ready":
      return `Verified ${checkedAt}`;
    case "conformance-failed":
      return `Failed ${checkedAt}`;
    // The outstanding notice hides the tuple's verdict behind it; the evidence
    // status still says what the last check found.
    case "acknowledgement-required":
      if (readiness.evidenceStatus === "passed") return `Verified ${checkedAt}`;
      if (readiness.evidenceStatus === "failed") return `Failed ${checkedAt}`;
      return "Not verified";
    case "skipped":
      return `Skipped ${checkedAt}`;
    case "unconfigured":
    case "unsupported":
      return "Not checked";
    case "conformance-pending":
    case "credential-invalid":
    case "model-missing":
      return "Not verified";
  }
}

export function buildProviderSettingsRows(
  metadata: ClientMetadataPayload,
): readonly ProviderSettingsRow[] {
  const { product, readiness } = metadata;

  return [
    {
      id: "product",
      kind: "fact",
      label: "Product",
      value: product.name,
      description: product.description,
    },
    {
      id: "transport",
      kind: "fact",
      label: "Transport",
      value: "Hosted API",
    },
    {
      id: "billing",
      kind: "prose",
      label: "Billing",
      value: product.billing.modes.map((mode) => BILLING_MODE_LABELS[mode]).join(", "),
      description: [product.billing.posture, ...product.notice.billing].join(" "),
    },
    {
      id: "privacy",
      kind: "prose",
      label: "Privacy",
      value: product.notice.privacy.join(" "),
    },
    {
      id: "readiness",
      kind: "fact",
      label: "Readiness",
      value: getProviderDisplayStatus(readiness).label,
      description: `${readiness.explanation} ${readiness.remediation.message}`,
    },
    {
      id: "verification",
      kind: "fact",
      label: "Verification",
      value: describeVerification(readiness),
    },
  ];
}

export interface SettingsHubInput {
  selectedProductId: RunnableProductId | null | undefined;
  isTrusted: boolean;
  theme: Theme | null | undefined;
  secretsStorage: SecretsStorage | null;
  agentExecution: AgentExecution;
  selectedLensCount: number;
  providerConsent: ProviderConsent | null;
}

/**
 * Row values for the settings hub, in neutral casing.
 *
 * Casing is a display rule owned by each surface, not part of the data: the web hub lifts
 * these with a CSS `uppercase`, and the TUI uppercases at its render site. Shouting them
 * here would put the capitals in the DOM, where screen readers may spell them out letter
 * by letter.
 */
export function buildHubValues({
  selectedProductId,
  isTrusted,
  theme,
  secretsStorage,
  agentExecution,
  selectedLensCount,
  providerConsent,
}: SettingsHubInput): Record<SettingsAction, string> {
  const providerLabel = selectedProductId ?? "Not configured";
  const themeLabel = theme ?? "auto";
  const storageLabel = secretsStorage ?? "Not set";
  const analysisLabel =
    selectedLensCount > 0 ? pluralize(selectedLensCount, "lens", "lenses") : "Default";

  return {
    trust: isTrusted ? "Trusted" : "Not trusted",
    theme: themeLabel,
    provider: providerLabel,
    "provider-consent": providerConsent
      ? describeAcceptedProviderConsent(providerConsent)
      : "Not accepted",
    storage: storageLabel,
    "agent-execution": agentExecution === "parallel" ? "Parallel" : "Sequential",
    analysis: analysisLabel,
    diagnostics: "Local",
  };
}
