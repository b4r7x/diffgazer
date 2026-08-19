import { describe, expect, it } from "vitest";
import { PRODUCT_REGISTRY } from "../../providers/product-registry.js";
import {
  CLIENT_CONFIGURATION_ACTIONS,
  ClientConfigurationActionResponseSchema,
  ClientConfigurationActionSchema,
  ClientConfigurationNoticeSchema,
  ClientConfigurationSummarySchema,
} from "./provider-config.js";
import { READINESS_PRESENTATION } from "./readiness.js";

const hostedInput = {
  transportFamily: "hosted-api" as const,
  productId: "qwen" as const,
  endpoint: "https://dashscope-intl.aliyuncs.com/compatible-mode/v1",
  region: "international",
  workspace: "workspace-reference",
  credential: { kind: "literal" as const, value: "write-only-credential" },
};

const localHttpInput = {
  transportFamily: "local-http" as const,
  productId: "local-openai" as const,
  endpoint: "http://127.0.0.1:1234/v1",
  authentication: "optional-local-bearer" as const,
  presetId: "lm-studio" as const,
  bearerToken: { kind: "literal" as const, value: "write-only-bearer" },
};

const localCliInput = {
  transportFamily: "local-cli" as const,
  productId: "codex-cli" as const,
  installationId: "codex-installation-1",
};

const notice = {
  ...PRODUCT_REGISTRY.qwen.notice,
  billing: [...PRODUCT_REGISTRY.qwen.notice.billing],
  privacy: [...PRODUCT_REGISTRY.qwen.notice.privacy],
};

const acknowledgement = {
  status: "accepted" as const,
  noticeId: notice.id,
  noticeVersion: notice.noticeVersion,
  acceptedAt: "2026-07-31T12:00:00.000Z",
};

const readyReadiness = {
  status: "ready" as const,
  ready: true as const,
  evidenceStatus: "passed" as const,
  checkedAt: "2026-07-31T12:01:00.000Z",
  acknowledgement,
  ...READINESS_PRESENTATION.ready,
};

const acknowledgementRequiredReadiness = {
  status: "acknowledgement-required" as const,
  ready: false as const,
  evidenceStatus: "passed" as const,
  checkedAt: "2026-07-31T12:01:00.000Z",
  acknowledgement: {
    status: "required" as const,
    noticeId: notice.id,
    noticeVersion: notice.noticeVersion,
  },
  ...READINESS_PRESENTATION["acknowledgement-required"],
};

const hostedSummary = {
  configurationId: "configuration-1",
  revision: 3,
  status: "supported" as const,
  transportFamily: "hosted-api" as const,
  productId: "qwen" as const,
  endpoint: hostedInput.endpoint,
  region: "international",
  workspace: "workspace-reference",
  selectedModelId: "qwen3-coder-flash",
  notices: [notice],
  availableActions: ["inspect", "select", "test", "update", "delete"] as const,
};

