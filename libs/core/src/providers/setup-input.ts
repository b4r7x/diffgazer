import type {
  ClientConfigurationInput,
  WriteOnlySecretInput,
} from "../schemas/config/provider-config.js";
import type { ReadinessAcknowledgement } from "../schemas/config/readiness.js";
import type {
  HostedApiProductId,
  LocalCliProductId,
  LocalHttpProductId,
} from "../schemas/config/transports.js";
import type { ProviderListRow } from "./list.js";

type AcceptedAcknowledgement = Extract<ReadinessAcknowledgement, { status: "accepted" }>;

function resolveHostedTupleFields(row: ProviderListRow): {
  endpoint: string;
  region?: string;
  workspace?: string;
} {
  const product = row.product;
  const configured = row.configuration?.transportFamily === "hosted-api" ? row.configuration : null;

  if (configured) {
    return {
      endpoint: configured.endpoint,
      ...(configured.region !== undefined ? { region: configured.region } : {}),
      ...(configured.workspace !== undefined ? { workspace: configured.workspace } : {}),
    };
  }

  const defaultProfile = product.endpoints[0];
  if (!defaultProfile) {
    throw new Error(`No endpoint profile for ${product.productId}`);
  }

  return {
    endpoint: defaultProfile.endpoint,
    ...(defaultProfile.region !== undefined ? { region: defaultProfile.region } : {}),
  };
}

function buildHostedInput(
  row: ProviderListRow,
  credential?: WriteOnlySecretInput,
): ClientConfigurationInput {
  const product = row.product;
  const tupleFields = resolveHostedTupleFields(row);
  return {
    transportFamily: "hosted-api",
    productId: product.productId as HostedApiProductId,
    endpoint: tupleFields.endpoint,
    ...(tupleFields.region !== undefined ? { region: tupleFields.region } : {}),
    ...(tupleFields.workspace !== undefined ? { workspace: tupleFields.workspace } : {}),
    ...(credential ? { credential } : {}),
  };
}

function buildLocalHttpInput(row: ProviderListRow): ClientConfigurationInput {
  const product = row.product;
  const configured = row.configuration?.transportFamily === "local-http" ? row.configuration : null;
  const endpoint = configured?.endpoint ?? product.endpoints[0]?.endpoint;
  if (!endpoint) {
    throw new Error(`No endpoint profile for ${product.productId}`);
  }
  return {
    transportFamily: "local-http",
    productId: product.productId as LocalHttpProductId,
    endpoint,
    authentication: "none",
    ...(configured?.presetId ? { presetId: configured.presetId } : {}),
  };
}

function buildLocalCliInput(row: ProviderListRow): ClientConfigurationInput {
  const product = row.product;
  const configured = row.configuration?.transportFamily === "local-cli" ? row.configuration : null;
  return {
    transportFamily: "local-cli",
    productId: product.productId as LocalCliProductId,
    installationId: configured?.installationId ?? `${product.productId}-installation`,
  };
}

/**
 * The one configuration payload a setup surface saves. `credential` is carried
 * only by the hosted family; local transports store no hosted secret.
 */
export function buildSetupInput(
  row: ProviderListRow,
  credential?: WriteOnlySecretInput,
): ClientConfigurationInput {
  switch (row.product.transportFamily) {
    case "hosted-api":
      return buildHostedInput(row, credential);
    case "local-http":
      return buildLocalHttpInput(row);
    case "local-cli":
      return buildLocalCliInput(row);
    default: {
      const _exhaustive: never = row.product.transportFamily;
      return _exhaustive;
    }
  }
}

/** The notice a save accepts is always the bound product's own notice. */
export function buildSetupAcknowledgement(row: ProviderListRow): AcceptedAcknowledgement {
  const notice = row.product.notice;
  return {
    status: "accepted",
    noticeId: notice.id,
    noticeVersion: notice.noticeVersion,
    acceptedAt: new Date().toISOString(),
  };
}

export function toSetupCredential(method: "paste" | "env", value: string): WriteOnlySecretInput {
  if (method === "env") return { kind: "environment" };
  return { kind: "literal", value };
}

function getLocalHttpCopy(row: ProviderListRow): string {
  const endpoint =
    row.configuration?.transportFamily === "local-http"
      ? row.configuration.endpoint
      : row.product.endpoints[0]?.endpoint;
  return `Configure the local endpoint at ${endpoint ?? "the selected loopback URL"} without storing hosted credentials.`;
}

/** The line a setup surface leads with, in the vocabulary of its transport. */
export function getSetupLayoutCopy(row: ProviderListRow): string {
  switch (row.product.transportFamily) {
    case "hosted-api":
      return `Choose how to provide credentials for ${row.product.name}:`;
    case "local-http":
      return getLocalHttpCopy(row);
    case "local-cli":
      return "Configure the local CLI installation without storing hosted credentials.";
    default: {
      const _exhaustive: never = row.product.transportFamily;
      return _exhaustive;
    }
  }
}
