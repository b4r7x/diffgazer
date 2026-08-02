import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { PRODUCT_REGISTRY } from "@diffgazer/core/providers";
import {
  CANDIDATE_PRODUCT_IDS,
  type LOCAL_HTTP_PRODUCT_IDS,
  REMOVED_PRODUCT_IDS,
  RUNNABLE_PRODUCT_IDS,
  type RunnableProductId,
} from "@diffgazer/core/schemas/config";
import type { TerminalOutcome } from "@diffgazer/core/schemas/review";
import type {
  Adapter,
  AdapterRegistry,
  SafeAdapterIdentity,
  SafeAdapterProductNotice,
} from "../types.js";
import { getSafeAdapterIdentity, getSafeAdapterProductNotice } from "../types.js";
import {
  type CliCompatibilityRecord,
  type CliCompatibilityTuple,
  matchCliCompatibilityTuple,
  parseCliCompatibilityRecord,
} from "./cli-compatibility.js";
import { createCodexCliAdapter } from "./codex-cli.js";
import { createCopilotCliAdapter } from "./copilot-cli.js";
import { HOSTED_ADAPTERS } from "./hosted.js";
import { localOpenaiAdapter, ollamaAdapter } from "./local-http.js";

export type { Adapter } from "../types.js";

/** Wired adapters fail closed until admission supplies matching runtime evidence. */
export const FAIL_CLOSED_ADAPTER_OUTCOME = "transport-failed" as const satisfies TerminalOutcome;

export const LOCAL_HTTP_ADAPTERS = {
  ollama: ollamaAdapter,
  "local-openai": localOpenaiAdapter,
} as const satisfies Record<(typeof LOCAL_HTTP_PRODUCT_IDS)[number], Adapter>;

function loadBundledCliCompatibilityRecords(): readonly CliCompatibilityRecord[] {
  const fixturePath = path.join(
    path.dirname(fileURLToPath(import.meta.url)),
    "fixtures/cli-compatibility/compatibility-records.json",
  );
  const bundle = JSON.parse(readFileSync(fixturePath, "utf8")) as { records?: unknown[] };
  const records: CliCompatibilityRecord[] = [];
  for (const entry of bundle.records ?? []) {
    const parsed = parseCliCompatibilityRecord(entry);
    if (parsed.ok) {
      records.push(parsed.value);
    }
  }
  return records;
}

const BUNDLED_CLI_COMPATIBILITY_RECORDS = loadBundledCliCompatibilityRecords();

async function resolveBundledCliCompatibilityRecord(
  tuple: CliCompatibilityTuple,
): Promise<CliCompatibilityRecord | null> {
  for (const record of BUNDLED_CLI_COMPATIBILITY_RECORDS) {
    if (matchCliCompatibilityTuple(record, tuple).matched) {
      return record;
    }
  }
  return null;
}

export const CLI_ADAPTERS = {
  "codex-cli": createCodexCliAdapter({
    resolveCompatibilityRecord: resolveBundledCliCompatibilityRecord,
  }),
  "copilot-cli": createCopilotCliAdapter({
    resolveCompatibilityRecord: resolveBundledCliCompatibilityRecord,
  }),
} as const satisfies Record<"codex-cli" | "copilot-cli", Adapter>;

let resolvedAdapterRegistry: AdapterRegistry | undefined;

function resolveAdapterRegistry(): AdapterRegistry {
  if (resolvedAdapterRegistry === undefined) {
    resolvedAdapterRegistry = {
      ...HOSTED_ADAPTERS,
      ...LOCAL_HTTP_ADAPTERS,
      ...CLI_ADAPTERS,
    };
    validateAdapterRegistry(resolvedAdapterRegistry);
  }
  return resolvedAdapterRegistry;
}

export const ADAPTER_REGISTRY = new Proxy({} as AdapterRegistry, {
  get(_target, property) {
    if (typeof property !== "string") {
      return undefined;
    }
    return resolveAdapterRegistry()[property as RunnableProductId];
  },
  has(_target, property) {
    return (RUNNABLE_PRODUCT_IDS as readonly string[]).includes(String(property));
  },
  ownKeys() {
    return [...RUNNABLE_PRODUCT_IDS];
  },
  getOwnPropertyDescriptor(_target, property) {
    if (!(RUNNABLE_PRODUCT_IDS as readonly string[]).includes(String(property))) {
      return undefined;
    }
    return {
      configurable: true,
      enumerable: true,
      value: resolveAdapterRegistry()[property as RunnableProductId],
    };
  },
});

export function isRunnableAdapterProductId(productId: string): productId is RunnableProductId {
  return (RUNNABLE_PRODUCT_IDS as readonly string[]).includes(productId);
}

export function isForbiddenAdapterProductId(productId: string): boolean {
  return (
    (REMOVED_PRODUCT_IDS as readonly string[]).includes(productId) ||
    (CANDIDATE_PRODUCT_IDS as readonly string[]).includes(productId)
  );
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

  for (const key of keys) {
    if (!isRunnableAdapterProductId(key)) {
      continue;
    }
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
  return resolveAdapterRegistry()[productId];
}

export function listRunnableAdapterIdentities(): SafeAdapterIdentity[] {
  const registry = resolveAdapterRegistry();
  return RUNNABLE_PRODUCT_IDS.map((productId) => getSafeAdapterIdentity(registry[productId]));
}

export function listRunnableAdapterNotices(): SafeAdapterProductNotice[] {
  return RUNNABLE_PRODUCT_IDS.map((productId) => getSafeAdapterProductNotice(productId));
}

export function bundledCliCompatibilityRecordCount(): number {
  return BUNDLED_CLI_COMPATIBILITY_RECORDS.length;
}
