import { test, describe, expect } from "vitest";
import type { InitResponse, SettingsConfig } from "@diffgazer/core/schemas/config";
import { buildHubValues } from "./hub-screen-values";

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
    expect(values.provider).toBe("Not configured");
  });

  test("uppercases provider id when configured (matches web 'GEMINI')", () => {
    const values = buildHubValues(makeInit(), makeSettings());
    expect(values.provider).toBe("GEMINI");
  });

  test.each([
    { theme: "auto" as const, rendered: "AUTO" },
    { theme: "dark" as const, rendered: "DARK" },
    { theme: "light" as const, rendered: "LIGHT" },
  ])("uppercases theme '$theme' to '$rendered' (matches web casing)", ({ theme, rendered }) => {
    expect(buildHubValues(makeInit(), makeSettings({ theme })).theme).toBe(rendered);
  });

  test.each([
    { secretsStorage: "file" as const, rendered: "FILE" },
    { secretsStorage: "keyring" as const, rendered: "KEYRING" },
    { secretsStorage: null, rendered: "Not set" },
  ])("renders secrets storage '$secretsStorage' as '$rendered'", ({ secretsStorage, rendered }) => {
    expect(
      buildHubValues(makeInit(), makeSettings({ secretsStorage })).storage,
    ).toBe(rendered);
  });

  test.each([
    { agentExecution: "parallel" as const, rendered: "Parallel" },
    { agentExecution: "sequential" as const, rendered: "Sequential" },
  ])("renders agent execution '$agentExecution' as '$rendered' (matches web casing)", ({ agentExecution, rendered }) => {
    expect(
      buildHubValues(makeInit(), makeSettings({ agentExecution }))["agent-execution"],
    ).toBe(rendered);
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
    expect(buildHubValues(trustedInit, makeSettings()).trust).toBe("Trusted");
    expect(buildHubValues(makeInit(), makeSettings()).trust).toBe("Not trusted");
  });

  test("analysis shows agent count or 'Default'", () => {
    expect(
      buildHubValues(makeInit(), makeSettings({ defaultLenses: [] })).analysis,
    ).toBe("Default");
    expect(
      buildHubValues(
        makeInit(),
        makeSettings({ defaultLenses: ["correctness", "security"] }),
      ).analysis,
    ).toBe("2 agents");
  });

  test("diagnostics is the constant 'Local'", () => {
    expect(buildHubValues(makeInit(), makeSettings()).diagnostics).toBe("Local");
  });

  test("returns sane defaults when both inputs are undefined", () => {
    const values = buildHubValues(undefined, undefined);
    expect(values.provider).toBe("Not configured");
    expect(values.theme).toBe("AUTO");
    expect(values.storage).toBe("Not set");
    expect(values["agent-execution"]).toBe("Sequential");
    expect(values.analysis).toBe("Default");
    expect(values.trust).toBe("Not trusted");
    expect(values.diagnostics).toBe("Local");
  });
});
