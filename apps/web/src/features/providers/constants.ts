export { INPUT_METHODS, type InputMethod } from "@/types/input-method";

export const TIER_FILTERS = ["all", "free", "paid"] as const;
export type TierFilter = (typeof TIER_FILTERS)[number];

export const PROVIDER_FILTERS = ["all", "configured", "needs-key", "free", "paid"] as const;
export type ProviderFilter = (typeof PROVIDER_FILTERS)[number];

export const PROVIDER_FILTER_LABELS: { value: ProviderFilter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "configured", label: "Configured" },
  { value: "needs-key", label: "Needs Key" },
  { value: "free", label: "Free" },
  { value: "paid", label: "Paid" },
];

export const PROVIDER_FILTER_VALUES: ProviderFilter[] = PROVIDER_FILTER_LABELS.map((f) => f.value);
