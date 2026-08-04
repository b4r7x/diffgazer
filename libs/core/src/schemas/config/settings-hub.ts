import type {
  ClientMetadataPayload,
  ClientProductMetadata,
} from "../../providers/client-metadata.js";
import { getProviderDisplayStatus } from "../../providers/display-status.js";
import { pluralize } from "../../strings.js";
import type { SettingsAction } from "../presentation/navigation.js";
import type { AgentExecution, SecretsStorage, Theme } from "./settings.js";
import type { RemovedProductId, RunnableProductId } from "./transports.js";

type RunnableProduct = Extract<ClientProductMetadata, { status: "supported" }>;
type BillingMode = RunnableProduct["billing"]["modes"][number];

export type ProviderSettingsRowId = "product" | "transport" | "billing" | "privacy" | "readiness";

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

const TRANSPORT_LABELS = {
  "hosted-api": "Hosted API",
  "local-http": "Local HTTP",
  "local-cli": "Local CLI",
} as const;

const BILLING_MODE_LABELS = {
  "free-tier": "Evaluation/free quota",
  "pay-as-you-go": "Pay as you go (PAYG)",
  evaluation: "Evaluation",
  "route-specific": "Route-specific billing",
  "local-resource": "Local execution costs",
  "subscription-credit": "Subscription credit/rate limits",
} as const satisfies Record<BillingMode, string>;

export function buildProviderSettingsRows(
  metadata: ClientMetadataPayload,
): readonly ProviderSettingsRow[] {
  const { product, readiness } = metadata;
  const rows: ProviderSettingsRow[] = [
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
      value: TRANSPORT_LABELS[product.transportFamily],
    },
  ];

  if (product.status === "supported") {
    rows.push(
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
    );
  }

  rows.push({
    id: "readiness",
    kind: "fact",
    label: "Readiness",
    value: getProviderDisplayStatus(readiness, product.transportFamily).label,
    description: `${readiness.explanation} ${readiness.remediation.message}`,
  });

  return rows;
}

export interface SettingsHubInput {
  selectedProductId: RunnableProductId | RemovedProductId | null | undefined;
  isTrusted: boolean;
  theme: Theme | null | undefined;
  secretsStorage: SecretsStorage | null | undefined;
  agentExecution: AgentExecution | null | undefined;
  selectedLensCount: number | null | undefined;
}

function getAgentExecutionLabel(mode: AgentExecution | null | undefined): string {
  if (mode === "parallel") return "Parallel";
  return "Sequential";
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
}: SettingsHubInput): Record<SettingsAction, string> {
  const providerLabel = selectedProductId ?? "Not configured";
  const themeLabel = theme ?? "auto";
  const storageLabel = secretsStorage ?? "Not set";
  const analysisLabel =
    selectedLensCount && selectedLensCount > 0
      ? pluralize(selectedLensCount, "lens", "lenses")
      : "Default";

  return {
    trust: isTrusted ? "Trusted" : "Not trusted",
    theme: themeLabel,
    provider: providerLabel,
    storage: storageLabel,
    "agent-execution": getAgentExecutionLabel(agentExecution),
    analysis: analysisLabel,
    diagnostics: "Local",
  };
}
