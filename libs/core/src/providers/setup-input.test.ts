import { describe, expect, it } from "vitest";
import type { ConfigurationStatus } from "../schemas/config/configuration-status.js";
import type { ClientConfigurationSummary } from "../schemas/config/provider-config.js";
import { REMOVED_PRODUCT_ID } from "../schemas/config/providers.js";
import {
  READINESS_PRESENTATION,
  type Readiness,
  ReadinessSchema,
} from "../schemas/config/readiness.js";
import { LOCAL_OPENAI_PRESET_ENDPOINTS } from "../schemas/config/transports.js";
import { mapProviderList, type ProviderListRow } from "./list.js";
import { PRODUCT_REGISTRY } from "./product-registry.js";
import {
  buildSetupAcknowledgement,
  buildSetupInput,
  getSetupLayoutCopy,
  resolveSetupTransportFamily,
  toSetupCredential,
} from "./setup-input.js";

const CONFIGURED_ACTIONS = ["inspect", "select", "test", "update", "delete"] as const;

function readiness(status: "unconfigured" | "unreachable" | "removed"): Readiness {
  return ReadinessSchema.parse({
    status,
    ready: false,
    evidenceStatus: status === "unreachable" ? "failed" : "not-checked",
    checkedAt: status === "unreachable" ? "2026-07-31T10:00:00.000Z" : null,
    acknowledgement: { status: "not-applicable" },
    ...READINESS_PRESENTATION[status],
  });
}

function copyNotice(productId: "local-openai") {
  const notice = PRODUCT_REGISTRY[productId].notice;
  return { ...notice, billing: [...notice.billing], privacy: [...notice.privacy] };
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

const PRESET_CONFIGURATION: ClientConfigurationSummary = {
  configurationId: "local-openai-lm-studio",
  revision: 1,
  status: "supported",
  transportFamily: "local-http",
  productId: "local-openai",
  endpoint: LOCAL_OPENAI_PRESET_ENDPOINTS["lm-studio"],
  authentication: "none",
  presetId: "lm-studio",
  selectedModelId: null,
  notices: [copyNotice("local-openai")],
  availableActions: [...CONFIGURED_ACTIONS],
};

const REMOVED_CONFIGURATION: ClientConfigurationSummary = {
  configurationId: "legacy-removed-zai-plan",
  revision: 4,
  status: "removed",
  transportFamily: "hosted-api",
  productId: REMOVED_PRODUCT_ID,
  selectedModelId: null,
  notices: [],
  availableActions: ["inspect", "delete"],
};

describe("resolveSetupTransportFamily", () => {
  it("reads the transport from the product until a configuration owns one", () => {
    expect(resolveSetupTransportFamily(unconfiguredRow("gemini"))).toBe("hosted-api");
    expect(resolveSetupTransportFamily(unconfiguredRow("ollama"))).toBe("local-http");
    expect(resolveSetupTransportFamily(unconfiguredRow("codex-cli"))).toBe("local-cli");
    expect(
      resolveSetupTransportFamily(
        configuredRow({ configuration: PRESET_CONFIGURATION, readiness: readiness("unreachable") }),
      ),
    ).toBe("local-http");
  });

  it("configures nothing for a removed record", () => {
    const row = configuredRow({
      configuration: REMOVED_CONFIGURATION,
      readiness: readiness("removed"),
    });

    expect(resolveSetupTransportFamily(row)).toBeNull();
    expect(buildSetupInput(row, null)).toBeNull();
    expect(() => buildSetupInput(row, "hosted-api")).toThrow(/not supported for setup/);
    expect(() => buildSetupAcknowledgement(row)).toThrow(/not supported for setup/);
  });
});

describe("buildSetupInput", () => {
  it("saves a hosted product with its registry endpoint and the entered credential", () => {
    const input = buildSetupInput(
      unconfiguredRow("gemini"),
      "hosted-api",
      toSetupCredential("paste", "secret-key"),
    );

    expect(input).toEqual({
      transportFamily: "hosted-api",
      productId: "gemini",
      endpoint: PRODUCT_REGISTRY.gemini.configuration.endpoints[0]?.endpoint,
      credential: { kind: "literal", value: "secret-key" },
    });
  });

  it("omits the credential when the surface passes none", () => {
    expect(buildSetupInput(unconfiguredRow("gemini"), "hosted-api")).not.toHaveProperty(
      "credential",
    );
  });

  it("saves a local HTTP product without a hosted credential or a preset it has none of", () => {
    const input = buildSetupInput(
      unconfiguredRow("ollama"),
      "local-http",
      toSetupCredential("paste", "secret-key"),
    );

    expect(input).toEqual({
      transportFamily: "local-http",
      productId: "ollama",
      endpoint: PRODUCT_REGISTRY.ollama.configuration.endpoints[0]?.endpoint,
      authentication: "none",
    });
  });

  it("keeps the stored endpoint and preset of an already configured local HTTP product", () => {
    const row = configuredRow({
      configuration: PRESET_CONFIGURATION,
      readiness: readiness("unreachable"),
    });

    expect(buildSetupInput(row, "local-http")).toEqual({
      transportFamily: "local-http",
      productId: "local-openai",
      endpoint: LOCAL_OPENAI_PRESET_ENDPOINTS["lm-studio"],
      authentication: "none",
      presetId: "lm-studio",
    });
  });

  it("names a local CLI installation after the product when none is stored", () => {
    expect(buildSetupInput(unconfiguredRow("codex-cli"), "local-cli")).toEqual({
      transportFamily: "local-cli",
      productId: "codex-cli",
      installationId: "codex-cli-installation",
    });
  });

  it("refuses to build an input for a transport the product does not speak", () => {
    expect(() => buildSetupInput(unconfiguredRow("gemini"), "local-http")).toThrow(
      /requires a supported local-http product/,
    );
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
  it("asks for credentials by product name only where credentials are stored", () => {
    expect(getSetupLayoutCopy(unconfiguredRow("gemini"), "hosted-api")).toContain(
      PRODUCT_REGISTRY.gemini.presentation.name,
    );
  });

  it("names the local endpoint a local HTTP setup will use", () => {
    const endpoint = PRODUCT_REGISTRY.ollama.configuration.endpoints[0]?.endpoint ?? "";

    expect(getSetupLayoutCopy(unconfiguredRow("ollama"), "local-http")).toBe(
      `Configure the local endpoint at ${endpoint} without storing hosted credentials.`,
    );
  });

  it("explains that a local CLI stores no hosted credentials", () => {
    expect(getSetupLayoutCopy(unconfiguredRow("codex-cli"), "local-cli")).toBe(
      "Configure the local CLI installation without storing hosted credentials.",
    );
  });

  it("never borrows a hosted endpoint for local copy", () => {
    expect(getSetupLayoutCopy(unconfiguredRow("gemini"), "local-http")).toBe(
      "Local HTTP setup does not use API credentials.",
    );
    expect(getSetupLayoutCopy(unconfiguredRow("gemini"), "local-cli")).toBe(
      "Local CLI setup does not use API credentials.",
    );
  });
});
