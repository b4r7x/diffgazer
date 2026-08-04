import type { ProviderDisplayStatus } from "@diffgazer/core/providers";
import { cleanup, render } from "ink-testing-library";
import { afterEach, describe, expect, test, vi } from "vitest";
import { CliThemeProvider } from "../../theme/provider";
import { fitProviderLabel, Header } from "./header";

vi.mock("../../hooks/use-terminal-dimensions", () => ({
  useResponsive: () => ({
    columns: 80,
    rows: 24,
    tier: "medium",
    isNarrow: false,
    isMedium: true,
    isWide: false,
  }),
}));

const activeStatus: ProviderDisplayStatus = {
  status: "ready",
  action: "inspect",
  label: "active",
  shortLabel: "ready",
  variant: "success",
  explanation: "",
  remediation: "",
  accessibleText: "active",
};

afterEach(() => {
  cleanup();
});

describe("Header", () => {
  test("keeps a long model identifier inside the fixed header rows at 80 columns", () => {
    const uniquePrefix = "zx9Qv";
    const providerName = `${uniquePrefix}OpenRouter · ${"model-segment-".repeat(4)}`;
    const view = render(
      <CliThemeProvider initialTheme="dark">
        <Header providerName={providerName} providerStatus={activeStatus} showBack />
      </CliThemeProvider>,
    );

    const frame = view.lastFrame() ?? "";
    expect(frame.split("\n")).toHaveLength(3);
    expect(frame).toContain("diffgazer");
    expect(frame).toContain("· active");
    expect(frame).toContain(uniquePrefix);
    expect(frame).toContain("← Back");

    view.rerender(
      <CliThemeProvider initialTheme="dark">
        <Header providerName={providerName} providerStatus={activeStatus} showBack={false} />
      </CliThemeProvider>,
    );

    const frameWithoutBack = view.lastFrame() ?? "";
    expect(frameWithoutBack).not.toContain("← Back");
  });
});

describe("fitProviderLabel", () => {
  test("keeps the full provider / model label when it fits", () => {
    expect(fitProviderLabel("gemini / gemini-3-flash", 40)).toBe("gemini / gemini-3-flash");
  });

  test("drops the provider prefix instead of eliding the model when space runs out", () => {
    expect(fitProviderLabel("gemini / gemini-3-flash-preview", 24)).toBe("gemini-3-flash-preview");
  });

  test("leaves a label without a model segment untouched", () => {
    expect(fitProviderLabel("Not configured", 4)).toBe("Not configured");
  });
});
