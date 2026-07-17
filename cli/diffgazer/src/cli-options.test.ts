import { describe, expect, test } from "vitest";
import { HELP_TEXT, resolveCliAction } from "./cli-options";

describe("resolveCliAction", () => {
  test("help text describes the user-facing modes without internal surface labels", () => {
    expect(HELP_TEXT).toContain("Review code changes with Diffgazer in your browser or terminal.");
    expect(HELP_TEXT).not.toContain(["Product", "CLI"].join(" "));
  });

  test("starts the web flow by default and opens the browser", () => {
    expect(resolveCliAction([])).toEqual({
      type: "web",
      mode: "prod",
      openBrowser: true,
    });
  });

  test("starts beta TUI only when requested and keeps browser closed", () => {
    const action = resolveCliAction(["--tui"]);

    if (action.type !== "tui") {
      expect.fail(`expected tui action, got ${action.type}`);
    }
    expect(action.mode).toBe("prod");
    expect(action.openBrowser).toBe(false);
  });

  test("keeps dev mode and a supported theme for the TUI flow", () => {
    const action = resolveCliAction(["--dev", "--tui", "--theme", "high-contrast"]);

    expect(action).toEqual({
      type: "tui",
      mode: "dev",
      theme: "high-contrast",
      openBrowser: false,
    });
  });

  test("rejects unsupported TUI themes", () => {
    expect(() => resolveCliAction(["--tui", "--theme", "classic"])).toThrow(
      /Invalid --theme "classic"\. Expected one of: auto, dark, light, high-contrast\./,
    );
  });

  test("returns help action when --help is passed", () => {
    expect(resolveCliAction(["--help"])).toEqual({ type: "help" });
    expect(resolveCliAction(["-h"])).toEqual({ type: "help" });
  });

  test("returns version action when --version is passed", () => {
    expect(resolveCliAction(["--version"])).toEqual({ type: "version" });
    expect(resolveCliAction(["-V"])).toEqual({ type: "version" });
  });

  test("rejects --theme without --tui", () => {
    expect(() => resolveCliAction(["--theme", "classic"])).toThrow(/--theme requires --tui\./);
  });
});
