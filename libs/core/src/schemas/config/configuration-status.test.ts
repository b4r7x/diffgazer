import { describe, expect, it } from "vitest";
import { PRODUCT_REGISTRY } from "../../providers/product-registry.js";
import {
  type ConfigurationInitResponse,
  ConfigurationListResponseSchema,
  type ConfigurationStatus,
  ConfigurationStatusSchema,
  deriveDiagnosticsSetupGaps,
  resolveSelectedConfiguration,
} from "./configuration-status.js";
import { READINESS_PRESENTATION, ReadinessSchema } from "./readiness.js";
import { DEFAULT_SETTINGS } from "./settings.js";

const CHECKED_AT = "2026-07-31T10:00:00.000Z";
const NOTICE = PRODUCT_REGISTRY.gemini.notice;

function configurationStatus(configurationId: string): ConfigurationStatus {
  return {
    configuration: {
      configurationId,
      revision: 1,
      status: "supported",
      transportFamily: "hosted-api",
      productId: "gemini",
      endpoint: "https://generativelanguage.googleapis.com/v1beta",
      selectedModelId: "gemini-2.5-flash",
      notices: [{ ...NOTICE, billing: [...NOTICE.billing], privacy: [...NOTICE.privacy] }],
      availableActions: ["inspect", "select", "test", "update", "delete"],
    },
    readiness: ReadinessSchema.parse({
      status: "ready",
      ready: true,
      evidenceStatus: "passed",
      checkedAt: CHECKED_AT,
      acknowledgement: {
        status: "accepted",
        noticeId: NOTICE.id,
        noticeVersion: NOTICE.noticeVersion,
        acceptedAt: CHECKED_AT,
      },
      ...READINESS_PRESENTATION.ready,
    }),
  };
}

describe("resolveSelectedConfiguration", () => {
  const configurations = [configurationStatus("gemini-a"), configurationStatus("gemini-b")];

  it("resolves the selected configuration by id", () => {
    expect(
      resolveSelectedConfiguration({ configurations, selectedConfigurationId: "gemini-b" }),
    ).toBe(configurations[1]);
  });

  it.each([
    { name: "no selection", response: { configurations, selectedConfigurationId: null } },
    { name: "an unloaded response", response: undefined },
    { name: "a null response", response: null },
  ])("returns null for $name", ({ response }) => {
    expect(resolveSelectedConfiguration(response)).toBeNull();
  });

  it("returns null when the selected id is absent from the configuration list", () => {
    expect(
      resolveSelectedConfiguration({
        configurations,
        selectedConfigurationId: "gemini-missing",
      }),
    ).toBeNull();
  });
});

describe("ConfigurationStatusSchema consistency", () => {
  it("rejects hosted configurations paired with local readiness statuses", () => {
    const hosted = configurationStatus("gemini-a");
    const incompatible = ConfigurationStatusSchema.safeParse({
      configuration: hosted.configuration,
      readiness: ReadinessSchema.parse({
        status: "local-conformance-failed",
        ready: false,
        evidenceStatus: "failed",
        checkedAt: CHECKED_AT,
        acknowledgement: { status: "not-applicable" },
        ...READINESS_PRESENTATION["local-conformance-failed"],
      }),
    });

    expect(incompatible.success).toBe(false);
  });

  it("rejects impossible ready claims without passed evidence", () => {
    const hosted = configurationStatus("gemini-a");
    const incompatible = ConfigurationStatusSchema.safeParse({
      configuration: hosted.configuration,
      readiness: {
        ...hosted.readiness,
        ready: true,
        evidenceStatus: "failed",
      },
    });

    expect(incompatible.success).toBe(false);
  });

  it("rejects dangling selected ids at the list boundary", () => {
    const result = ConfigurationListResponseSchema.safeParse({
      schemaVersion: 2,
      configurations: [configurationStatus("gemini-a")],
      unrecognizedConfigurations: [],
      selectedConfigurationId: "gemini-missing",
    });

    expect(result.success).toBe(false);
  });

  it("carries records this build could not decode alongside the described ones", () => {
    const result = ConfigurationListResponseSchema.safeParse({
      schemaVersion: 2,
      configurations: [configurationStatus("gemini-a")],
      unrecognizedConfigurations: [{ configurationId: "cfg-retired" }],
      selectedConfigurationId: "gemini-a",
    });

    expect(result.success).toBe(true);
    expect(result.data?.unrecognizedConfigurations).toEqual([{ configurationId: "cfg-retired" }]);
  });

  it("refuses to describe an undecodable record beyond its id", () => {
    const result = ConfigurationListResponseSchema.safeParse({
      schemaVersion: 2,
      configurations: [],
      unrecognizedConfigurations: [{ configurationId: "cfg-retired", productId: "zai-coding" }],
      selectedConfigurationId: null,
    });

    expect(result.success).toBe(false);
  });
});

describe("deriveDiagnosticsSetupGaps", () => {
  const configuredInit: ConfigurationInitResponse = {
    schemaVersion: 2,
    settings: { ...DEFAULT_SETTINGS, secretsStorage: "file" },
    project: {
      path: "/repo",
      projectId: "proj-1",
      trust: {
        projectId: "proj-1",
        repoRoot: "/repo",
        trustedAt: "2026-07-31T12:00:00.000Z",
        capabilities: { readFiles: true, runCommands: false },
        trustMode: "persistent",
      },
    },
    configurations: [configurationStatus("gemini-a")],
    unrecognizedConfigurations: [],
    selectedConfigurationId: "gemini-a",
  };

  it("requires repository read access before reporting Ready", () => {
    const { trust } = configuredInit.project;
    if (!trust) {
      throw new Error("configuredInit fixture must include project trust");
    }

    const setup = deriveDiagnosticsSetupGaps({
      ...configuredInit,
      project: {
        ...configuredInit.project,
        trust: {
          ...trust,
          capabilities: { readFiles: false, runCommands: false },
        },
      },
    });

    expect(setup.isReady).toBe(false);
    expect(setup.missing).toContain("trust");
  });

  it("surfaces readiness explanations when prerequisites are satisfied but readiness is not ready", () => {
    const setup = deriveDiagnosticsSetupGaps({
      ...configuredInit,
      configurations: [
        {
          ...configurationStatus("gemini-a"),
          readiness: ReadinessSchema.parse({
            status: "credential-invalid",
            ready: false,
            evidenceStatus: "failed",
            checkedAt: CHECKED_AT,
            acknowledgement: { status: "not-applicable" },
            ...READINESS_PRESENTATION["credential-invalid"],
          }),
        },
      ],
    });

    expect(setup.isReady).toBe(false);
    expect(setup.missing).toEqual([]);
    expect(setup.readiness?.status).toBe("credential-invalid");
  });
});
