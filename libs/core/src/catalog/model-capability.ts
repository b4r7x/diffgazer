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
 * True unless the model declares an output modality that lacks "text" — audio
 * (TTS), image, or video-only models that can never emit a review object.
 */
export function producesTextOutput(model: ModelsDevModel): boolean {
  const output = model.modalities?.output;
  return !output || output.includes("text");
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
