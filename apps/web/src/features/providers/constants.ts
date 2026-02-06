export const INPUT_METHODS = ["paste", "env"] as const;
export type InputMethod = (typeof INPUT_METHODS)[number];

export const TIER_FILTERS = ["all", "free", "paid"] as const;
export type TierFilter = (typeof TIER_FILTERS)[number];

export const PROVIDER_FILTERS = ["all", "configured", "needs-key", "free", "paid"] as const;
export type ProviderFilter = (typeof PROVIDER_FILTERS)[number];
