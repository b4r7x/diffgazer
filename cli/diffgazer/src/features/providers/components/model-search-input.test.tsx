import { cleanup, render } from "ink-testing-library";
import { useState } from "react";
import { afterEach, describe, expect, test } from "vitest";
import { CliThemeProvider } from "../../../theme/provider";
import { SearchInput } from "./model-search-input";

const BACKSPACE = "\u007f";

async function flush(times = 4): Promise<void> {
  for (let i = 0; i < times; i += 1) {
    await new Promise((resolve) => setImmediate(resolve));
  }
}

function ControlledModelSearchInput() {
  const [value, setValue] = useState("claude😀");
  return <SearchInput value={value} onChange={setValue} isActive />;
}

describe("SearchInput", () => {
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
