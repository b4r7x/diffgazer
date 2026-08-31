import type { ProviderListRow } from "@diffgazer/core/providers";
import {
  buildProviderRows,
  configurationStatus,
  GEMINI_CONFIGURATION,
  OPENCODE_GO_CONFIGURATION,
  ZAI_CONFIGURATION,
} from "@diffgazer/core/testing/provider-fixtures";
import { cleanup, render } from "ink-testing-library";
import stripAnsi from "strip-ansi";
import { afterEach, describe, expect, test } from "vitest";
import { CliThemeProvider } from "../../../theme/provider";
import { ProviderList } from "./list";

/** "Google Gemini" plus "Gemini 2.5 Flash · gemini-2.5-flash" plus row chrome. */
const WIDTH_WITH_ROOM_FOR_THE_ID = 52;
const WIDTH_WITHOUT_ROOM_FOR_THE_ID = 40;

function renderList(rows: ProviderListRow[], contentWidth = WIDTH_WITH_ROOM_FOR_THE_ID): string {
  const { lastFrame } = render(
    <CliThemeProvider initialTheme="dark">
      <ProviderList
        providers={rows}
        unrecognized={[]}
        contentWidth={contentWidth}
        isActive={false}
      />
    </CliThemeProvider>,
  );
  return stripAnsi(lastFrame() ?? "");
}

afterEach(() => {
  cleanup();
});

describe("ProviderList", () => {
  // The wallet, not the product, is what the user bound, so the row names it.
  test("names a configured dual-pool row by the pool its runs will bill", () => {
    const frame = renderList(
      buildProviderRows([configurationStatus(OPENCODE_GO_CONFIGURATION, "ready")]),
    );

    expect(frame).toContain("OpenCode Go");
    expect(frame).not.toContain("OpenCode Zen");
  });

  test("subtitles a configured row with the catalog display name", () => {
    const frame = renderList(
      buildProviderRows([configurationStatus(GEMINI_CONFIGURATION, "ready")]),
      WIDTH_WITHOUT_ROOM_FOR_THE_ID,
    );

    expect(frame).toContain("Gemini 2.5 Flash");
    expect(frame).not.toContain("gemini-2.5-flash");
  });

  test("keeps the exact model id beside the name when the row has room", () => {
    const frame = renderList(
      buildProviderRows([configurationStatus(GEMINI_CONFIGURATION, "ready")]),
    );

    expect(frame).toContain("Gemini 2.5 Flash · gemini-2.5-flash");
  });

  test("marks an unverified configuration as selectable rather than as a problem", () => {
    const frame = renderList(
      buildProviderRows([
        configurationStatus(GEMINI_CONFIGURATION, "conformance-pending"),
        configurationStatus(ZAI_CONFIGURATION, "conformance-failed"),
      ]),
    );
    const geminiRow = frame.split("\n").find((line) => line.includes("Google Gemini")) ?? "";
    const zaiRow = frame.split("\n").find((line) => line.includes("Z.AI")) ?? "";

    expect(geminiRow).toContain("○");
    expect(geminiRow).not.toContain("!");
    expect(zaiRow).toContain("!");
  });

  test("falls back to the raw id for a model outside the bounded catalog", () => {
    const frame = renderList(buildProviderRows([configurationStatus(ZAI_CONFIGURATION, "ready")]));

    expect(frame).toContain("glm-4.7");
    expect(frame).not.toContain("glm-4.7 · glm-4.7");
  });
});
