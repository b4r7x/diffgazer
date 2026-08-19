import { LIVE_ONLY_MODEL_DESCRIPTION } from "@diffgazer/core/providers";
import type { ModelInfo } from "@diffgazer/core/schemas/config";
import { cleanup, render } from "ink-testing-library";
import { afterEach, describe, expect, test } from "vitest";
import { getDialogWidth } from "../../../components/ui/dialog";
import { CliThemeProvider } from "../../../theme/provider";
import { ModelListItem } from "./model-list-item";

const model: ModelInfo = {
  id: "openai/gpt-4.1-mini",
  name: "safe‮spoof",
  description: "desc⁦tail",
  tier: "paid",
};

function renderRow(overrides: Partial<ModelInfo> = {}, maxWidth = 100) {
  return render(
    <CliThemeProvider initialTheme="dark">
      <ModelListItem
        model={{ ...model, ...overrides }}
        isHighlighted={false}
        isSelected={false}
        maxWidth={maxWidth}
      />
    </CliThemeProvider>,
  );
}

afterEach(() => {
  cleanup();
});

describe("ModelListItem", () => {
  test("escapes bidi formatting controls in model rows", () => {
    const frame = renderRow().lastFrame() ?? "";

    expect(frame).toContain("safe\\u202espoof");
    expect(frame).toContain("desc\\u2066tail");
    expect(frame).not.toContain("‮");
    expect(frame).not.toContain("⁦");
  });

  // The display name leads the row, but a pinned route is chosen by its id.
  test("keeps the exact model id visible beside the display name", () => {
    const frame = renderRow().lastFrame() ?? "";

    expect(frame).toContain("openai/gpt-4.1-mini");
    expect(frame).toContain("[PAID]");
  });

  test("prints no tier badge for a model the catalog does not price", () => {
    const frame = renderRow({ tier: "unknown" }).lastFrame() ?? "";

    expect(frame).not.toContain("[PAID]");
    expect(frame).not.toContain("[FREE]");
    expect(frame).not.toContain("unknown");
  });

  test("does not repeat the id when upstream publishes no display name", () => {
    const frame = renderRow({ name: "openai/gpt-4.1-mini", description: "" }).lastFrame() ?? "";

    expect(frame.match(/openai\/gpt-4\.1-mini/g)).toHaveLength(1);
  });

  // The model picker hands rows the dialog's content width; at the 80-column
  // floor the detail column truncates the tail, so the verdict must lead.
  test("keeps 'Pricing unknown' visible for a live-only row at the 80-column floor", () => {
    const contentWidth = getDialogWidth(80) - 6;
    const frame =
      renderRow(
        {
          id: "glm-5.3",
          name: "glm-5.3",
          description: LIVE_ONLY_MODEL_DESCRIPTION,
          tier: "unknown",
        },
        contentWidth,
      ).lastFrame() ?? "";

    expect(frame).toContain("Pricing unknown");
  });
});
