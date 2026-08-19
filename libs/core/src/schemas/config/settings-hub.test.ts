import { describe, expect, test } from "vitest";
import {
  type ClientMetadataSource,
  projectClientMetadata,
} from "../../providers/client-metadata.js";
import { PRODUCT_REGISTRY } from "../../providers/product-registry.js";
import { requireValue } from "../../testing/assertions.js";
import {
  buildProviderRows,
  configurationStatus,
  ZAI_CONFIGURATION,
} from "../../testing/provider-fixtures.js";
import { READINESS_PRESENTATION, ReadinessSchema } from "./readiness.js";
import type { ProviderSettingsRowId, SettingsHubInput } from "./settings-hub.js";
import { buildHubValues, buildProviderSettingsRows } from "./settings-hub.js";
import { RUNNABLE_PRODUCT_IDS, type RunnableProductId } from "./transports.js";

/** Imperative verbs a settings row must never use; the surfaces own the actions. */
const ACTION_WORDING =
  /\b(create|configure|update|select|choose|inspect|test|delete|remove|run|retry|accept|install|start)\b/i;

function makeInput(overrides: Partial<SettingsHubInput> = {}): SettingsHubInput {
  return {
    selectedProductId: "gemini",
    isTrusted: false,
    theme: "auto",
    secretsStorage: "file",
    agentExecution: "parallel",
    selectedLensCount: 0,
    providerConsent: null,
    ...overrides,
  };
}

function metadataFor(productId: RunnableProductId) {
  const product = PRODUCT_REGISTRY[productId];
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

function rowValue(productId: RunnableProductId, rowId: ProviderSettingsRowId) {
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

  test.each([
    ["ready", /^Verified /],
    ["acknowledgement-required", /^Verified /],
    ["conformance-failed", /^Failed /],
    ["conformance-pending", /^Not verified$/],
    ["model-missing", /^Not verified$/],
    ["credential-invalid", /^Not verified$/],
    ["skipped", /^Skipped /],
  ] as const)("names the last %s verification without restating the remediation", (status, expected) => {
    const rows = buildProviderSettingsRows(
      requireValue(
        buildProviderRows([configurationStatus(ZAI_CONFIGURATION, status)]).find(
          (row) => row.configuration?.configurationId === ZAI_CONFIGURATION.configurationId,
        ),
        `${status} row`,
      ),
    );

    expect(rows.find(({ id }) => id === "verification")?.value).toMatch(expected);
  });

  test.each([
    ["pending", /^Not verified$/],
    ["failed", /^Failed /],
  ] as const)("does not report an unacknowledged record with %s evidence as verified", (evidenceStatus, expected) => {
    const status = configurationStatus(ZAI_CONFIGURATION, "acknowledgement-required");
    const rows = buildProviderSettingsRows(
      requireValue(
        buildProviderRows([
          {
            ...status,
            readiness: ReadinessSchema.parse({ ...status.readiness, evidenceStatus }),
          },
        ]).find((row) => row.configuration?.configurationId === ZAI_CONFIGURATION.configurationId),
        "acknowledgement-required row",
      ),
    );

    expect(rows.find(({ id }) => id === "verification")?.value).toMatch(expected);
  });

  test("reports an unconfigured product as never checked", () => {
    expect(rowValue("zai", "verification")).toBe("Not checked");
  });

  test("states facts only, never restating the actions the surfaces already render", () => {
    // Only `readiness.description` may name an action: it carries the remediation sentence.
    for (const productId of RUNNABLE_PRODUCT_IDS) {
      const rows = buildProviderSettingsRows(metadataFor(productId));

      expect(rows.map(({ id }) => id)).toEqual([
        "product",
        "transport",
        "billing",
        "privacy",
        "readiness",
        "verification",
      ]);
      for (const row of rows) {
        const scanned = [
          row.label,
          row.value,
          row.id === "readiness" ? "" : (row.description ?? ""),
        ];
        expect(scanned.join(" "), `${productId}/${row.id}`).not.toMatch(ACTION_WORDING);
      }
    }
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

  test("provider consent reads the acceptance date, or that none is on record", () => {
    expect(buildHubValues(makeInput())["provider-consent"]).toBe("Not accepted");
    expect(
      buildHubValues(
        makeInput({
          providerConsent: { version: 1, acceptedAt: "2026-08-18T10:00:00.000Z" },
        }),
      )["provider-consent"],
    ).toMatch(/^Accepted 2026-08-1[89]$/);
  });

  test("diagnostics stays constant", () => {
    expect(buildHubValues(makeInput()).diagnostics).toBe("Local");
  });

  test("falls back to the auto theme when theme is missing", () => {
    expect(buildHubValues(makeInput({ theme: undefined })).theme).toBe("auto");
  });
});
