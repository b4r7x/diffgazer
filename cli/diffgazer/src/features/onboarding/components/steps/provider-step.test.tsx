import { PRODUCT_REGISTRY, SELECTABLE_PRODUCT_IDS } from "@diffgazer/core/providers";
import { cleanup, render } from "ink-testing-library";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { CliThemeProvider } from "../../../../theme/provider";
import { ProviderStep } from "./provider-step";

const terminalDimensions = vi.hoisted(() => ({ current: { columns: 80, rows: 24 } }));

vi.mock("../../../../hooks/use-terminal-dimensions", () => ({
  useTerminalDimensions: () => terminalDimensions.current,
}));

async function flushInk() {
  await new Promise((resolve) => setImmediate(resolve));
}

function renderStep(onChange = vi.fn()) {
  return render(
    <CliThemeProvider initialTheme="dark">
      <ProviderStep value="gemini" onChange={onChange} />
    </CliThemeProvider>,
  );
}

describe("ProviderStep (TUI)", () => {
  beforeEach(() => {
    terminalDimensions.current = { columns: 80, rows: 24 };
  });

  afterEach(() => {
    cleanup();
  });

  test("lists all 12 selectable products with shared names and descriptions", async () => {
    terminalDimensions.current = { columns: 80, rows: 60 };
    const onChange = vi.fn();
    const { lastFrame, stdin } = renderStep(onChange);

    const frame = lastFrame() ?? "";
    expect(SELECTABLE_PRODUCT_IDS).toHaveLength(12);
    for (const productId of SELECTABLE_PRODUCT_IDS) {
      expect(frame).toContain(PRODUCT_REGISTRY[productId].presentation.name);
    }
    expect(frame).toContain(PRODUCT_REGISTRY.openrouter.presentation.description);

    stdin.write("\u001b[B");
    await flushInk();
    stdin.write("\u001b[B");
    await flushInk();
    stdin.write("\r");
    await flushInk();
    expect(onChange).toHaveBeenCalledWith("openrouter");
  });

  test("windows the list at the 80 by 24 floor and scrolls to every product", async () => {
    const onChange = vi.fn();
    const { lastFrame, stdin } = renderStep(onChange);
    const lastProductId = SELECTABLE_PRODUCT_IDS.at(-1) ?? "gemini";
    const lastProductName = PRODUCT_REGISTRY[lastProductId].presentation.name;

    expect(lastFrame()).toContain("Google Gemini");
    expect(lastFrame()).not.toContain(lastProductName);

    for (let step = 1; step < SELECTABLE_PRODUCT_IDS.length; step += 1) {
      stdin.write("\u001b[B");
      await flushInk();
    }
    expect(lastFrame()).toContain(lastProductName);
    stdin.write("\r");
    await flushInk();
    expect(onChange).toHaveBeenCalledWith(lastProductId);
  });
});
