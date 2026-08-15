import { CREDENTIAL_ENV_VARS } from "@diffgazer/core/providers";
import { cleanup, render } from "ink-testing-library";
import { afterEach, describe, expect, test, vi } from "vitest";
import { CliThemeProvider } from "../../../../theme/provider";
import { ApiKeyStep } from "./api-key-step";

describe("ApiKeyStep (TUI)", () => {
  afterEach(() => {
    cleanup();
  });

  test("previews the canonical environment variable from core", async () => {
    const { lastFrame } = render(
      <CliThemeProvider initialTheme="dark">
        <ApiKeyStep
          productId="gemini"
          transportFamily="hosted-api"
          method="env"
          onMethodChange={vi.fn()}
          apiKey=""
          onApiKeyChange={vi.fn()}
        />
      </CliThemeProvider>,
    );

    const frame = lastFrame() ?? "";
    expect(frame).toContain(CREDENTIAL_ENV_VARS.gemini);
    expect(frame).not.toContain("GEMINI_API_KEY");
    expect(frame).toContain("Fixed for this provider");
  });

  test("uses the qwen credential mapping instead of vendor aliases", async () => {
    const { lastFrame } = render(
      <CliThemeProvider initialTheme="dark">
        <ApiKeyStep
          productId="qwen"
          transportFamily="hosted-api"
          method="env"
          onMethodChange={vi.fn()}
          apiKey=""
          onApiKeyChange={vi.fn()}
        />
      </CliThemeProvider>,
    );

    const frame = lastFrame() ?? "";
    expect(frame).toContain("QWEN_API_KEY");
    expect(frame).not.toContain("DASHSCOPE_API_KEY");
  });
});
