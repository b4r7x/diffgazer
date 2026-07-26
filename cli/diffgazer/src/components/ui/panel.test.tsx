import { Text } from "ink";
import { cleanup, render } from "ink-testing-library";
import { afterEach, describe, expect, test } from "vitest";
import { CliThemeProvider } from "../../theme/provider";
import { Panel } from "./panel";

afterEach(cleanup);

function renderPanel(focused: boolean): string {
  const { lastFrame } = render(
    <CliThemeProvider initialTheme="dark">
      <Panel focused={focused}>
        <Panel.Content>
          <Text>body</Text>
        </Panel.Content>
      </Panel>
    </CliThemeProvider>,
  );
  return lastFrame() ?? "";
}

describe("Panel reticle", () => {
  test("rests on the plain hairline corners", () => {
    const frame = renderPanel(false);

    expect(frame).toContain("┌");
    expect(frame).toContain("┘");
    expect(frame).not.toContain("┏");
  });

  test("steps its corners up to the heavy weight while it holds focus", () => {
    const frame = renderPanel(true);

    for (const corner of ["┏", "┓", "┗", "┛"]) {
      expect(frame).toContain(corner);
    }
    expect(frame).not.toContain("┌");
  });

  test("keeps the edges light in both states, so only the corners carry focus", () => {
    for (const focused of [true, false]) {
      const frame = renderPanel(focused);
      expect(frame).toContain("─");
      expect(frame).toContain("│");
      expect(frame).not.toContain("━");
      expect(frame).not.toContain("┃");
    }
  });
});
