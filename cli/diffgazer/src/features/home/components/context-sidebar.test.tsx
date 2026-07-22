import type { ContextInfo } from "@diffgazer/core/schemas/presentation";
import { Box } from "ink";
import { cleanup, render } from "ink-testing-library";
import { afterEach, describe, expect, test } from "vitest";
import { CliThemeProvider } from "../../../theme/provider";
import { ContextSidebar } from "./context-sidebar";

afterEach(() => {
  cleanup();
});

describe("ContextSidebar (TUI)", () => {
  test("renders trusted, provider, and last-run context when data is present", () => {
    const context: ContextInfo = {
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

  test("keeps long repository and provider values inside a narrow sidebar", () => {
    const context: ContextInfo = {
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
});
