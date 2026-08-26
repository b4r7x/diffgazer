import { PROVIDER_DERIVED } from "../catalog/provider-derived.js";
import type { ModelTier } from "../schemas/config/models.js";
import type { RunnableProductId } from "../schemas/config/transports.js";
import type { BadgeVariant } from "../schemas/presentation/index.js";
import type { BillingMode } from "./model-policy.js";
import { PRODUCT_REGISTRY } from "./product-registry.js";

/**
 * What a product costs the person running it. `mixed` is the honest badge
 * for a hosted product selling both zero-priced and priced
 * models — collapsing it to either one misstates the other half of the catalog.
 * `free-tier` is the account-level counterpart: the catalog prices none of the
 * offerable models at zero (they are priced or unpriced), but the product
 * publishes a no-cost quota to run them on.
 */
export type BillingTier = "free" | "paid" | "mixed" | "free-tier";

export interface BillingTierBadge {
  readonly label: string;
  readonly variant: BadgeVariant;
}

export const BILLING_TIER_BADGES = {
  free: { label: "FREE", variant: "success" },
  paid: { label: "PAID", variant: "neutral" },
  mixed: { label: "FREE/PAID", variant: "info" },
  "free-tier": { label: "FREE TIER", variant: "info" },
} as const satisfies Record<BillingTier, BillingTierBadge>;

/** The declared billing modes that let an account run a priced model at no cost. */
const FREE_TIER_BILLING_MODES: readonly BillingMode[] = ["free-tier"];

function declaresFreeTier(productId: RunnableProductId): boolean {
  return PRODUCT_REGISTRY[productId].billing.modes.some((mode) =>
    FREE_TIER_BILLING_MODES.includes(mode),
  );
}

/**
 * Two independent facts decide what a product costs, and the badge has to name
 * whichever is true. A per-model catalog price is the stronger evidence, so it
 * is read first: a product whose offerable models really are zero-priced earns
 * FREE, and one selling both halves earns FREE/PAID. Only when no offerable
 * model is priced at zero does the registry's declared account tier speak, and
 * it may say no more than FREE TIER — a claim about an account's quota, never
 * about a model's price. A registry claim therefore can never produce FREE,
 * which is the safeguard that matters: the badge that could cost a user money.
 * What it stops doing is understating a product's only free on-ramp as PAID.
 */
export function getBillingTier(productId: RunnableProductId): BillingTier {
  const catalogBilling = PROVIDER_DERIVED[productId].billing;
  if (catalogBilling === "free" || catalogBilling === "mixed") return catalogBilling;
  return declaresFreeTier(productId) ? "free-tier" : "paid";
}

/**
 * Whether a badge tier offers some way to run at no cost — either a zero-priced
 * selectable model or a declared account tier the priced models run under.
 */
export function offersFreeModels(tier: BillingTier): boolean {
  return tier === "free" || tier === "mixed" || tier === "free-tier";
}

/**
 * The badge a discovered model wears. An unpriced model gets none: a blank space
 * says "the catalog does not price this" without inventing FREE or PAID for it.
 */
export function getModelTierBadge(tier: ModelTier): BillingTierBadge | null {
  return tier === "unknown" ? null : BILLING_TIER_BADGES[tier];
}
