/**
 * OpenRouter accepts routing selectors in the same model-id-shaped slot as a
 * downstream provider/model pair.  Those selectors are not immutable execution
 * identities and must be rejected at every model-policy boundary.
 *
 * A pinned variant suffix is the opposite case and is admitted: `:free` and
 * `:thinking` name separately priced catalog entries carrying their own display
 * name, limits, and price, so the suffix is part of an identity rather than an
 * instruction.  Dynamic selectors — `openrouter/auto`, `:nitro`, `:floor`,
 * `:online`, `:exacto` — are request-time sort or route directives and stay
 * rejected.
 *
 * Keep this policy authority shared so admission, client projection, onboarding,
 * and discovery cannot drift apart.
 */
const PINNED_DOWNSTREAM_ROUTE_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._-]*\/[A-Za-z0-9][A-Za-z0-9._-]*$/;

/**
 * Suffixes that name a distinct catalog identity rather than a routing
 * instruction.  Unknown suffixes fail closed, so admitting a new variant stays a
 * deliberate decision instead of an accident of pattern shape.
 */
const PINNED_DOWNSTREAM_ROUTE_VARIANTS = new Set(["free", "thinking"]);
const PINNED_DOWNSTREAM_ROUTE_RESERVED_SEGMENTS = new Set([
  "auto",
  "automatic",
  "cheapest",
  "default",
  "exacto",
  "extended",
  "fallback",
  "fastest",
  "floor",
  "free",
  "nitro",
  "online",
  "openrouter",
  "random",
  "route",
  "thinking",
]);

/**
 * Returns true only for one exact downstream provider/model pair, optionally
 * carrying a single pinned variant suffix.  Reserved selectors are compared by
 * segment, so legitimate names that merely contain a selector (for example,
 * `automaticity/model`) remain valid.
 */
export function isPinnedDownstreamRouteModelId(modelId: string): boolean {
  const [base = "", variant, ...extraVariants] = modelId.split(":");
  if (extraVariants.length > 0) return false;
  if (variant !== undefined && !PINNED_DOWNSTREAM_ROUTE_VARIANTS.has(variant.toLowerCase())) {
    return false;
  }
  if (!PINNED_DOWNSTREAM_ROUTE_PATTERN.test(base)) return false;

  const [downstreamProvider = "", downstreamModel = ""] = base.split("/");
  return ![downstreamProvider, downstreamModel].some((segment) =>
    PINNED_DOWNSTREAM_ROUTE_RESERVED_SEGMENTS.has(segment.toLowerCase()),
  );
}

export const BILLING_MODES = [
  "free-tier",
  "pay-as-you-go",
  "route-specific",
  "local-resource",
  "subscription-credit",
] as const;
export type BillingMode = (typeof BILLING_MODES)[number];

export type AdmissionCheck =
  | "credential"
  | "endpoint"
  | "model-discovery"
  | "downstream-route"
  | "structured-output"
  | "usage"
  | "acknowledgement";

export const CONFIGURATION_FIELDS = ["credential", "endpoint"] as const;
export type ConfigurationField = (typeof CONFIGURATION_FIELDS)[number];

export type ModelPolicy =
  | {
      readonly kind: "discovered-exact";
      readonly suggestedModelId?: string;
      readonly aliases: "forbidden";
    }
  | {
      readonly kind: "pinned-downstream-route";
      readonly routePolicy: "pinned";
      readonly automaticRouting: "forbidden";
      readonly aliases: "forbidden";
    };

/**
 * The single model-policy predicate.  Every boundary that decides whether a
 * model id is admissible for a product — onboarding, client projection,
 * client-safe summaries, discovery mapping, and the execution tuple — must call
 * this so the interpretations cannot drift apart.
 *
 * Model-id shape validation is deliberately left to the caller, because the
 * applicable shape schema differs per boundary.
 */
export function matchesModelPolicy(modelId: string, policy: ModelPolicy): boolean {
  switch (policy.kind) {
    case "discovered-exact":
      return true;
    case "pinned-downstream-route":
      return isPinnedDownstreamRouteModelId(modelId);
  }
}
