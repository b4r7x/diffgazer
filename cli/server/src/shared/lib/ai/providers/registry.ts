import { PRODUCT_REGISTRY } from "@diffgazer/core/providers";
import {
  CANDIDATE_PRODUCT_IDS,
  RUNNABLE_PRODUCT_IDS,
  type RunnableProductId,
} from "@diffgazer/core/schemas/config";
import type { TerminalOutcome } from "@diffgazer/core/schemas/review";
import type { Adapter, AdapterRegistry } from "../types.js";
import { HOSTED_ADAPTERS } from "./hosted/transport.js";

export type { Adapter } from "../types.js";

/** Wired adapters fail closed until admission supplies matching runtime evidence. */
export const FAIL_CLOSED_ADAPTER_OUTCOME = "transport-failed" as const satisfies TerminalOutcome;

function buildAdapterRegistry(): AdapterRegistry {
  const registry = { ...HOSTED_ADAPTERS };
  validateAdapterRegistry(registry);
  return registry;
}

export const ADAPTER_REGISTRY: AdapterRegistry = Object.freeze(buildAdapterRegistry());

function isRunnableAdapterProductId(productId: string): productId is RunnableProductId {
  return (RUNNABLE_PRODUCT_IDS as readonly string[]).includes(productId);
}

export function isForbiddenAdapterProductId(productId: string): boolean {
  return (CANDIDATE_PRODUCT_IDS as readonly string[]).includes(productId);
}

export function validateAdapterRegistry(
  registry: Record<string, Adapter>,
): asserts registry is AdapterRegistry {
  const keys = Object.keys(registry);
  const routes = new Set<RunnableProductId>();

  for (const key of keys) {
    if (!isRunnableAdapterProductId(key)) {
      throw new Error(`Forbidden adapter registry key: ${key}`);
    }
  }

  for (const expected of RUNNABLE_PRODUCT_IDS) {
    if (!(expected in registry)) {
      throw new Error(`Missing adapter for runnable product: ${expected}`);
    }
  }

  if (keys.length !== RUNNABLE_PRODUCT_IDS.length) {
    throw new Error(`Adapter registry must contain exactly ${RUNNABLE_PRODUCT_IDS.length} entries`);
  }

  for (const key of keys as RunnableProductId[]) {
    const adapter = registry[key];
    if (adapter === undefined) {
      throw new Error(`Missing adapter for runnable product: ${key}`);
    }
    if (adapter.productId !== key) {
      throw new Error(`Adapter route mismatch: key=${key} productId=${adapter.productId}`);
    }
    if (routes.has(adapter.productId)) {
      throw new Error(`Duplicate adapter route: ${adapter.productId}`);
    }
    routes.add(adapter.productId);

    const expectedFamily = PRODUCT_REGISTRY[adapter.productId].transportFamily;
    if (adapter.transportFamily !== expectedFamily) {
      throw new Error(`Adapter transport mismatch for ${adapter.productId}`);
    }
  }
}

export function getAdapter(productId: string): Adapter {
  if (isForbiddenAdapterProductId(productId)) {
    throw new Error(`Adapter unavailable for forbidden product: ${productId}`);
  }
  if (!isRunnableAdapterProductId(productId)) {
    throw new Error(`Adapter unavailable for unknown product: ${productId}`);
  }
  return ADAPTER_REGISTRY[productId];
}
