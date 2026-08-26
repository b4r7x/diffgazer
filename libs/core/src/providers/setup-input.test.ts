import { describe, expect, it } from "vitest";
import type { ConfigurationStatus } from "../schemas/config/configuration-status.js";
import { HostedApiConfigurationInputSchema } from "../schemas/config/provider-config.js";
import {
  READINESS_PRESENTATION,
  type Readiness,
  ReadinessSchema,
} from "../schemas/config/readiness.js";
import { makeClientNotice } from "../testing/provider-fixtures.js";
import { mapProviderList, type ProviderListRow } from "./list.js";
import { PRODUCT_REGISTRY } from "./product-registry.js";
import {
  buildSetupAcknowledgement,
  buildSetupInput,
  getSetupLayoutCopy,
  toSetupCredential,
} from "./setup-input.js";

const CONFIGURED_ACTIONS = ["inspect", "select", "test", "update", "delete"] as const;

function readiness(status: "unconfigured" | "credential-invalid"): Readiness {
  return ReadinessSchema.parse({
    status,
    ready: false,
    evidenceStatus: status === "credential-invalid" ? "failed" : "not-checked",
    checkedAt: status === "credential-invalid" ? "2026-07-31T10:00:00.000Z" : null,
    acknowledgement: { status: "not-applicable" },
    ...READINESS_PRESENTATION[status],
  });
}

function unconfiguredRow(productId: string): ProviderListRow {
  const row = mapProviderList([]).find((candidate) => candidate.product.productId === productId);
  if (!row) throw new Error(`Missing unconfigured row for ${productId}`);
  return row;
}

function configuredRow(status: ConfigurationStatus): ProviderListRow {
  const row = mapProviderList([status]).find(
    (candidate) =>
      candidate.configuration?.configurationId === status.configuration.configurationId,
  );
  if (!row) throw new Error("Missing configured row");
  return row;
}

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

  it("omits the credential when the surface passes none", () => {
    expect(buildSetupInput(unconfiguredRow("gemini"))).not.toHaveProperty("credential");
  });

  it.each(ENDPOINT_BEARING_PRODUCTS)("refuses to invent a %s endpoint", (productId) => {
    const row = unconfiguredRow(productId);
    const withoutEndpoints = { ...row, product: { ...row.product, endpoints: [] } };

    expect(() => buildSetupInput(withoutEndpoints)).toThrow(/No endpoint profile/);
  });

  it("reuses the stored endpoint when updating a configured hosted product", () => {
    const row = configuredRow({
      configuration: {
        configurationId: "zai-1",
        revision: 2,
        status: "supported",
        transportFamily: "hosted-api",
        productId: "zai",
        endpoint: "https://api.z.ai/api/paas/v4",
        selectedModelId: "glm-4.7",
        notices: [makeClientNotice("zai")],
        availableActions: [...CONFIGURED_ACTIONS],
      },
      readiness: readiness("credential-invalid"),
    });

    const input = buildSetupInput(row, toSetupCredential("env", "ignored"));

    expect(input).toEqual({
      transportFamily: "hosted-api",
      productId: "zai",
      endpoint: "https://api.z.ai/api/paas/v4",
      credential: { kind: "environment" },
    });
    expect(() => HostedApiConfigurationInputSchema.parse(input)).not.toThrow();
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