describe("client configuration actions", () => {
  it("parses exactly create, inspect, select, test, update, and delete", () => {
    const actions = [
      { action: "create", input: hostedInput },
      { action: "inspect", configurationId: "configuration-1" },
      {
        action: "select",
        configurationId: "configuration-1",
        modelId: "qwen3-coder-flash",
      },
      { action: "test", configurationId: "configuration-1" },
      {
        action: "update",
        configurationId: "configuration-1",
        expectedRevision: 3,
        input: localHttpInput,
        acknowledgement,
      },
      { action: "delete", configurationId: "configuration-1", expectedRevision: 3 },
    ];

    expect(actions.map((action) => ClientConfigurationActionSchema.parse(action).action)).toEqual(
      CLIENT_CONFIGURATION_ACTIONS,
    );
  });

  it("rejects configurationId on create and requires it on every other action", () => {
    expect(
      ClientConfigurationActionSchema.safeParse({
        action: "create",
        configurationId: "configuration-1",
        input: hostedInput,
        acknowledgement,
      }).success,
    ).toBe(false);

    for (const action of ["inspect", "test"] as const) {
      expect(ClientConfigurationActionSchema.safeParse({ action }).success).toBe(false);
    }
    expect(
      ClientConfigurationActionSchema.safeParse({
        action: "select",
        modelId: "qwen3-coder-flash",
      }).success,
    ).toBe(false);
  });

  it("requires a positive expected revision on update, and on delete only when one is asserted", () => {
    expect(
      ClientConfigurationActionSchema.safeParse({
        action: "update",
        configurationId: "configuration-1",
        input: hostedInput,
        acknowledgement,
      }).success,
    ).toBe(false);
    expect(
      ClientConfigurationActionSchema.safeParse({
        action: "delete",
        configurationId: "configuration-1",
        expectedRevision: 0,
      }).success,
    ).toBe(false);
    expect(
      ClientConfigurationActionSchema.safeParse({
        action: "inspect",
        configurationId: "configuration-1",
        expectedRevision: 3,
      }).success,
    ).toBe(false);
  });

  // A record the build could not decode never showed a revision, so its delete
  // asserts none. The server still refuses one it can describe on that request.
  it("accepts a delete that asserts no revision", () => {
    expect(
      ClientConfigurationActionSchema.safeParse({
        action: "delete",
        configurationId: "configuration-1",
      }).success,
    ).toBe(true);
  });

  it("allows optional acknowledgement on create and requires it on update", () => {
    expect(
      ClientConfigurationActionSchema.safeParse({ action: "create", input: hostedInput }).success,
    ).toBe(true);
    expect(
      ClientConfigurationActionSchema.safeParse({
        action: "create",
        input: hostedInput,
        acknowledgement,
      }).success,
    ).toBe(true);
    expect(
      ClientConfigurationActionSchema.safeParse({
        action: "update",
        configurationId: "configuration-1",
        expectedRevision: 3,
        input: hostedInput,
      }).success,
    ).toBe(false);

    for (const action of [
      { action: "inspect", configurationId: "configuration-1", acknowledgement },
      { action: "select", configurationId: "configuration-1", modelId: "model", acknowledgement },
      { action: "test", configurationId: "configuration-1", acknowledgement },
      {
        action: "delete",
        configurationId: "configuration-1",
        expectedRevision: 3,
        acknowledgement,
      },
    ]) {
      expect(ClientConfigurationActionSchema.safeParse(action).success).toBe(false);
    }
  });

  it("accepts only the fields belonging to the selected transport family", () => {
    for (const input of [hostedInput, localHttpInput, localCliInput]) {
      expect(ClientConfigurationActionSchema.safeParse({ action: "create", input }).success).toBe(
        true,
      );
    }

    for (const input of [
      { ...hostedInput, installationId: "codex-installation-1" },
      { ...localHttpInput, workspace: "workspace-reference" },
      { ...localCliInput, endpoint: "http://127.0.0.1:1234/v1" },
      { ...localCliInput, credential: { kind: "literal", value: "secret" } },
      {
        ...localHttpInput,
        authentication: "none",
        bearerToken: { kind: "literal", value: "secret" },
      },
    ]) {
      expect(ClientConfigurationActionSchema.safeParse({ action: "create", input }).success).toBe(
        false,
      );
    }
  });

  it("rejects unsafe exact model identifiers without rewriting them", () => {
    for (const modelId of [
      "",
      " model",
      "model name",
      "../model",
      "https://models.example/model",
      "model\nname",
      "model\u001b[31m",
      "a".repeat(257),
    ]) {
      expect(
        ClientConfigurationActionSchema.safeParse({
          action: "select",
          configurationId: "configuration-1",
          modelId,
        }).success,
      ).toBe(false);
    }
  });

  it.each([
    "latest",
    "LATEST",
    "gemini-latest",
    "provider/model/latest",
    "model.latest.v2",
    "model_latest_v2",
  ])("rejects marketing/latest aliases from select actions: %s", (modelId) => {
    expect(
      ClientConfigurationActionSchema.safeParse({
        action: "select",
        configurationId: "configuration-1",
        modelId,
      }).success,
    ).toBe(false);
  });
});

