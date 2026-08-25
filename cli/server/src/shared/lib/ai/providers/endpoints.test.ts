import { LOCAL_OPENAI_PRESET_ENDPOINTS } from "@diffgazer/core/schemas/config";
import { describe, expect, it } from "vitest";
import {
  boundedFetchInit,
  DISABLE_REDIRECTS,
  type DnsLookupFn,
  isExactLocalOpenAIPreset,
  resolveHostedApiEndpoint,
  resolveLoopbackHttpEndpoint,
} from "./endpoints.js";

const GROQ_ENDPOINT = "https://api.groq.com/openai/v1";
const DEEPSEEK_ENDPOINT = "https://api.deepseek.com/v1";
const ZAI_ENDPOINT = "https://api.z.ai/api/paas/v4";
const OPENCODE_ZEN_ENDPOINT = "https://opencode.ai/zen/v1";

function lookupResult(
  ...addresses: ReadonlyArray<{ address: string; family: 4 | 6 }>
): DnsLookupFn {
  return async () => addresses;
}

describe("resolveHostedApiEndpoint", () => {
  it("rejects http hosted endpoints before secret resolution", () => {
    const result = resolveHostedApiEndpoint({
      productId: "groq",
      endpoint: "http://api.groq.com/openai/v1",
    });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe("http-hosted-forbidden");
  });

  it("rejects user-info in hosted endpoints before secret resolution", () => {
    const result = resolveHostedApiEndpoint({
      productId: "groq",
      endpoint: "https://user:secret@api.groq.com/openai/v1",
    });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe("user-info-forbidden");
  });

  it("rejects lookalike hosted endpoints before secret resolution", () => {
    const result = resolveHostedApiEndpoint({
      productId: "groq",
      endpoint: "https://api.groq.com.evil.example/openai/v1",
    });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe("lookalike-endpoint");
  });

  it("rejects unexpected port hosted endpoints before secret resolution", () => {
    const result = resolveHostedApiEndpoint({
      productId: "groq",
      endpoint: "https://api.groq.com:8443/openai/v1",
    });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe("unexpected-port");
  });

  it("rejects unexpected path hosted endpoints before secret resolution", () => {
    const result = resolveHostedApiEndpoint({
      productId: "groq",
      endpoint: "https://api.groq.com/openai/v1/../v1",
    });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe("unexpected-path");
  });

  it("rejects unexpected query hosted endpoints before secret resolution", () => {
    const result = resolveHostedApiEndpoint({
      productId: "groq",
      endpoint: "https://api.groq.com/openai/v1?debug=1",
    });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe("query-forbidden");
  });

  it("rejects fragment-forbidden on hosted endpoints before secret resolution", () => {
    const result = resolveHostedApiEndpoint({
      productId: "groq",
      endpoint: "https://api.groq.com/openai/v1#section",
    });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe("fragment-forbidden");
  });

  it("rejects tuple-mismatch for valid HTTPS endpoints on the wrong product before secret resolution", () => {
    const result = resolveHostedApiEndpoint({
      productId: "deepseek",
      endpoint: GROQ_ENDPOINT,
    });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe("tuple-mismatch");
  });

  it("accepts exact hosted product endpoint tuples", () => {
    const deepseek = resolveHostedApiEndpoint({
      productId: "deepseek",
      endpoint: DEEPSEEK_ENDPOINT,
    });
    expect(deepseek.ok).toBe(true);
    if (!deepseek.ok) return;
    expect(deepseek.value.endpoint).toBe(DEEPSEEK_ENDPOINT);
    expect(deepseek.value.productId).toBe("deepseek");

    const zai = resolveHostedApiEndpoint({ productId: "zai", endpoint: ZAI_ENDPOINT });
    expect(zai.ok).toBe(true);

    const zen = resolveHostedApiEndpoint({
      productId: "opencode-zen",
      endpoint: OPENCODE_ZEN_ENDPOINT,
    });
    expect(zen.ok).toBe(true);
    if (!zen.ok) return;
    expect(zen.value.endpoint).toBe(OPENCODE_ZEN_ENDPOINT);
  });

  // OpenCode Zen is the one hosted tuple whose host also serves the vendor's
  // website, so the path is load-bearing: the API lives under /zen/v1 and the
  // site root is not an endpoint.
  it("rejects a hosted host whose site root is not the product's API path", () => {
    const result = resolveHostedApiEndpoint({
      productId: "opencode-zen",
      endpoint: "https://opencode.ai/v1",
    });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe("tuple-mismatch");
  });
});

