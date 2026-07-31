import type {
  ClientMetadataPayload,
  ClientProductMetadata,
} from "../../providers/client-metadata.js";
import { pluralize } from "../../strings.js";
import type { SettingsAction } from "../presentation/navigation.js";
import type { ClientConfigurationActionName } from "./provider-config.js";
import type { AgentExecution, SecretsStorage, Theme } from "./settings.js";
import type { RemovedProductId, RunnableProductId } from "./transports.js";

type RunnableProduct = Extract<ClientProductMetadata, { status: "supported" }>;
type BillingMode = RunnableProduct["billing"]["modes"][number];
type MigrationAction = Extract<
  ClientProductMetadata,
  { status: "removed" }
>["migrationActions"][number];

export type ProviderSettingsRowId =
  | "product"
  | "transport"
  | "billing"
  | "privacy"
  | "readiness"
  | "actions";

export interface ProviderSettingsRow {
  readonly id: ProviderSettingsRowId;
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

const ACTION_LABELS = {
  create: "Create",
  inspect: "Inspect",
  select: "Select model",
  test: "Test readiness",
  update: "Update",
  delete: "Delete",
} as const satisfies Record<ClientConfigurationActionName, string>;

const MIGRATION_ACTION_LABELS = {
  "create-new-zai-configuration": "Create new Z.AI configuration",
  "delete-removed-record": "Delete removed record",
} as const satisfies Record<MigrationAction, string>;

function sentenceCase(value: string): string {
  const words = value.split("-").join(" ");
  return `${words.charAt(0).toUpperCase()}${words.slice(1)}`;
}

export function buildProviderSettingsRows(
  metadata: ClientMetadataPayload,
): readonly ProviderSettingsRow[] {
  const { product, readiness } = metadata;
  const rows: ProviderSettingsRow[] = [
    {
      id: "product",
      label: "Product",
      value: product.name,
      description: product.description,
    },
    {
      id: "transport",
      label: "Transport",
      value: TRANSPORT_LABELS[product.transportFamily],
    },
  ];

  if (product.status === "supported") {
    rows.push(
      {
        id: "billing",
        label: "Billing",
        value: product.billing.modes.map((mode) => BILLING_MODE_LABELS[mode]).join(", "),
        description: [product.billing.posture, ...product.notice.billing].join(" "),
      },
      {
        id: "privacy",
        label: "Privacy",
        value: product.notice.privacy.join(" "),
      },
    );
  }

  rows.push({
    id: "readiness",
    label: "Readiness",
    value: sentenceCase(readiness.status),
    description: `${readiness.explanation} ${readiness.remediation.message}`,
  });

  const actions =
    product.status === "removed"
      ? product.migrationActions.map((action) => MIGRATION_ACTION_LABELS[action])
      : metadata.actions.map((action) => ACTION_LABELS[action]);
  rows.push({
    id: "actions",
    label: "Available actions",
    value: actions.length > 0 ? actions.join(", ") : "None",
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
