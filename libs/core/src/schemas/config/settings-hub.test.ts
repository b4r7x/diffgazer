import { describe, expect, test } from "vitest";
import {
  type ClientMetadataSource,
  projectClientMetadata,
} from "../../providers/client-metadata.js";
import { PRODUCT_REGISTRY } from "../../providers/product-registry.js";
import { REMOVED_PRODUCT_ID } from "./providers.js";
import { READINESS_PRESENTATION, ReadinessSchema } from "./readiness.js";
import type { ProviderSettingsRowId, SettingsHubInput } from "./settings-hub.js";
import { buildHubValues, buildProviderSettingsRows } from "./settings-hub.js";
import type { RemovedProductId, RunnableProductId } from "./transports.js";

function makeInput(overrides: Partial<SettingsHubInput> = {}): SettingsHubInput {
  return {
    selectedProductId: "gemini",
    isTrusted: false,
    theme: "auto",
    secretsStorage: "file",
    agentExecution: "parallel",
    selectedLensCount: 0,
    ...overrides,
  };
}

function metadataFor(productId: RunnableProductId | RemovedProductId) {
  const product = PRODUCT_REGISTRY[productId];
  if (product.kind === "removed") {
    return projectClientMetadata({
      productId: product.id,
      configuration: {
        configurationId: "legacy-removed-zai-plan",
        revision: 1,
        status: "removed",
        transportFamily: "hosted-api",
        productId: product.id,
        selectedModelId: null,
        notices: [],
        availableActions: ["inspect", "delete"],
      },
      readiness: ReadinessSchema.parse({
        status: "removed",
        ready: false,
        evidenceStatus: "not-checked",
        checkedAt: null,
        acknowledgement: { status: "not-applicable" },
        ...READINESS_PRESENTATION.removed,
      }),
      notices: [],
      actions: ["inspect", "delete"],
    });
  }

  const source: ClientMetadataSource = {
    productId,
    configuration: null,
    readiness: ReadinessSchema.parse({
      status: "unconfigured",
      ready: false,
      evidenceStatus: "not-checked",
      checkedAt: null,
      acknowledgement: {
        status: "required",
        noticeId: product.notice.id,
        noticeVersion: product.notice.noticeVersion,
      },
      ...READINESS_PRESENTATION.unconfigured,
    }),
    notices: [product.notice],
    actions: ["create"],
  };
  return projectClientMetadata(source);
}

function rowValue(productId: RunnableProductId | RemovedProductId, rowId: ProviderSettingsRowId) {
  const row = buildProviderSettingsRows(metadataFor(productId)).find(({ id }) => id === rowId);
  expect(row).toBeDefined();
  return row?.value ?? "";
}

describe("buildProviderSettingsRows", () => {
  test.each([
    ["PAYG", "zai" as const, "Pay as you go (PAYG)"],
    ["evaluation", "mistral" as const, "Evaluation, Pay as you go (PAYG)"],
    ["subscription", "copilot-cli" as const, "Subscription credit/rate limits"],
    ["local", "ollama" as const, "Local execution costs"],
  ])("distinguishes %s billing", (_billingClass, productId, expected) => {
    expect(rowValue(productId, "billing")).toBe(expected);
  });

  test("renders billing and privacy text from the client projection", () => {
    const rows = buildProviderSettingsRows(metadataFor("mistral"));
    const billing = rows.find(({ id }) => id === "billing");
    const privacy = rows.find(({ id }) => id === "privacy");

    expect(billing?.description).toContain("evaluation/prototyping");
    expect(billing?.description).toContain("selected global or EU endpoint");
    expect(privacy?.value).toContain("rolling 30-day retention");
    expect(privacy?.value).toContain("never inferred");
  });

  test("renders readiness with the shared status label from the client projection", () => {
    const rows = buildProviderSettingsRows(metadataFor("zai"));

    expect(rows.find(({ id }) => id === "readiness")).toMatchObject({
      value: "Not configured",
      description: expect.stringContaining("Create a configuration to continue."),
    });
  });

  test("states facts only, never restating the actions the surfaces already render", () => {
    const rows = buildProviderSettingsRows(metadataFor(REMOVED_PRODUCT_ID));

    expect(rows.map(({ id }) => id)).toEqual(["product", "transport", "readiness"]);
    expect(rowValue(REMOVED_PRODUCT_ID, "readiness")).toBe("Removed");
  });

  test.each([
    "ollama" as const,
    "local-openai" as const,
    "codex-cli" as const,
    "copilot-cli" as const,
  ])("contains no API-key wording for %s", (productId) => {
    const text = JSON.stringify(buildProviderSettingsRows(metadataFor(productId))).toLowerCase();
    expect(text).not.toMatch(/api[ -]?key/);
  });
});

describe("buildHubValues", () => {
  test("returns 'Not configured' when setup is incomplete", () => {
    expect(buildHubValues(makeInput({ selectedProductId: null })).provider).toBe("Not configured");
  });

  // Casing belongs to the surfaces (web lifts these with CSS, the TUI uppercases when it
  // renders), so the stored identifier reaches the DOM unshouted.
  test("returns provider and theme in their stored casing", () => {
    const values = buildHubValues(makeInput());
    expect(values.provider).toBe("gemini");
    expect(values.theme).toBe("auto");
  });

  test.each([
    { secretsStorage: "file" as const, rendered: "file" },
    { secretsStorage: "keyring" as const, rendered: "keyring" },
    { secretsStorage: null, rendered: "Not set" },
  ])("renders secrets storage '$secretsStorage' as '$rendered'", ({ secretsStorage, rendered }) => {
    expect(buildHubValues(makeInput({ secretsStorage })).storage).toBe(rendered);
  });

  test.each([
    { agentExecution: "parallel" as const, rendered: "Parallel" },
    { agentExecution: "sequential" as const, rendered: "Sequential" },
    { agentExecution: null, rendered: "Sequential" },
  ])("renders agent execution '$agentExecution' as '$rendered'", ({ agentExecution, rendered }) => {
    expect(buildHubValues(makeInput({ agentExecution }))["agent-execution"]).toBe(rendered);
  });

  test("trust reflects readFiles capability state", () => {
    expect(buildHubValues(makeInput({ isTrusted: true })).trust).toBe("Trusted");
    expect(buildHubValues(makeInput({ isTrusted: false })).trust).toBe("Not trusted");
  });

  test("analysis shows the selected lens count or default", () => {
    expect(buildHubValues(makeInput({ selectedLensCount: 0 })).analysis).toBe("Default");
    expect(buildHubValues(makeInput({ selectedLensCount: 1 })).analysis).toBe("1 lens");
    expect(buildHubValues(makeInput({ selectedLensCount: 2 })).analysis).toBe("2 lenses");
  });

  test("diagnostics stays constant", () => {
    expect(buildHubValues(makeInput()).diagnostics).toBe("Local");
  });

  test("falls back to the auto theme when theme is missing", () => {
    expect(buildHubValues(makeInput({ theme: undefined })).theme).toBe("auto");
  });
});
