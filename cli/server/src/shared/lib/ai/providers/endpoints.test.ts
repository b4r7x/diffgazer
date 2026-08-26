import { describe, expect, it } from "vitest";
import { boundedFetchInit, DISABLE_REDIRECTS, resolveHostedApiEndpoint } from "./endpoints.js";

const OPENROUTER_ENDPOINT = "https://openrouter.ai/api/v1";
const ZAI_ENDPOINT = "https://api.z.ai/api/paas/v4";
const OPENCODE_ZEN_ENDPOINT = "https://opencode.ai/zen/v1";

describe("resolveHostedApiEndpoint", () => {
  it("rejects http hosted endpoints before secret resolution", () => {
    const result = resolveHostedApiEndpoint({
      productId: "openrouter",
      endpoint: "http://openrouter.ai/api/v1",
    });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe("http-hosted-forbidden");
  });

  it("rejects user-info in hosted endpoints before secret resolution", () => {
    const result = resolveHostedApiEndpoint({
      productId: "openrouter",
      endpoint: "https://user:secret@openrouter.ai/api/v1",
    });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe("user-info-forbidden");
  });

  it("rejects lookalike hosted endpoints before secret resolution", () => {
    const result = resolveHostedApiEndpoint({
      productId: "openrouter",
      endpoint: "https://openrouter.ai.evil.example/api/v1",
    });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe("lookalike-endpoint");
  });

  it("rejects unexpected port hosted endpoints before secret resolution", () => {
    const result = resolveHostedApiEndpoint({
      productId: "openrouter",
      endpoint: "https://openrouter.ai:8443/api/v1",
    });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe("unexpected-port");
  });

  it("rejects unexpected path hosted endpoints before secret resolution", () => {
    const result = resolveHostedApiEndpoint({
      productId: "openrouter",
      endpoint: "https://openrouter.ai/api/v1/../v1",
    });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe("unexpected-path");
  });

  it("rejects unexpected query hosted endpoints before secret resolution", () => {
    const result = resolveHostedApiEndpoint({
      productId: "openrouter",
      endpoint: "https://openrouter.ai/api/v1?debug=1",
    });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe("query-forbidden");
  });

  it("rejects fragment-forbidden on hosted endpoints before secret resolution", () => {
    const result = resolveHostedApiEndpoint({
      productId: "openrouter",
      endpoint: "https://openrouter.ai/api/v1#section",
    });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe("fragment-forbidden");
  });

  it("rejects tuple-mismatch for valid HTTPS endpoints on the wrong product before secret resolution", () => {
    const result = resolveHostedApiEndpoint({
      productId: "zai",
      endpoint: OPENROUTER_ENDPOINT,
    });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe("tuple-mismatch");
  });

  it("accepts exact hosted product endpoint tuples", () => {
    const openrouter = resolveHostedApiEndpoint({
      productId: "openrouter",
      endpoint: OPENROUTER_ENDPOINT,
    });
    expect(openrouter.ok).toBe(true);
    if (!openrouter.ok) return;
    expect(openrouter.value.endpoint).toBe(OPENROUTER_ENDPOINT);
    expect(openrouter.value.productId).toBe("openrouter");

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
