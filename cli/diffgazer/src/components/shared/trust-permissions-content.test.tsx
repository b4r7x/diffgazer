import { cleanup, render } from "ink-testing-library";
import stripAnsi from "strip-ansi";
import { afterEach, describe, expect, test, vi } from "vitest";
import { CliThemeProvider } from "../../theme/provider";
import { TrustPermissionsContent } from "./trust-permissions-content";

afterEach(() => {
  cleanup();
});

describe("TrustPermissionsContent", () => {
  test("strips OSC control bytes from the target repository path", () => {
    const maliciousPath = "/repo/\u001b]0;evil-title\u0007tail";
    const { lastFrame } = render(
      <CliThemeProvider initialTheme="dark">
        <TrustPermissionsContent
          directory={maliciousPath}
          value={{ readFiles: true, runCommands: false }}
          onChange={vi.fn()}
        />
      </CliThemeProvider>,
    );

    const frame = stripAnsi(lastFrame() ?? "");
    expect(frame).toContain("/repo/");
    expect(frame).toContain("tail");
    expect(frame).not.toContain("\u001b]0;");
    expect(frame).not.toContain("evil-title");
  });
});
