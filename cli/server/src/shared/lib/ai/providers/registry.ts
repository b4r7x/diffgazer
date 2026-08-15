import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { PRODUCT_REGISTRY } from "@diffgazer/core/providers";
import {
  CANDIDATE_PRODUCT_IDS,
  type LOCAL_HTTP_PRODUCT_IDS,
  RUNNABLE_PRODUCT_IDS,
  type RunnableProductId,
} from "@diffgazer/core/schemas/config";
import type { TerminalOutcome } from "@diffgazer/core/schemas/review";
import type { Adapter, AdapterRegistry } from "../types.js";
import {
  CLI_COMPATIBILITY_GENERATOR_MARKER,
  type CliCompatibilityRecord,
  CliCompatibilityRecordBundleSchema,
  type CliCompatibilityTuple,
  matchCliCompatibilityTuple,
  parseCliCompatibilityRecord,
} from "./cli-compatibility/compat.js";
import { createCodexCliAdapter } from "./codex-cli.js";
import { createCopilotCliAdapter } from "./copilot/cli.js";
import { HOSTED_ADAPTERS } from "./hosted/transport.js";
import { localOpenaiAdapter, ollamaAdapter } from "./local-http/transport.js";

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
  const bundle = CliCompatibilityRecordBundleSchema.safeParse(
    JSON.parse(readFileSync(fixturePath, "utf8")),
  );
  if (!bundle.success) {
    throw new Error(
      `Bundled CLI compatibility records are not a ${CLI_COMPATIBILITY_GENERATOR_MARKER} bundle: ${bundle.error.issues
        .map((issue) => issue.message)
        .join("; ")}`,
    );
  }
  const records: CliCompatibilityRecord[] = [];
  for (const entry of bundle.data.records) {
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

function buildAdapterRegistry(): AdapterRegistry {
  const registry = {
    ...HOSTED_ADAPTERS,
    ...LOCAL_HTTP_ADAPTERS,
    ...CLI_ADAPTERS,
  };
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

export function bundledCliCompatibilityRecordCount(): number {
  return BUNDLED_CLI_COMPATIBILITY_RECORDS.length;
}
