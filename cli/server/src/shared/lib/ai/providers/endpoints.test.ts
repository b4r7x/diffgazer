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

const QWEN_ENDPOINT = "https://dashscope-intl.aliyuncs.com/compatible-mode/v1";
const GROQ_ENDPOINT = "https://api.groq.com/openai/v1";
const MOONSHOT_MAINLAND = "https://api.moonshot.cn/v1";
const MOONSHOT_INTERNATIONAL = "https://api.moonshot.ai/v1";

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
      productId: "moonshot",
      endpoint: GROQ_ENDPOINT,
      region: "mainland",
    });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe("tuple-mismatch");
  });

  it("rejects cross-region hosted endpoint tuples before secret resolution", () => {
    const result = resolveHostedApiEndpoint({
      productId: "moonshot",
      endpoint: MOONSHOT_MAINLAND,
      region: "international",
    });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe("cross-region");
  });

  it("rejects cross-workspace hosted endpoint tuples before secret resolution", () => {
    const missingWorkspace = resolveHostedApiEndpoint({
      productId: "qwen",
      endpoint: QWEN_ENDPOINT,
      region: "international",
    });
    expect(missingWorkspace.ok).toBe(false);
    if (missingWorkspace.ok) return;
    expect(missingWorkspace.error.code).toBe("cross-workspace");

    const unexpectedWorkspace = resolveHostedApiEndpoint({
      productId: "groq",
      endpoint: GROQ_ENDPOINT,
      workspace: "workspace-reference",
    });
    expect(unexpectedWorkspace.ok).toBe(false);
    if (unexpectedWorkspace.ok) return;
    expect(unexpectedWorkspace.error.code).toBe("cross-workspace");
  });

  it("accepts exact hosted product and region endpoint tuples", () => {
    const moonshotMainland = resolveHostedApiEndpoint({
      productId: "moonshot",
      endpoint: MOONSHOT_MAINLAND,
      region: "mainland",
    });
    expect(moonshotMainland.ok).toBe(true);
    if (!moonshotMainland.ok) return;
    expect(moonshotMainland.value.region).toBe("mainland");

    const moonshotInternational = resolveHostedApiEndpoint({
      productId: "moonshot",
      endpoint: MOONSHOT_INTERNATIONAL,
      region: "international",
    });
    expect(moonshotInternational.ok).toBe(true);

    const qwen = resolveHostedApiEndpoint({
      productId: "qwen",
      endpoint: QWEN_ENDPOINT,
      region: "international",
      workspace: "workspace-reference",
    });
    expect(qwen.ok).toBe(true);
    if (!qwen.ok) return;
    expect(qwen.value.workspace).toBe("workspace-reference");
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
