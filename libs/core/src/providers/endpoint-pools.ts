import { PROVIDER_OVERLAY } from "../catalog/provider-overlay.js";
import type { ModelInfo } from "../schemas/config/models.js";
import type { RunnableProductId } from "../schemas/config/product-ids.js";
import { getHostedApiEndpointTuple } from "../schemas/config/transports.js";
import { type EndpointProfile, PRODUCT_ENDPOINT_TUPLES } from "./product-endpoints.js";

export function getEndpointProfile(
  productId: RunnableProductId,
  endpoint: string,
): EndpointProfile | null {
  return getHostedApiEndpointTuple(productId, endpoint) ?? null;
}

export interface EndpointPoolContext {
  readonly bound: EndpointProfile;
  readonly sibling: EndpointProfile;
  readonly boundSourceId: string;
  readonly siblingSourceId: string;
}

function findProfile(productId: RunnableProductId, profileId: string): EndpointProfile | null {
  return PRODUCT_ENDPOINT_TUPLES[productId].find((profile) => profile.id === profileId) ?? null;
}

function siblingProfileId(
  endpointSources: Readonly<Record<string, string>>,
  boundProfileId: string,
): string | null {
  if (!(boundProfileId in endpointSources)) return null;
  return Object.keys(endpointSources).find((id) => id !== boundProfileId) ?? null;
}

export function getEndpointPoolContext(
  productId: RunnableProductId,
  endpoint: string,
): EndpointPoolContext | null {
  const endpointSources = PROVIDER_OVERLAY[productId]?.endpointSources;
  if (!endpointSources) return null;

  const bound = getEndpointProfile(productId, endpoint);
  if (!bound) return null;

  const siblingId = siblingProfileId(endpointSources, bound.id);
  if (siblingId === null) return null;

  const sibling = findProfile(productId, siblingId);
  const boundSourceId = endpointSources[bound.id];
  const siblingSourceId = endpointSources[siblingId];
  if (!sibling || boundSourceId === undefined || siblingSourceId === undefined) return null;

  return { bound, sibling, boundSourceId, siblingSourceId };
}

/**
 * The pool a row will bill. A model exactly one pool serves always bills that
 * pool, so the row's badge is the authority and the picker's pool selector only
 * decides the rows both pools serve. Unknown membership follows the armed pool,
 * which defaults to the one the configuration is already bound to. Null off a
 * dual-pool product, where a row has no pool to name. Callers hold a nullable
 * context, so this takes one.
 */
export function getModelBillingPool(
  context: EndpointPoolContext | null,
  model: ModelInfo,
  armedProfileId?: string,
): EndpointProfile | null {
  if (!context) return null;
  const { bound, sibling } = context;
  const membership = model.endpointProfileIds ?? [];
  const onBound = membership.includes(bound.id);
  const onSibling = membership.includes(sibling.id);
  if (onBound && !onSibling) return bound;
  if (onSibling && !onBound) return sibling;
  return armedProfileId === sibling.id ? sibling : bound;
}

/**
 * The endpoint a `select` action must carry for this row, or undefined when the
 * row already bills the bound pool and the write must leave the endpoint alone.
 * Every surface that writes a model — both pickers and the onboarding wizard —
 * goes through this, so the wallet a badge names is the wallet the save moves.
 */
export function resolveSelectEndpoint({
  context,
  model,
  armedProfileId,
  boundEndpoint,
}: {
  context: EndpointPoolContext | null;
  model: ModelInfo;
  armedProfileId?: string;
  boundEndpoint: string;
}): string | undefined {
  const billingPool = getModelBillingPool(context, model, armedProfileId);
  if (!billingPool || billingPool.endpoint === boundEndpoint) return undefined;
  return billingPool.endpoint;
}

/**
 * The pool a picker's selector arms next; a pool context holds exactly two.
 * Nothing armed yet means the bound pool, so the flip lands on the sibling.
 */
export function nextArmedPoolId(
  context: EndpointPoolContext,
  armedProfileId: string | undefined,
): string {
  return armedProfileId === context.sibling.id ? context.bound.id : context.sibling.id;
}

/**
 * The short badge a pool renders as, falling back to the full label for a
 * profile that publishes no short one. Undefined off a dual-pool product, so it
 * composes with `getModelBillingPool` straight into an optional badge prop; a
 * caller holding a profile gets a plain string, so a badge row can never print
 * "undefined".
 */
export function poolBadgeLabel(profile: EndpointProfile): string;
export function poolBadgeLabel(profile: EndpointProfile | null): string | undefined;
export function poolBadgeLabel(profile: EndpointProfile | null): string | undefined {
  return profile ? (profile.shortLabel ?? profile.label) : undefined;
}

/**
 * The picker's one line about a selection that will move the wallet. Names the
 * pool, never a price: the per-token cost is identical across pools for almost
 * every shared model. Takes the pool the checked row will actually bill — the
 * badge, not the toggle — so a single-pool row never promises a move it will
 * not make. Null while that pool is the bound one.
 */
export function getPoolBillingChangeNote(
  context: EndpointPoolContext | null,
  billingProfileId: string | undefined,
): string | null {
  if (!context || billingProfileId !== context.sibling.id) return null;
  return `Saving moves billing to ${context.sibling.label}.`;
}
