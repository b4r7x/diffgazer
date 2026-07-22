import { cleanup, render } from "ink-testing-library";
import { afterEach, describe, expect, test } from "vitest";
import { CliThemeProvider } from "../../../theme/provider";
import { ProgressStep } from "./step";

afterEach(() => {
  cleanup();
});

describe("ProgressStep", () => {
  test("keeps completed and pending labels aligned with single-cell ASCII markers", () => {
    const { lastFrame } = render(
      <CliThemeProvider initialTheme="dark">
        <ProgressStep name="Completed" status="completed" />
        <ProgressStep name="Pending" status="pending" />
      </CliThemeProvider>,
    );

    const lines = (lastFrame() ?? "").split("\n");
    expect(lines).toEqual(["* Completed", "- Pending"]);
  });
});