describe("client configuration responses", () => {
  it("preserves every canonical registry notice through the safe notice schema", () => {
    for (const product of Object.values(PRODUCT_REGISTRY)) {
      if (product.kind !== "runnable") continue;
      expect(ClientConfigurationNoticeSchema.safeParse(product.notice).success).toBe(true);
    }
  });

  it("rejects C0/C1, DEL, and Unicode line controls in safe summaries and notices", () => {
    const controlCharacters = [
      "\u0000",
      "\u0007",
      "\u0009",
      "\u000a",
      "\u000d",
      "\u001b",
      "\u001f",
      "\u007f",
      "\u0080",
      "\u0085",
      "\u009b",
      "\u009f",
      "\u2028",
      "\u2029",
    ];

    for (const controlCharacter of controlCharacters) {
      expect(
        ClientConfigurationSummarySchema.safeParse({
          ...hostedSummary,
          workspace: `workspace${controlCharacter}reference`,
        }).success,
      ).toBe(false);
      expect(
        ClientConfigurationNoticeSchema.safeParse({
          ...notice,
          id: `notice${controlCharacter}id`,
        }).success,
      ).toBe(false);

      for (const field of ["billing", "privacy"] as const) {
        expect(
          ClientConfigurationNoticeSchema.safeParse({
            ...notice,
            [field]: [`safe${controlCharacter}notice`],
          }).success,
        ).toBe(false);
      }
    }
  });

  it.each([
    "/usr/local/bin/codex",
    "/srv/bin/tool",
    "/bin/sh",
    "C:\\Program Files\\Codex\\codex.exe",
    "C:/Program Files/Codex/codex.exe",
    "\\\\server\\share\\codex.exe",
    "~/Library/Application Support/Codex/auth.json",
    "./bin/codex",
    "..\\bin\\codex",
    "Executable path: /usr/local/bin/codex",
    "Auth file: C:\\Program Files\\Codex\\auth.json",
  ])("rejects executable and auth paths from client-safe notices: %s", (path) => {
    for (const field of ["billing", "privacy"] as const) {
      expect(
        ClientConfigurationNoticeSchema.safeParse({ ...notice, [field]: [path] }).success,
      ).toBe(false);
    }
  });

  it.each([
    ",",
    ";",
    ":",
    "!",
    "?",
    "(",
    ")",
    "[",
    "]",
    "{",
    "}",
  ])("rejects a Unix path introduced by punctuation: %s", (separator) => {
    const path = `safe${separator}/usr/local/bin/codex`;
    expect(ClientConfigurationNoticeSchema.safeParse({ ...notice, billing: [path] }).success).toBe(
      false,
    );
    expect(
      ClientConfigurationSummarySchema.safeParse({
        ...hostedSummary,
        workspace: `safe${separator}/private/var/foo`,
      }).success,
    ).toBe(false);
  });

  it.each([
    "safe,~/",
    "safe,~/Library/Application Support/Codex/auth.json",
    "safe,C:/",
    "safe;C:\\Program Files\\Codex\\codex.exe",
    "safe:C:/Program Files/Codex/codex.exe",
    "safe,\\\\build-host\\Program Files\\Codex\\codex.exe",
    "safe;./",
    "safe;./bin/codex",
    "safe:../",
    "safe:../bin/codex",
    "safe,/",
  ])("rejects path roots after punctuation: %s", (path) => {
    expect(ClientConfigurationNoticeSchema.safeParse({ ...notice, privacy: [path] }).success).toBe(
      false,
    );
    expect(
      ClientConfigurationSummarySchema.safeParse({ ...hostedSummary, workspace: path }).success,
    ).toBe(false);
  });

  it.each([
    "Use / for alternatives",
    "Models support a/b notation",
    "Fetch from https://example.test",
    "A ratio such as 5/10 is ordinary prose",
    "The slash / is punctuation",
  ])("preserves legitimate slash prose: %s", (line) => {
    expect(ClientConfigurationNoticeSchema.safeParse({ ...notice, billing: [line] }).success).toBe(
      true,
    );
    expect(
      ClientConfigurationSummarySchema.safeParse({ ...hostedSummary, workspace: line }).success,
    ).toBe(true);
  });

  it("preserves opaque region and workspace/account references", () => {
    for (const workspace of [
      "workspace-reference",
      "account-reference",
      "workspace-account-2026",
    ]) {
      expect(
        ClientConfigurationSummarySchema.safeParse({ ...hostedSummary, workspace }).success,
      ).toBe(true);
    }
  });

  it("parses a closed safe response for each action", () => {
    for (const action of CLIENT_CONFIGURATION_ACTIONS) {
      expect(
        ClientConfigurationActionResponseSchema.safeParse({
          action,
          status: "succeeded",
          ...(action === "delete" ? {} : { configuration: hostedSummary }),
          ...(action === "test" ? { readiness: readyReadiness } : {}),
        }).success,
      ).toBe(true);
    }
  });

  it("requires safe production-path readiness evidence on test responses", () => {
    expect(
      ClientConfigurationActionResponseSchema.safeParse({
        action: "test",
        status: "succeeded",
        configuration: hostedSummary,
      }).success,
    ).toBe(false);

    expect(
      ClientConfigurationActionResponseSchema.parse({
        action: "test",
        status: "succeeded",
        configuration: hostedSummary,
        readiness: readyReadiness,
      }),
    ).toMatchObject({
      action: "test",
      readiness: {
        status: "ready",
        evidenceStatus: "passed",
        checkedAt: "2026-07-31T12:01:00.000Z",
      },
    });
  });

  it("keeps provisional discovery responses non-ready until configuration evidence is bound", () => {
    expect(
      ClientConfigurationActionResponseSchema.safeParse({
        action: "test",
        status: "succeeded",
        readiness: acknowledgementRequiredReadiness,
      }).success,
    ).toBe(false);

    expect(
      ClientConfigurationActionResponseSchema.safeParse({
        action: "test",
        status: "succeeded",
        readiness: readyReadiness,
      }).success,
    ).toBe(false);
  });

  it("requires readiness to bind to a configuration", () => {
    expect(
      ClientConfigurationActionResponseSchema.safeParse({
        action: "inspect",
        status: "failed",
        readiness: acknowledgementRequiredReadiness,
      }).success,
    ).toBe(false);

    expect(
      ClientConfigurationActionResponseSchema.safeParse({
        action: "inspect",
        status: "succeeded",
      }).success,
    ).toBe(false);
  });

  it("rejects a configuration on a succeeded delete response and accepts delete without one", () => {
    expect(
      ClientConfigurationActionResponseSchema.safeParse({
        action: "delete",
        status: "succeeded",
        configuration: hostedSummary,
      }).success,
    ).toBe(false);
    expect(
      ClientConfigurationActionResponseSchema.safeParse({
        action: "delete",
        status: "succeeded",
      }).success,
    ).toBe(true);
  });

  it("fails closed for product notices and model policies from the registry", () => {
    const openRouterNotice = {
      ...PRODUCT_REGISTRY.openrouter.notice,
      billing: [...PRODUCT_REGISTRY.openrouter.notice.billing],
      privacy: [...PRODUCT_REGISTRY.openrouter.notice.privacy],
    };

    expect(
      ClientConfigurationSummarySchema.safeParse({
        ...hostedSummary,
        selectedModelId: "qwen3-coder-plus",
      }).success,
    ).toBe(false);

    expect(
      ClientConfigurationSummarySchema.safeParse({
        ...hostedSummary,
        productId: "openrouter",
        endpoint: "https://openrouter.ai/api/v1",
        region: undefined,
        workspace: undefined,
        selectedModelId: "openai/auto",
        notices: [openRouterNotice],
      }).success,
    ).toBe(false);
  });

  it("binds ready responses to the exact tuple and current product notice", () => {
    const readyResponse = {
      action: "test" as const,
      status: "succeeded" as const,
      configuration: hostedSummary,
      readiness: readyReadiness,
    };

    expect(ClientConfigurationActionResponseSchema.safeParse(readyResponse).success).toBe(true);
    expect(
      ClientConfigurationActionResponseSchema.safeParse({
        ...readyResponse,
        configuration: { ...hostedSummary, workspace: undefined },
      }).success,
    ).toBe(false);
    expect(
      ClientConfigurationActionResponseSchema.safeParse({
        ...readyResponse,
        configuration: {
          ...hostedSummary,
          notices: [{ ...notice, id: "gemini-hosted-api" }],
        },
      }).success,
    ).toBe(false);
    expect(
      ClientConfigurationActionResponseSchema.safeParse({
        ...readyResponse,
        readiness: {
          ...readyReadiness,
          acknowledgement: { ...acknowledgement, noticeId: "gemini-hosted-api" },
        },
      }).success,
    ).toBe(false);
  });

  it.each([
    ["literal secret", { apiKey: "secret-value" }],
    ["environment name", { environmentName: "DIFFGAZER_QWEN_API_KEY" }],
    ["local bearer", { bearerToken: "secret-value" }],
    ["account identifier", { account: "account-secret-id" }],
    ["workspace identifier", { workspace: "workspace-secret-id" }],
    ["authentication path", { authPath: "/home/user/.vendor/auth.json" }],
    ["executable path", { executablePath: "/usr/local/bin/codex" }],
    ["argument vector", { argv: ["--model", "qwen3-coder-flash"] }],
    ["raw evidence", { rawEvidence: { response: "provider output" } }],
  ])("rejects a response containing a %s", (_name, forbiddenField) => {
    expect(
      ClientConfigurationActionResponseSchema.safeParse({
        action: "inspect",
        status: "succeeded",
        configuration: { ...hostedSummary, ...forbiddenField },
      }).success,
    ).toBe(false);
  });

  it("rejects secret-bearing or unknown top-level response fields", () => {
    expect(
      ClientConfigurationActionResponseSchema.safeParse({
        action: "test",
        status: "failed",
        configuration: hostedSummary,
        readiness: readyReadiness,
        credential: { kind: "literal", value: "secret-value" },
      }).success,
    ).toBe(false);
  });

  it("keeps response summaries bound to the exact product endpoint tuple", () => {
    expect(
      ClientConfigurationSummarySchema.safeParse({
        ...hostedSummary,
        endpoint: "https://api.deepseek.com/v1",
        region: undefined,
      }).success,
    ).toBe(false);
    expect(
      ClientConfigurationSummarySchema.safeParse({
        ...hostedSummary,
        endpoint: "https://dashscope-intl.aliyuncs.com/compatible-mode/v1?token=secret",
      }).success,
    ).toBe(false);
    expect(
      ClientConfigurationSummarySchema.safeParse({
        ...hostedSummary,
        workspace: undefined,
      }).success,
    ).toBe(false);
    expect(
      ClientConfigurationSummarySchema.safeParse({
        ...hostedSummary,
        productId: "gemini",
        endpoint: "https://generativelanguage.googleapis.com/v1beta",
        region: undefined,
        workspace: "workspace-reference",
      }).success,
    ).toBe(false);
  });

  it("rejects latest aliases from configuration summaries", () => {
    for (const selectedModelId of ["latest", "gemini-flash-latest", "provider/model/latest"]) {
      expect(
        ClientConfigurationSummarySchema.safeParse({ ...hostedSummary, selectedModelId }).success,
        selectedModelId,
      ).toBe(false);
    }
  });

  it("rejects latest aliases from action responses through their nested summary", () => {
    expect(
      ClientConfigurationActionResponseSchema.safeParse({
        action: "inspect",
        status: "succeeded",
        configuration: { ...hostedSummary, selectedModelId: "qwen3-coder-latest" },
      }).success,
    ).toBe(false);
  });

  it("does not report ready when the action itself failed or a notice carries secret material", () => {
    expect(
      ClientConfigurationActionResponseSchema.safeParse({
        action: "test",
        status: "failed",
        configuration: hostedSummary,
        readiness: readyReadiness,
      }).success,
    ).toBe(false);
    expect(
      ClientConfigurationActionResponseSchema.safeParse({
        action: "inspect",
        status: "succeeded",
        configuration: {
          ...hostedSummary,
          notices: [{ ...notice, billing: ["apiKey: secret-value"] }],
        },
      }).success,
    ).toBe(false);
  });

  it.each([
    ["environment secret name", "DIFFGAZER_API_KEY"],
    ["command-line api key", "--api-key secret"],
    ["token identifier", "token identifier: account-token-123"],
    ["secret identifier", "secret id secret-123"],
    ["account secret identifier", "account-secret-id account-123"],
    ["workspace secret identifier", "workspace secret id workspace-123"],
  ])("rejects %s in client-safe billing and privacy text", (_name, line) => {
    for (const field of ["billing", "privacy"] as const) {
      const result = ClientConfigurationNoticeSchema.safeParse({
        ...notice,
        [field]: [line],
      });
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues.some((issue) => issue.path[0] === field)).toBe(true);
      }
    }
  });

  it.each([
    "account-secret-id",
    "workspace_secret_id",
    "DIFFGAZER_API_KEY",
    "api-key-secret",
  ])("rejects secret-bearing notice id %s", (id) => {
    const result = ClientConfigurationNoticeSchema.safeParse({ ...notice, id });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.some((issue) => issue.path[0] === "id")).toBe(true);
    }
  });
});
