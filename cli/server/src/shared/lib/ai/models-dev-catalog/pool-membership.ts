import type { ModelsDevCatalog } from "@diffgazer/core/catalog";
import { type EndpointPoolContext, getEndpointPoolContext } from "@diffgazer/core/providers";
import type { ConfigurationId, RunnableProductId } from "@diffgazer/core/schemas/config";
import { type LiveModelList, resolveSiblingLiveModelList } from "../live-model-lists.js";

export interface PoolDiscoveryTuple {
  readonly configurationId: ConfigurationId;
  readonly productId: RunnableProductId;
  readonly endpoint: string;
}

export interface PoolMembership {
  readonly boundProfileId: string;
  readonly siblingProfileId: string;
  /** ids in the sibling's live list; null when that fetch/cache was unavailable */
  readonly siblingLiveIds: ReadonlySet<string> | null;
  /** profileId -> raw catalog source model-id set, read per source PRE-dedup */
  readonly catalogIdsByProfile: ReadonlyMap<string, ReadonlySet<string>>;
}

/** A dual-pool configuration's membership inputs: the pool its endpoint binds, and the sibling's list already in flight. */
export interface PoolMembershipRequest {
  readonly context: EndpointPoolContext;
  readonly siblingList: Promise<LiveModelList | null> | null;
}

/**
 * The pool a configuration's endpoint binds, with the sibling pool's list
 * started so it flies alongside the bound one rather than after it. Null for
 * every product without a pool sibling — those configurations issue no second
 * `/models` request. Offline the context still labels rows from the catalog;
 * nothing is fetched.
 */
export const beginPoolMembership = (
  tuple: PoolDiscoveryTuple,
  opts: { readonly offline: boolean },
): PoolMembershipRequest | null => {
  const context = getEndpointPoolContext(tuple.productId, tuple.endpoint);
  if (!context) return null;
  return {
    context,
    siblingList: opts.offline
      ? null
      : resolveSiblingLiveModelList({
          configurationId: tuple.configurationId,
          productId: tuple.productId,
          siblingProfile: context.sibling,
        }),
  };
};

/**
 * Membership evidence for a dual-pool configuration. Catalog membership is read
 * per source from the raw model keys: deduped observations keep only the first
 * source that named an id, so reading their provenance would call every overlap
 * id bound-pool-only.
 */
export const resolvePoolMembership = async (
  request: PoolMembershipRequest,
  catalog: ModelsDevCatalog,
): Promise<PoolMembership> => {
  const { context, siblingList } = request;
  const sibling = siblingList === null ? null : await siblingList;
  const catalogIds = (sourceId: string): ReadonlySet<string> =>
    new Set(Object.keys(catalog[sourceId]?.models ?? {}));

  return {
    boundProfileId: context.bound.id,
    siblingProfileId: context.sibling.id,
    siblingLiveIds: sibling ? new Set(sibling.models.map((model) => model.id)) : null,
    catalogIdsByProfile: new Map([
      [context.bound.id, catalogIds(context.boundSourceId)],
      [context.sibling.id, catalogIds(context.siblingSourceId)],
    ]),
  };
};

/**
 * The profiles positively observed to serve the model, bound first. Every
 * source counts as its own observation, so a live sibling list adds to catalog
 * membership rather than replacing it: were it to replace it, a sibling-only id
 * the sibling's live list has since dropped would read as belonging to neither
 * pool, and the catalog fallback would then offer it on an endpoint that cannot
 * serve it. `undefined` means no source carried the id, which the row reports by
 * omitting the field rather than by claiming absence.
 */
export const endpointProfileIdsForModel = (
  membership: PoolMembership,
  modelId: string,
  opts: { readonly inBoundLiveList: boolean },
): readonly string[] | undefined => {
  const { boundProfileId, siblingProfileId, siblingLiveIds, catalogIdsByProfile } = membership;
  const inCatalog = (profileId: string) =>
    catalogIdsByProfile.get(profileId)?.has(modelId) ?? false;
  const onBound = opts.inBoundLiveList || inCatalog(boundProfileId);
  const onSibling = (siblingLiveIds?.has(modelId) ?? false) || inCatalog(siblingProfileId);

  if (!onBound && !onSibling) return undefined;
  return [...(onBound ? [boundProfileId] : []), ...(onSibling ? [siblingProfileId] : [])];
};
