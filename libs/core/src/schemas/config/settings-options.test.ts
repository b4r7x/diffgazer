import { describe, expect, it } from "vitest";
import {
  AGENT_EXECUTION_OPTIONS,
  isAgentExecution,
  isSecretsStorage,
  isSelectableTheme,
  isTheme,
  SECRETS_STORAGE_OPTIONS,
  SELECTABLE_THEME_OPTIONS,
  THEME_OPTIONS,
  toSelectableTheme,
} from "./settings-options.js";

describe("settings option contracts", () => {
  it("keeps the canonical theme options and selectable subset", () => {
    expect(THEME_OPTIONS.map((option) => option.value)).toEqual([
      "auto",
      "dark",
      "light",
      "terminal",
    ]);
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
});
