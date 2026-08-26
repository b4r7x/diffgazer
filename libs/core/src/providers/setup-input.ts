import type {
  ClientConfigurationInput,
  WriteOnlySecretInput,
} from "../schemas/config/provider-config.js";
import type { ReadinessAcknowledgement } from "../schemas/config/readiness.js";
import type { ProviderListRow } from "./list.js";
import { acceptNotice } from "./product-registry.js";

type AcceptedAcknowledgement = Extract<ReadinessAcknowledgement, { status: "accepted" }>;

function resolveHostedEndpoint(row: ProviderListRow): string {
  if (row.configuration) return row.configuration.endpoint;

  const defaultProfile = row.product.endpoints[0];
  if (!defaultProfile) {
    throw new Error(`No endpoint profile for ${row.product.productId}`);
  }
  return defaultProfile.endpoint;
}

/**
 * The one configuration payload a setup surface saves. Every runnable product is
 * hosted, so the payload always carries the hosted tuple and optional credential.
 */
export function buildSetupInput(
  row: ProviderListRow,
  credential?: WriteOnlySecretInput,
): ClientConfigurationInput {
  return {
    transportFamily: "hosted-api",
    productId: row.product.productId,
    endpoint: resolveHostedEndpoint(row),
    ...(credential ? { credential } : {}),
  };
}

/** The notice a save accepts is always the bound product's own notice. */
export function buildSetupAcknowledgement(row: ProviderListRow): AcceptedAcknowledgement {
  return acceptNotice(row.product.notice);
}

export function toSetupCredential(method: "paste" | "env", value: string): WriteOnlySecretInput {
  if (method === "env") return { kind: "environment" };
  return { kind: "literal", value };
}

/** The line a setup surface leads with. */
export function getSetupLayoutCopy(row: ProviderListRow): string {
  return `Choose how to provide credentials for ${row.product.name}:`;
}
