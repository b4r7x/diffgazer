import type { ProviderListRow } from "@diffgazer/core/providers";
import {
  buildProviderRows,
  configurationStatus,
  GEMINI_CONFIGURATION,
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

  test("falls back to the raw id for a model outside the bounded catalog", () => {
    const frame = renderList(buildProviderRows([configurationStatus(ZAI_CONFIGURATION, "ready")]));

    expect(frame).toContain("glm-4.7");
    expect(frame).not.toContain("glm-4.7 · glm-4.7");
  });
});
