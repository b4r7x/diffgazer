import { PRODUCT_REGISTRY, SELECTABLE_PRODUCT_IDS } from "@diffgazer/core/providers";
import { cleanup, render } from "ink-testing-library";
import { afterEach, describe, expect, test, vi } from "vitest";
import { CliThemeProvider } from "../../../../theme/provider";
import { ProviderStep } from "./provider-step";

describe("ProviderStep (TUI)", () => {
  afterEach(() => {
    cleanup();
  });

  test("lists all 13 selectable products with shared names and descriptions", async () => {
    const onChange = vi.fn();
    const { lastFrame, stdin } = render(
      <CliThemeProvider initialTheme="dark">
        <ProviderStep value="gemini" onChange={onChange} />
      </CliThemeProvider>,
    );

    const frame = lastFrame() ?? "";
    expect(SELECTABLE_PRODUCT_IDS).toHaveLength(13);
    for (const productId of SELECTABLE_PRODUCT_IDS) {
      expect(frame).toContain(PRODUCT_REGISTRY[productId].presentation.name);
    }
    expect(frame).toContain(PRODUCT_REGISTRY.openrouter.presentation.description);

    stdin.write("\u001b[B");
    await new Promise((resolve) => setImmediate(resolve));
    stdin.write("\u001b[B");
    await new Promise((resolve) => setImmediate(resolve));
    stdin.write("\r");
    await new Promise((resolve) => setImmediate(resolve));
    expect(onChange).toHaveBeenCalledWith("openrouter");
  });
});
