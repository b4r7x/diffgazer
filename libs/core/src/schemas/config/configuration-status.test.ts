import { describe, expect, it } from "vitest";
import { PRODUCT_REGISTRY } from "../../providers/product-registry.js";
import { type ConfigurationStatus, resolveSelectedConfiguration } from "./configuration-status.js";
import { READINESS_PRESENTATION, ReadinessSchema } from "./readiness.js";

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
    {
      name: "a dangling selection",
      response: { configurations, selectedConfigurationId: "gemini-missing" },
    },
    { name: "an unloaded response", response: undefined },
    { name: "a null response", response: null },
  ])("returns null for $name", ({ response }) => {
    expect(resolveSelectedConfiguration(response)).toBeNull();
  });
});
