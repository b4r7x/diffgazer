import type { z } from "zod";
import { PRODUCT_REGISTRY } from "../../providers/product-registry.js";
import type { ClientConfigurationSummary } from "./provider-config.js";
import type { Readiness } from "./readiness.js";
import type { RunnableProductId } from "./transports.js";

type ConfigurationReadinessPair = {
  readonly configuration: ClientConfigurationSummary;
  readonly readiness: Readiness;
};

function validateAcknowledgementClaims(
  productId: RunnableProductId,
  readiness: Readiness,
  context: Pick<z.RefinementCtx<unknown>, "addIssue">,
): void {
  const acknowledgement = readiness.acknowledgement;
  if (acknowledgement.status === "not-applicable") return;

  const notice = PRODUCT_REGISTRY[productId].notice;
  if (
    acknowledgement.noticeId !== notice.id ||
    acknowledgement.noticeVersion !== notice.noticeVersion
  ) {
    context.addIssue({
      code: "custom",
      message: "Readiness acknowledgement must match the current product notice",
      path: ["readiness", "acknowledgement"],
    });
  }
}

function validateReadyClaims(
  configuration: ClientConfigurationSummary,
  readiness: Readiness,
  context: Pick<z.RefinementCtx<unknown>, "addIssue">,
): void {
  if (readiness.status !== "ready") return;

  const productId = configuration.productId;

  if (configuration.selectedModelId === null) {
    context.addIssue({
      code: "custom",
      message: "Ready metadata requires a selected model",
      path: ["configuration", "selectedModelId"],
    });
  }

  const acknowledgement = readiness.acknowledgement;
  const notice = PRODUCT_REGISTRY[productId].notice;
  if (
    acknowledgement.noticeId !== notice.id ||
    acknowledgement.noticeVersion !== notice.noticeVersion
  ) {
    context.addIssue({
      code: "custom",
      message: "Ready metadata requires acknowledgement of the current product notice",
      path: ["readiness", "acknowledgement"],
    });
  }
}

/**
 * Shared configuration/readiness consistency checks enforced at the HTTP
 * response boundary and reused by client-metadata projection.
 */
export function refineConfigurationReadinessConsistency(
  pair: ConfigurationReadinessPair,
  context: Pick<z.RefinementCtx<unknown>, "addIssue">,
): void {
  const { configuration, readiness } = pair;
  const transportFamily = configuration.transportFamily;

  if (transportFamily === "hosted-api" && readiness.status === "local-conformance-failed") {
    context.addIssue({
      code: "custom",
      message: "Hosted products cannot report local readiness",
      path: ["readiness", "status"],
    });
  }

  if (readiness.status === "unconfigured") {
    context.addIssue({
      code: "custom",
      message: "Configured products cannot be unconfigured",
      path: ["readiness", "status"],
    });
  }

  validateAcknowledgementClaims(configuration.productId, readiness, context);
  validateReadyClaims(configuration, readiness, context);
}
