import { describe, expect, it } from "vitest";
import {
  AGENT_EXECUTION_OPTIONS,
  isAgentExecution,
  isSecretsStorage,
  isSelectableTheme,
  isTheme,
  resolveSelectableTheme,
  SECRETS_STORAGE_OPTIONS,
  SELECTABLE_THEME_OPTIONS,
  SETTINGS_SCREEN_COPY,
  toSelectableTheme,
} from "./settings-options.js";

describe("settings option contracts", () => {
  it("keeps the selectable theme options", () => {
    expect(SELECTABLE_THEME_OPTIONS.map((option) => option.value)).toEqual([
      "auto",
      "dark",
      "light",
    ]);
  });

  it("guards theme values correctly", () => {
    expect(isTheme("auto")).toBe(true);
    expect(isTheme("terminal")).toBe(true);
    expect(isTheme("unknown")).toBe(false);
    expect(isTheme(null)).toBe(false);

    expect(isSelectableTheme("dark")).toBe(true);
    expect(isSelectableTheme("terminal")).toBe(false);
    expect(isSelectableTheme(null)).toBe(false);
    expect(toSelectableTheme("terminal")).toBe("auto");
  });

  it("resolves auto from the system theme and preserves explicit themes", () => {
    expect(resolveSelectableTheme("auto", "dark")).toBe("dark");
    expect(resolveSelectableTheme("auto", "light")).toBe("light");
    expect(resolveSelectableTheme("dark", "light")).toBe("dark");
    expect(resolveSelectableTheme("light", "dark")).toBe("light");
  });

  it("keeps the canonical secrets storage options and guard", () => {
    expect(SECRETS_STORAGE_OPTIONS.map((option) => option.value)).toEqual(["file", "keyring"]);
    expect(isSecretsStorage("file")).toBe(true);
    expect(isSecretsStorage("keyring")).toBe(true);
    expect(isSecretsStorage("memory")).toBe(false);
  });

  it("keeps the canonical agent execution options and guard", () => {
    expect(AGENT_EXECUTION_OPTIONS.map((option) => option.value)).toEqual([
      "sequential",
      "parallel",
    ]);
    expect(isAgentExecution("sequential")).toBe(true);
    expect(isAgentExecution("parallel")).toBe(true);
    expect(isAgentExecution("concurrent")).toBe(false);
  });

  it("owns the settings screen headers both surfaces render", () => {
    expect(SETTINGS_SCREEN_COPY.storage).toEqual({
      title: "Secrets Storage",
      subtitle: "Choose where API keys and sensitive data should be stored.",
    });
    expect(SETTINGS_SCREEN_COPY["agent-execution"]).toEqual({
      title: "Agent Execution Mode",
      subtitle: "Choose whether analysis agents run in sequence or in parallel.",
    });
    expect(SETTINGS_SCREEN_COPY.analysis).toEqual({
      title: "Analysis Settings",
      subtitle: "Choose which lenses run during reviews.",
    });
  });
});
