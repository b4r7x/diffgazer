import { cleanup, render } from "ink-testing-library";
import { useState } from "react";
import { afterEach, describe, expect, test } from "vitest";
import { flush } from "../../../testing/flush";
import { CliThemeProvider } from "../../../theme/provider";
import { ModelSearchInput } from "./model-search-input";

const BACKSPACE = "\u007f";

function ControlledModelSearchInput() {
  const [value, setValue] = useState("claude😀");
  return <ModelSearchInput value={value} onChange={setValue} isActive />;
}

describe("ModelSearchInput", () => {
  afterEach(() => {
    cleanup();
  });

  test("Backspace removes a complete Unicode code point from the model query", async () => {
    const { lastFrame, stdin } = render(
      <CliThemeProvider initialTheme="dark">
        <ControlledModelSearchInput />
      </CliThemeProvider>,
    );
    await flush();

    expect(lastFrame()).toContain("claude😀");
    stdin.write(BACKSPACE);
    await flush();

    expect(lastFrame()).toContain("claude");
    expect(lastFrame()).not.toContain("😀");
    expect(lastFrame()).not.toContain("�");
  });
});
