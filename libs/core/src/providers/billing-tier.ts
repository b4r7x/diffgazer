import type { RunnableProductId } from "../schemas/config/transports.js";
import type { BadgeVariant } from "../schemas/presentation/index.js";
import { type BillingMode, PRODUCT_REGISTRY } from "./product-registry.js";

/**
 * What a product costs the person running it. Local transports are their own
 * tiers because "paid" is a claim about someone's bill: a model running on the
 * user's own machine bills nobody, and a CLI riding an existing subscription
 * bills whatever that subscription already does.
 */
export type BillingTier = "free" | "paid" | "local" | "ambient";

interface BillingTierBadge {
  readonly label: string;
  readonly variant: BadgeVariant;
}

export const BILLING_TIER_BADGES = {
  free: { label: "FREE", variant: "success" },
  paid: { label: "PAID", variant: "neutral" },
  local: { label: "LOCAL", variant: "info" },
  ambient: { label: "AMBIENT", variant: "info" },
} as const satisfies Record<BillingTier, BillingTierBadge>;

export function getBillingTier(productId: RunnableProductId): BillingTier {
  const product = PRODUCT_REGISTRY[productId];
  if (product.transportFamily === "local-http") return "local";
  if (product.transportFamily === "local-cli") return "ambient";
  // Structured billing modes are the authority; notice prose describes free
  // tiers it does not offer and omits ones it does.
  const modes: readonly BillingMode[] = product.billing.modes;
  return modes.includes("free-tier") ? "free" : "paid";
}