describe("resolveLoopbackHttpEndpoint", () => {
  it("accepts exact local-openai presets without localhost rewrite", async () => {
    const lmStudio = await resolveLoopbackHttpEndpoint(
      { endpoint: LOCAL_OPENAI_PRESET_ENDPOINTS["lm-studio"] },
      { lookup: lookupResult({ address: "127.0.0.1", family: 4 }) },
    );
    expect(lmStudio.ok).toBe(true);
    if (!lmStudio.ok) return;
    expect(lmStudio.value.endpoint).toBe("http://127.0.0.1:1234/v1");
    expect(isExactLocalOpenAIPreset(lmStudio.value.endpoint, "lm-studio")).toBe(true);

    const llamaCpp = await resolveLoopbackHttpEndpoint(
      { endpoint: LOCAL_OPENAI_PRESET_ENDPOINTS["llama-cpp"] },
      { lookup: lookupResult({ address: "127.0.0.1", family: 4 }) },
    );
    expect(llamaCpp.ok).toBe(true);
    if (!llamaCpp.ok) return;
    expect(llamaCpp.value.endpoint).toBe("http://127.0.0.1:8080/v1");
    expect(isExactLocalOpenAIPreset(llamaCpp.value.endpoint, "llama-cpp")).toBe(true);
  });

  it("preserves localhost without rewriting to 127.0.0.1", async () => {
    const result = await resolveLoopbackHttpEndpoint(
      { endpoint: "http://localhost:11434" },
      {
        lookup: lookupResult({ address: "127.0.0.1", family: 4 }, { address: "::1", family: 6 }),
      },
    );

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.endpoint).toBe("http://localhost:11434");
    expect(result.value.hostname).toBe("localhost");
  });

  it("rejects literal non-loopback addresses before secret resolution", async () => {
    const result = await resolveLoopbackHttpEndpoint(
      { endpoint: "http://192.168.1.2:11434" },
      { lookup: lookupResult({ address: "192.168.1.2", family: 4 }) },
    );

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe("invalid-loopback-endpoint");
  });

  it("rejects DNS non-loopback resolution before secret resolution", async () => {
    const result = await resolveLoopbackHttpEndpoint(
      { endpoint: "http://localhost:11434" },
      { lookup: lookupResult({ address: "93.184.216.34", family: 4 }) },
    );

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe("non-loopback-resolution");
  });

  it("rejects mixed address-family loopback and non-loopback results before secret resolution", async () => {
    const result = await resolveLoopbackHttpEndpoint(
      { endpoint: "http://localhost:11434" },
      {
        lookup: lookupResult(
          { address: "127.0.0.1", family: 4 },
          { address: "2606:2800:220:1:248:1893:25c8:1946", family: 6 },
        ),
      },
    );

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe("mixed-address-family");
  });

  it("rejects dns-resolution-failed when lookup throws before secret resolution", async () => {
    const lookup: DnsLookupFn = async () => {
      throw new Error("ENOTFOUND");
    };

    const result = await resolveLoopbackHttpEndpoint(
      { endpoint: "http://localhost:11434" },
      { lookup },
    );

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe("dns-resolution-failed");
  });

  it("rejects dns-resolution-failed when lookup returns no addresses before secret resolution", async () => {
    const result = await resolveLoopbackHttpEndpoint(
      { endpoint: "http://localhost:11434" },
      { lookup: lookupResult() },
    );

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe("dns-resolution-failed");
  });

  it("rejects aborted DNS resolution before secret resolution", async () => {
    const controller = new AbortController();
    controller.abort();
    const lookup: DnsLookupFn = async () => {
      throw new Error("lookup should not run");
    };

    const result = await resolveLoopbackHttpEndpoint(
      { endpoint: "http://localhost:11434" },
      { lookup, signal: controller.signal },
    );

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe("dns-resolution-failed");
  });
});

describe("boundedFetchInit", () => {
  it("disables redirects for provider transport requests", () => {
    expect(boundedFetchInit().redirect).toBe(DISABLE_REDIRECTS);
    expect(boundedFetchInit({ method: "POST", headers: { "X-Test": "1" } })).toEqual({
      method: "POST",
      headers: { "X-Test": "1" },
      redirect: "error",
    });
  });
});
