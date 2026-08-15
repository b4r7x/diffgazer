import type { HomeContextInfo } from "@diffgazer/core/schemas/presentation";
import { Box } from "ink";
import { cleanup, render } from "ink-testing-library";
import stripAnsi from "strip-ansi";
import { afterEach, describe, expect, test } from "vitest";
import { CliThemeProvider } from "../../../theme/provider";
import { ContextSidebar } from "./context-sidebar";

afterEach(() => {
  cleanup();
});

describe("ContextSidebar (TUI)", () => {
  test("renders trusted, provider, and last-run context when data is present", () => {
    const context: HomeContextInfo = {
      providerName: "openrouter",
      providerModel: "openrouter/test-model",
      trustedDir: "/repo",
      lastRunId: "12345678-1234-4123-8123-123456789abc",
      lastRunIssueCount: 2,
    };
    const { lastFrame } = render(
      <CliThemeProvider initialTheme="dark">
        <ContextSidebar context={context} isTrusted projectPath="/repo" />
      </CliThemeProvider>,
    );

    const frame = lastFrame() ?? "";
    expect(frame).toContain("Trusted: /repo");
    expect(frame).toContain("Provider: openrouter (openrouter/test-model)");
    expect(frame).toContain("Last Run: #12345678 (2 issues)");
    expect(frame).not.toContain("12345678-1234");
  });

  test("renders the singular noun for a one-issue last run", () => {
    const context: HomeContextInfo = {
      trustedDir: "/repo",
      lastRunId: "12345678-1234-4123-8123-123456789abc",
      lastRunIssueCount: 1,
    };
    const { lastFrame } = render(
      <CliThemeProvider initialTheme="dark">
        <ContextSidebar context={context} isTrusted projectPath="/repo" />
      </CliThemeProvider>,
    );

    expect(lastFrame() ?? "").toContain("Last Run: #12345678 (1 issue)");
  });

  test("renders every context row with explicit values when data is absent", () => {
    const { lastFrame } = render(
      <CliThemeProvider initialTheme="dark">
        <ContextSidebar context={{}} isTrusted={false} />
      </CliThemeProvider>,
    );

    const frame = lastFrame() ?? "";
    expect(frame).toContain("Not trusted: —");
    expect(frame).toContain("Provider: Not configured");
    expect(frame).toContain("Last Run: None");
  });

  test("keeps the model id's tail readable in the 100-column home sidebar", () => {
    const context: HomeContextInfo = {
      providerName: "gemini",
      providerModel: "gemini-2.5-pro",
      trustedDir: "/repo",
    };
    const { lastFrame } = render(
      <CliThemeProvider initialTheme="dark">
        {/* The width LoadedHomeScreen grants the sidebar at 100 columns. */}
        <Box width={36}>
          <ContextSidebar context={context} isTrusted projectPath="/repo" />
        </Box>
      </CliThemeProvider>,
    );

    const frame = lastFrame() ?? "";
    const providerLine = frame.split("\n").find((line) => line.includes("Provider:"));

    expect(providerLine, frame).toBeDefined();
    // The parenthesis closes: the row identifies the model by both ends rather
    // than dropping its tail one character short.
    expect(providerLine).toContain("gemini");
    expect(providerLine).toContain("pro)");
  });

  test("keeps long repository and provider values inside a narrow sidebar", () => {
    const context: HomeContextInfo = {
      providerName: "openrouter",
      providerModel: "vendor/extremely-long-model-name-that-must-not-wrap",
      trustedDir: "/workspace/a/very/long/repository/path/with/a-distinct-tail",
    };
    const { lastFrame } = render(
      <CliThemeProvider initialTheme="dark">
        <Box width={30}>
          <ContextSidebar context={context} isTrusted />
        </Box>
      </CliThemeProvider>,
    );

    const frame = lastFrame() ?? "";
    const lines = frame.split("\n");
    const trustedLines = lines.filter((line) => line.includes("Trusted:"));
    expect(trustedLines, frame).toHaveLength(1);
    expect(trustedLines[0]).toContain("tail");
    expect(
      lines.filter((line) => line.includes("Provider:")),
      frame,
    ).toHaveLength(1);
    expect(frame).not.toContain("must-not-wrap");
  });

  test("strips OSC control bytes from repository paths", () => {
    const maliciousPath = "/repo/\u001b]0;evil-title\u0007tail";
    const context: HomeContextInfo = {
      providerName: "gemini",
      providerModel: "gemini-2.5-pro",
      trustedDir: maliciousPath,
    };
    const { lastFrame } = render(
      <CliThemeProvider initialTheme="dark">
        <ContextSidebar context={context} isTrusted projectPath={maliciousPath} />
      </CliThemeProvider>,
    );

    const frame = stripAnsi(lastFrame() ?? "");
    expect(frame).toContain("/repo/");
    expect(frame).toContain("tail");
    expect(frame).not.toContain("\u001b]0;");
    expect(frame).not.toContain("evil-title");
  });
});
