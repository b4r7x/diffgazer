import { describe, expect, it } from "vitest";
import { ClientConfigurationInputSchema } from "../schemas/config/provider-config.js";
import {
  configuredRow,
  OPENCODE_ZEN_CONFIGURATION,
  unconfiguredRow,
  ZAI_CONFIGURATION,
} from "../testing/provider-fixtures.js";
import { PRODUCT_REGISTRY } from "./product-registry.js";
import {
  buildSetupAcknowledgement,
  buildSetupInput,
  getSetupLayoutCopy,
  toSetupCredential,
} from "./setup-input.js";

/** Hosted products must carry a real endpoint tuple. */
const ENDPOINT_BEARING_PRODUCTS = ["gemini", "opencode-zen"] as const;

describe("buildSetupInput", () => {
  it("saves a hosted product with its registry endpoint and the entered credential", () => {
    const input = buildSetupInput(
      unconfiguredRow("gemini"),
      toSetupCredential("paste", "secret-key"),
    );

    expect(input).toEqual({
      transportFamily: "hosted-api",
      productId: "gemini",
      endpoint: PRODUCT_REGISTRY.gemini.configuration.endpoints[0]?.endpoint,
      credential: { kind: "literal", value: "secret-key" },
    });
  });

  it("defaults moonshot quick setup to the international endpoint", () => {
    const input = buildSetupInput(
      unconfiguredRow("moonshot"),
      toSetupCredential("paste", "secret-key"),
    );

    expect(input.endpoint).toBe("https://api.moonshot.ai/v1");
  });

  it("binds the endpoint the surface chose when creating a multi-endpoint product", () => {
    const input = buildSetupInput(
      unconfiguredRow("opencode-zen"),
      toSetupCredential("paste", "secret-key"),
      { endpoint: "https://opencode.ai/zen/go/v1" },
    );

    expect(input.endpoint).toBe("https://opencode.ai/zen/go/v1");
  });

  it("builds the same payload as today when no endpoint is chosen for a single-endpoint product", () => {
    const withOptions = buildSetupInput(unconfiguredRow("gemini"), undefined, {});
    const withoutOptions = buildSetupInput(unconfiguredRow("gemini"));

    expect(withOptions).toEqual(withoutOptions);
    expect(withOptions.endpoint).toBe(PRODUCT_REGISTRY.gemini.configuration.endpoints[0]?.endpoint);
  });

  it("omits the credential when the surface passes none", () => {
    expect(buildSetupInput(unconfiguredRow("gemini"))).not.toHaveProperty("credential");
  });

  it.each(ENDPOINT_BEARING_PRODUCTS)("refuses to invent a %s endpoint", (productId) => {
    const row = unconfiguredRow(productId);
    const withoutEndpoints = { ...row, product: { ...row.product, endpoints: [] } };

    expect(() => buildSetupInput(withoutEndpoints)).toThrow(/No endpoint profile/);
  });

  it("reuses the stored endpoint when updating a configured hosted product", () => {
    const row = configuredRow(ZAI_CONFIGURATION, "credential-invalid");

    const input = buildSetupInput(row, toSetupCredential("env", "ignored"));

    expect(input).toEqual({
      transportFamily: "hosted-api",
      productId: "zai",
      endpoint: "https://api.z.ai/api/paas/v4",
      credential: { kind: "environment" },
    });
    expect(() => ClientConfigurationInputSchema.parse(input)).not.toThrow();
  });

  it("keeps the stored endpoint on update even when the surface passes an endpoint option", () => {
    const row = configuredRow(OPENCODE_ZEN_CONFIGURATION, "credential-invalid");

    const input = buildSetupInput(row, toSetupCredential("paste", "secret-key"), {
      endpoint: "https://opencode.ai/zen/go/v1",
    });

    expect(input.endpoint).toBe("https://opencode.ai/zen/v1");
  });
});

describe("buildSetupAcknowledgement", () => {
  it("accepts the current product notice", () => {
    const acknowledgement = buildSetupAcknowledgement(unconfiguredRow("gemini"));

    expect(acknowledgement).toMatchObject({
      status: "accepted",
      noticeId: PRODUCT_REGISTRY.gemini.notice.id,
      noticeVersion: PRODUCT_REGISTRY.gemini.notice.noticeVersion,
    });
    expect(Date.parse(acknowledgement.acceptedAt)).not.toBeNaN();
  });
});

describe("toSetupCredential", () => {
  it("stores a pasted value and defers to the environment otherwise", () => {
    expect(toSetupCredential("paste", "secret-key")).toEqual({
      kind: "literal",
      value: "secret-key",
    });
    expect(toSetupCredential("env", "ignored")).toEqual({ kind: "environment" });
  });
});

describe("getSetupLayoutCopy", () => {
  it("asks for credentials by product name", () => {
    expect(getSetupLayoutCopy(unconfiguredRow("gemini"))).toContain(
      PRODUCT_REGISTRY.gemini.presentation.name,
    );
  });
});
