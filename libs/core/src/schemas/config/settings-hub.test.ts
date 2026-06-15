import { describe, expect, test } from "vitest";
import type { SettingsHubInput } from "./settings-hub.js";
import { buildHubValues } from "./settings-hub.js";

function makeInput(overrides: Partial<SettingsHubInput> = {}): SettingsHubInput {
  return {
    provider: "gemini",
    isConfigured: true,
    isTrusted: false,
    theme: "auto",
    secretsStorage: "file",
    agentExecution: "parallel",
    selectedLensCount: 0,
    ...overrides,
  };
}

describe("buildHubValues", () => {
  test("returns 'Not configured' when setup is incomplete", () => {
    expect(buildHubValues(makeInput({ provider: null, isConfigured: false })).provider).toBe(
      "Not configured",
    );
  });

  test("uppercases provider and theme values", () => {
    const values = buildHubValues(makeInput());
    expect(values.provider).toBe("GEMINI");
    expect(values.theme).toBe("AUTO");
  });

  test.each([
    { secretsStorage: "file" as const, rendered: "FILE" },
    { secretsStorage: "keyring" as const, rendered: "KEYRING" },
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

  test("returns sane defaults when values are missing", () => {
    const values = buildHubValues(
      makeInput({
        provider: null,
        isConfigured: false,
        isTrusted: false,
        theme: undefined,
        secretsStorage: undefined,
        agentExecution: undefined,
        selectedLensCount: undefined,
      }),
    );
    expect(values.provider).toBe("Not configured");
    expect(values.theme).toBe("AUTO");
    expect(values.storage).toBe("Not set");
    expect(values["agent-execution"]).toBe("Sequential");
    expect(values.analysis).toBe("Default");
    expect(values.trust).toBe("Not trusted");
    expect(values.diagnostics).toBe("Local");
  });
});
