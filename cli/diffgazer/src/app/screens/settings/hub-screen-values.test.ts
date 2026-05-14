import assert from "node:assert/strict";
import test, { describe } from "node:test";
import type { InitResponse, SettingsConfig } from "@diffgazer/core/schemas/config";
import { buildHubValues } from "./hub-screen-values.js";

function makeInit(overrides: Partial<InitResponse> = {}): InitResponse {
  return {
    config: { provider: "gemini", model: "gemini-2.5-flash" },
    settings: {
      theme: "auto",
      defaultLenses: [],
      defaultProfile: null,
      severityThreshold: "low",
      secretsStorage: "file",
      agentExecution: "parallel",
    },
    providers: [],
    configured: true,
    project: {
      path: "/repo",
      projectId: "proj-1",
      trust: null,
    },
    setup: {
      hasSecretsStorage: true,
      hasProvider: true,
      hasModel: true,
      hasTrust: false,
      isConfigured: true,
      isReady: true,
      missing: [],
    },
    ...overrides,
  };
}

function makeSettings(overrides: Partial<SettingsConfig> = {}): SettingsConfig {
  return {
    theme: "auto",
    defaultLenses: [],
    defaultProfile: null,
    severityThreshold: "low",
    secretsStorage: "file",
    agentExecution: "parallel",
    ...overrides,
  };
}

describe("buildHubValues — settings hub parity with web", () => {
  test("returns 'Not configured' when setup is incomplete", () => {
    const init = makeInit({
      config: null,
      setup: {
        hasSecretsStorage: false,
        hasProvider: false,
        hasModel: false,
        hasTrust: false,
        isConfigured: false,
        isReady: false,
        missing: ["secretsStorage", "provider", "model"],
      },
    });
    const values = buildHubValues(init, makeSettings());
    assert.equal(values.provider, "Not configured");
  });

  test("uppercases provider id when configured (matches web 'GEMINI')", () => {
    const values = buildHubValues(makeInit(), makeSettings());
    assert.equal(values.provider, "GEMINI");
  });

  test("uppercases theme value (matches web 'AUTO' / 'DARK')", () => {
    assert.equal(buildHubValues(makeInit(), makeSettings({ theme: "auto" })).theme, "AUTO");
    assert.equal(buildHubValues(makeInit(), makeSettings({ theme: "dark" })).theme, "DARK");
    assert.equal(buildHubValues(makeInit(), makeSettings({ theme: "light" })).theme, "LIGHT");
  });

  test("uppercases secrets storage; falls back to 'Not set'", () => {
    assert.equal(
      buildHubValues(makeInit(), makeSettings({ secretsStorage: "file" })).storage,
      "FILE",
    );
    assert.equal(
      buildHubValues(makeInit(), makeSettings({ secretsStorage: "keyring" })).storage,
      "KEYRING",
    );
    assert.equal(
      buildHubValues(makeInit(), makeSettings({ secretsStorage: null })).storage,
      "Not set",
    );
  });

  test("agent execution renders 'Parallel' or 'Sequential' (matches web casing)", () => {
    assert.equal(
      buildHubValues(makeInit(), makeSettings({ agentExecution: "parallel" }))["agent-execution"],
      "Parallel",
    );
    assert.equal(
      buildHubValues(makeInit(), makeSettings({ agentExecution: "sequential" }))["agent-execution"],
      "Sequential",
    );
  });

  test("trust value reflects readFiles capability (Trusted / Not trusted)", () => {
    const trustedInit = makeInit({
      project: {
        path: "/repo",
        projectId: "p",
        trust: {
          projectId: "p",
          repoRoot: "/repo",
          trustedAt: "2026-01-01T00:00:00.000Z",
          capabilities: { readFiles: true, runCommands: false },
          trustMode: "persistent",
        },
      },
    });
    assert.equal(buildHubValues(trustedInit, makeSettings()).trust, "Trusted");
    assert.equal(buildHubValues(makeInit(), makeSettings()).trust, "Not trusted");
  });

  test("analysis shows agent count or 'Default'", () => {
    assert.equal(
      buildHubValues(makeInit(), makeSettings({ defaultLenses: [] })).analysis,
      "Default",
    );
    assert.equal(
      buildHubValues(
        makeInit(),
        makeSettings({ defaultLenses: ["correctness", "security"] }),
      ).analysis,
      "2 agents",
    );
  });

  test("diagnostics is the constant 'Local'", () => {
    assert.equal(buildHubValues(makeInit(), makeSettings()).diagnostics, "Local");
  });

  test("returns sane defaults when both inputs are undefined", () => {
    const values = buildHubValues(undefined, undefined);
    assert.equal(values.provider, "Not configured");
    assert.equal(values.theme, "AUTO");
    assert.equal(values.storage, "Not set");
    assert.equal(values["agent-execution"], "Sequential");
    assert.equal(values.analysis, "Default");
    assert.equal(values.trust, "Not trusted");
    assert.equal(values.diagnostics, "Local");
  });
});
