import type { ModelsDevModel } from "./schema.js";

/** What a catalog model costs, derived from published per-model pricing only. */
export type ModelBilling = "free" | "paid" | "unknown";

/** A product's billing across the models a picker can actually offer. */
export type CatalogBillingRange = ModelBilling | "mixed";

/** What the bounded catalog knows about one offerable model. */
export interface DerivedCatalogModel {
  readonly name: string;
  readonly billing: ModelBilling;
}

/**
 * True unless the declared output modalities disqualify the model from
 * emitting a review object: no "text" at all (TTS, image, or video-only), or
 * a non-text modality alongside text without an explicit
 * `structured_output: true` — image-generation models declare
 * `output: ["text", "image"]` yet cannot honor a schema-constrained review.
 * Absent output modalities still count as text.
 */
export function producesTextOutput(model: ModelsDevModel): boolean {
  const output = model.modalities?.output;
  if (!output) return true;
  if (!output.includes("text")) return false;
  return output.every((modality) => modality === "text") || model.structured_output === true;
}

export function getModelBilling(model: ModelsDevModel): ModelBilling {
  if (!model.cost) return "unknown";
  return model.cost.input === 0 && model.cost.output === 0 ? "free" : "paid";
}

/**
 * The billing range a product earns across the models it can actually offer.
 * Unpriced models abstain rather than vote: a price nobody published is not
 * evidence of either tier, so it neither creates nor blocks a range.
 */
export function getCatalogBillingRange(billings: readonly ModelBilling[]): CatalogBillingRange {
  const hasFree = billings.includes("free");
  const hasPaid = billings.includes("paid");
  if (hasFree && hasPaid) return "mixed";
  if (hasFree) return "free";
  if (hasPaid) return "paid";
  return "unknown";
}
