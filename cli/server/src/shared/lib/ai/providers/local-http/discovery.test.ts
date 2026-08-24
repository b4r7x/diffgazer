import { LOCAL_OPENAI_PRESET_ENDPOINTS } from "@diffgazer/core/schemas/config";
import { describe, expect, it, vi } from "vitest";
import type { DnsLookupFn } from "../endpoints.js";
import {
  generateLocalHttpObject,
  probeLocalHttpConformance,
  reviewResultJsonSchema,
} from "./discovery.js";
import type { LocalHttpFetch } from "./request.js";

const OLLAMA_ENDPOINT = "http://127.0.0.1:11434";
const LLAMA_CPP_ENDPOINT = LOCAL_OPENAI_PRESET_ENDPOINTS["llama-cpp"];
const SCHEMA_SHA256 = "1".repeat(64);

function lookupLoopback(): DnsLookupFn {
  return async () => [{ address: "127.0.0.1", family: 4 }];
}

function jsonResponse(body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}

type FetchInput = Parameters<LocalHttpFetch>[0];

function fetchInputUrl(input: FetchInput): string {
  if (typeof input === "string") return input;
  if (input instanceof URL) return input.toString();
  return input.url;
}

/** Records the first generation body and answers every listing/chat route. */
function createRecordingFetch(sentBodies: Array<Record<string, unknown>>) {
  return vi.fn(async (input: FetchInput, init?: RequestInit) => {
    const url = fetchInputUrl(input);
    if (init?.method === "POST") {
      sentBodies.push(JSON.parse(String(init.body)) as Record<string, unknown>);
      return jsonResponse(
        url.includes("/api/chat")
          ? { message: { content: '{"issues":[]}' } }
          : { choices: [{ message: { content: '{"issues":[]}' } }] },
      );
    }
    if (url.includes("/api/version")) return jsonResponse({ version: "0.6.0" });
    if (url.includes("/api/tags")) return jsonResponse({ models: [{ name: "llama3.2" }] });
    return jsonResponse({
      object: "list",
      server_version: "b-version-2026-07",
      data: [{ id: "local-model" }],
    });
  });
}

describe("local HTTP probe output ceiling", () => {
  it.each([
    ["ollama", OLLAMA_ENDPOINT, "llama3.2", (body: Record<string, unknown>) => body.options],
    [
      "local-openai",
      LLAMA_CPP_ENDPOINT,
      "local-model",
      (body: Record<string, unknown>) => body.max_tokens,
    ],
  ] as const)("stops the %s conformance probe at 256 output tokens", async (productId, endpoint, modelId, readCap) => {
    const sentBodies: Array<Record<string, unknown>> = [];
    const probe = await probeLocalHttpConformance(
      {
        productId,
        endpoint,
        modelId,
        auth: { authentication: "none" },
        structuredOutputSchemaSha256: SCHEMA_SHA256,
      },
      { fetch: createRecordingFetch(sentBodies), lookup: lookupLoopback() },
    );

    expect(probe.ok).toBe(true);
    const probeBody = sentBodies[0];
    expect(probeBody).toBeDefined();
    const cap = readCap(probeBody ?? {});
    expect(productId === "ollama" ? (cap as { num_predict?: number })?.num_predict : cap).toBe(256);
  });

  it.each([
    ["ollama", OLLAMA_ENDPOINT, "llama3.2", (body: Record<string, unknown>) => body.options],
    [
      "local-openai",
      LLAMA_CPP_ENDPOINT,
      "local-model",
      (body: Record<string, unknown>) => body.max_tokens,
    ],
  ] as const)("sends no output ceiling on a %s review generation", async (productId, endpoint, modelId, readCap) => {
    const sentBodies: Array<Record<string, unknown>> = [];
    const generation = await generateLocalHttpObject({
      productId,
      endpoint,
      modelId,
      prompt: "review this diff",
      auth: { authentication: "none" },
      fetcher: createRecordingFetch(sentBodies) as unknown as LocalHttpFetch,
      maxResponseBytes: 1_048_576,
      schema: reviewResultJsonSchema(),
    });

    expect(generation.ok).toBe(true);
    const generationBody = sentBodies[0];
    expect(generationBody).toBeDefined();
    expect(readCap(generationBody ?? {})).toBeUndefined();
  });
});
