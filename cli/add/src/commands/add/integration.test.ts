import { afterEach, beforeEach, describe, expect, test } from "vitest";
import { resolveIntegrations } from "./integration.js";

// Force a non-interactive terminal so canPrompt() is false regardless of how
// vitest is launched: this exercises the real non-interactive integration-
// selection path through the production promptSelect call rather than a
// hand-supplied guidance stub, and never blocks on a real clack prompt.
describe("resolveIntegrations non-interactive selection", () => {
  const originalStdin = process.stdin.isTTY;
  const originalStdout = process.stdout.isTTY;

  beforeEach(() => {
    process.stdin.isTTY = false;
    process.stdout.isTTY = false;
  });

  afterEach(() => {
    process.stdin.isTTY = originalStdin;
    process.stdout.isTTY = originalStdout;
  });

  test("fails with the actionable --integration flag when a selection is required", async () => {
    await expect(resolveIntegrations(["select"], "ask", false)).rejects.toThrow(
      "--integration copy|keys|none",
    );
  });

  test("resolves without prompting when the mode is given explicitly", async () => {
    await expect(resolveIntegrations(["select"], "copy", false)).resolves.toEqual({
      mode: "copy",
      hasKeyboardIntegration: true,
    });
  });
});
