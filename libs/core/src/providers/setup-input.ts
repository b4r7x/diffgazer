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
type SupportedProduct = Extract<ProviderListRow["product"], { status: "supported" }>;

/** The transport families a setup surface can configure. */
export type SetupTransportFamily = "hosted-api" | "local-http" | "local-cli";

/**
 * What the surface is setting up: the stored configuration's transport when one
 * exists, otherwise the product's own. A removed record configures nothing.
 */
export function resolveSetupTransportFamily(row: ProviderListRow): SetupTransportFamily | null {
  if (row.configuration?.status === "supported") {
    return row.configuration.transportFamily;
  }
  if (row.product.status === "supported") {
    return row.product.transportFamily;
  }
  return null;
}

function requireSupportedProduct(
  row: ProviderListRow,
  transportFamily: SetupTransportFamily,
): SupportedProduct {
  if (row.product.status !== "supported") {
    throw new Error(`Product ${row.product.productId} is not supported for setup`);
  }
  if (row.product.transportFamily !== transportFamily) {
    throw new Error(`Setup requires a supported ${transportFamily} product`);
  }
  return row.product;
}

function buildHostedInput(
  row: ProviderListRow,
  credential?: WriteOnlySecretInput,
): ClientConfigurationInput {
  const product = requireSupportedProduct(row, "hosted-api");
  const configured =
    row.configuration?.status === "supported" && row.configuration.transportFamily === "hosted-api"
      ? row.configuration
      : null;
  return {
    transportFamily: "hosted-api",
    productId: product.productId as HostedApiProductId,
    endpoint: configured?.endpoint ?? product.endpoints[0]?.endpoint ?? "",
    ...(credential ? { credential } : {}),
  };
}

function buildLocalHttpInput(row: ProviderListRow): ClientConfigurationInput {
  const product = requireSupportedProduct(row, "local-http");
  const configured =
    row.configuration?.status === "supported" && row.configuration.transportFamily === "local-http"
      ? row.configuration
      : null;
  return {
    transportFamily: "local-http",
    productId: product.productId as LocalHttpProductId,
    endpoint: configured?.endpoint ?? product.endpoints[0]?.endpoint ?? "",
    authentication: "none",
    ...(configured?.presetId ? { presetId: configured.presetId } : {}),
  };
}

function buildLocalCliInput(row: ProviderListRow): ClientConfigurationInput {
  const product = requireSupportedProduct(row, "local-cli");
  const configured =
    row.configuration?.status === "supported" && row.configuration.transportFamily === "local-cli"
      ? row.configuration
      : null;
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
  transportFamily: SetupTransportFamily | null,
  credential?: WriteOnlySecretInput,
): ClientConfigurationInput | null {
  if (transportFamily === "hosted-api") return buildHostedInput(row, credential);
  if (transportFamily === "local-http") return buildLocalHttpInput(row);
  if (transportFamily === "local-cli") return buildLocalCliInput(row);
  return null;
}

/**
 * The notice a save accepts is always the supported product's own notice: a
 * removed record carries no notices to accept, so it cannot be set up.
 */
export function buildSetupAcknowledgement(row: ProviderListRow): AcceptedAcknowledgement {
  if (row.product.status !== "supported") {
    throw new Error(`Product ${row.product.productId} is not supported for setup`);
  }
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
  if (resolveSetupTransportFamily(row) !== "local-http") {
    return "Local HTTP setup does not use API credentials.";
  }
  const product = row.product.status === "supported" ? row.product : null;
  let endpoint: string | undefined;
  if (
    row.configuration?.status === "supported" &&
    row.configuration.transportFamily === "local-http"
  ) {
    endpoint = row.configuration.endpoint;
  } else if (product?.transportFamily === "local-http") {
    endpoint = product.endpoints[0]?.endpoint;
  }
  return `Configure the local endpoint at ${endpoint ?? "the selected loopback URL"} without storing hosted credentials.`;
}

function getLocalCliCopy(row: ProviderListRow): string {
  const productIsLocalCli =
    row.product.status === "supported" && row.product.transportFamily === "local-cli";
  if (resolveSetupTransportFamily(row) !== "local-cli" && !productIsLocalCli) {
    return "Local CLI setup does not use API credentials.";
  }
  return "Configure the local CLI installation without storing hosted credentials.";
}

/** The line a setup surface leads with, in the vocabulary of its transport. */
export function getSetupLayoutCopy(
  row: ProviderListRow,
  transportFamily: SetupTransportFamily | null,
): string {
  if (transportFamily === "hosted-api") {
    return `Choose how to provide credentials for ${row.product.name}:`;
  }
  if (transportFamily === "local-http") {
    return getLocalHttpCopy(row);
  }
  return getLocalCliCopy(row);
}
