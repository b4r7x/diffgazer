import { CATALOG_SNAPSHOT } from "@diffgazer/core/catalog";
import { type EndpointPoolContext, getEndpointPoolContext } from "@diffgazer/core/providers";
import type { ConfigurationId, HostedApiProductId } from "@diffgazer/core/schemas/config";
import { readCachedLiveModelList } from "../../live-model-lists.js";
import type { FailureCopyOptions } from "./failure-classification.js";

export interface PoolFailureInput {
  readonly productId: HostedApiProductId;
  readonly configurationId: ConfigurationId;
  readonly endpoint: string;
  readonly modelId: string;
  readonly status: number;
}

export interface PoolFailureCopy extends FailureCopyOptions {
  readonly poolLabel: string;
}

/**
 * Statuses whose fix can be "use the other pool": the model is absent from this
 * pool, the pool's wallet is spent, or the key is not entitled to it. A plain
 * 429 is pacing, not a pool verdict, so it carries the sibling no further than
 * this map — the classification's 429 branch keeps its wait-and-retry copy.
 */
const CROSS_POOL_STATUSES = new Set([402, 403, 404, 429]);

/**
 * Read-only membership: the sibling list the picker's own discovery already
 * cached, else the bundled catalog. A dispatch that just failed must not spend
 * a network round trip — let alone a paid one — to learn where else the model
 * lives, so an unwarmed cache and an unknown id both simply say nothing.
 */
function siblingServesModel(context: EndpointPoolContext, input: PoolFailureInput): boolean {
  const cached = readCachedLiveModelList({
    kind: "configuration",
    configurationId: input.configurationId,
    productId: input.productId,
    endpointProfileId: context.sibling.id,
  });
  if (cached) return cached.models.some((model) => model.id === input.modelId);
  return Object.hasOwn(CATALOG_SNAPSHOT[context.siblingSourceId]?.models ?? {}, input.modelId);
}

/**
 * The failure copy a dual-pool configuration earns: the bound pool's own name,
 * plus the sibling pool as a remedy when that pool is positively known to serve
 * the same model — offering a switch to a pool without this model would send
 * the user to a picker that cannot honour it. Null for every product without a
 * pool sibling — those failures read exactly as they always have.
 */
export function describePoolFailure(input: PoolFailureInput): PoolFailureCopy | null {
  const context = getEndpointPoolContext(input.productId, input.endpoint);
  if (!context) return null;

  const poolLabel = context.bound.label;
  if (!CROSS_POOL_STATUSES.has(input.status)) return { poolLabel };
  if (!siblingServesModel(context, input)) return { poolLabel };
  return { poolLabel, siblingLabel: context.sibling.label };
}
