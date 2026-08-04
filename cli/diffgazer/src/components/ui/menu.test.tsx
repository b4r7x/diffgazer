import { Box } from "ink";
import { cleanup, render } from "ink-testing-library";
import { afterEach, describe, expect, test, vi } from "vitest";
import { flush } from "../../testing/flush";
import { CliThemeProvider } from "../../theme/provider";
import { Menu } from "./menu";

afterEach(() => {
  cleanup();
});

const ARROW_DOWN = "\u001b[B";
const ARROW_UP = "\u001b[A";
const RETURN = "\r";

function renderMenu(props: Partial<Parameters<typeof Menu>[0]> = {}) {
  return render(
    <CliThemeProvider initialTheme="dark">
      <Menu isActive {...props}>
        <Menu.Item id="a">Alpha</Menu.Item>
        <Menu.Item id="b" disabled>
          Bravo
        </Menu.Item>
        <Menu.Item id="c">Charlie</Menu.Item>
      </Menu>
    </CliThemeProvider>,
  );
}

describe("Menu navigation", () => {
  test("highlights the first selectable item by default", async () => {
    const { lastFrame } = renderMenu();
    await flush();
    expect(lastFrame()).toContain("> Alpha");
  });

  test("skips disabled items when moving down and wraps at the boundary", async () => {
    const onHighlightChange = vi.fn();
    const { lastFrame, stdin } = renderMenu({ onHighlightChange });
    await flush();

    stdin.write(ARROW_DOWN);
    await flush();
    expect(onHighlightChange).toHaveBeenLastCalledWith("c");
    expect(lastFrame()).toContain("> Charlie");

    stdin.write(ARROW_DOWN);
    await flush();
    expect(onHighlightChange).toHaveBeenLastCalledWith("a");

    stdin.write(ARROW_UP);
    await flush();
    expect(onHighlightChange).toHaveBeenLastCalledWith("c");
    expect(lastFrame()).toContain("> Charlie");
  });

  test("moves the highlight on j and k, skipping disabled items", async () => {
    const onHighlightChange = vi.fn();
    const { lastFrame, stdin } = renderMenu({ onHighlightChange });
    await flush();

    stdin.write("j");
    await flush();
    expect(onHighlightChange).toHaveBeenLastCalledWith("c");
    expect(lastFrame()).toContain("> Charlie");

    stdin.write("k");
    await flush();
    expect(onHighlightChange).toHaveBeenLastCalledWith("a");
    expect(lastFrame()).toContain("> Alpha");
  });

  test("a j hotkey never both moves the highlight and selects its item", async () => {
    const onSelect = vi.fn();
    const onHighlightChange = vi.fn();
    const { stdin } = render(
      <CliThemeProvider initialTheme="dark">
        <Menu isActive onSelect={onSelect} onHighlightChange={onHighlightChange}>
          <Menu.Item id="a">Alpha</Menu.Item>
          <Menu.Item id="c" hotkey="j">
            Charlie
          </Menu.Item>
        </Menu>
      </CliThemeProvider>,
    );
    await flush();

    stdin.write("j");
    await flush();

    expect(onHighlightChange).toHaveBeenCalledWith("c");
    expect(onSelect).not.toHaveBeenCalled();
  });

  test("return selects the highlighted item and never selects a disabled item", async () => {
    const onSelect = vi.fn();
    const { stdin } = renderMenu({ onSelect });
    await flush();

    stdin.write(RETURN);
    await flush();
    expect(onSelect).toHaveBeenCalledWith("a");

    stdin.write(ARROW_DOWN);
    await flush();
    stdin.write(RETURN);
    await flush();
    expect(onSelect).toHaveBeenLastCalledWith("c");
    expect(onSelect).not.toHaveBeenCalledWith("b");
  });

  test("a hotkey selects its item regardless of the current highlight", async () => {
    const onSelect = vi.fn();
    const { stdin } = render(
      <CliThemeProvider initialTheme="dark">
        <Menu isActive onSelect={onSelect}>
          <Menu.Item id="a">Alpha</Menu.Item>
          <Menu.Item id="c" hotkey="3">
            Charlie
          </Menu.Item>
        </Menu>
      </CliThemeProvider>,
    );
    await flush();

    stdin.write("3");
    await flush();
    expect(onSelect).toHaveBeenCalledWith("c");
  });

  test("does not respond to input when inactive", async () => {
    const onHighlightChange = vi.fn();
    const { stdin } = renderMenu({ isActive: false, onHighlightChange });
    await flush();

    stdin.write(ARROW_DOWN);
    await flush();
    expect(onHighlightChange).not.toHaveBeenCalled();
  });
});

describe("Menu.Divider", () => {
  test("draws a rule across the full menu width instead of a fixed-length run", async () => {
    const { lastFrame } = render(
      <CliThemeProvider initialTheme="dark">
        <Box width={30}>
          <Menu isActive>
            <Menu.Item id="a">Alpha</Menu.Item>
            <Menu.Divider />
            <Menu.Item id="c">Charlie</Menu.Item>
          </Menu>
        </Box>
      </CliThemeProvider>,
    );
    await flush();

    const ruleRow = (lastFrame() ?? "").split("\n").find((row) => row.includes("─"));
    expect(ruleRow).toBe("─".repeat(30));
  });
});

describe("Menu.Item hotkey column", () => {
  test("keeps a disabled row aligned with its siblings without advertising its key", async () => {
    const { lastFrame } = render(
      <CliThemeProvider initialTheme="dark">
        <Menu isActive>
          <Menu.Item id="a" hotkey="r">
            Alpha
          </Menu.Item>
          <Menu.Item id="b" hotkey="l" disabled>
            Bravo
          </Menu.Item>
        </Menu>
      </CliThemeProvider>,
    );
    await flush();
    const rows = (lastFrame() ?? "").split("\n");

    expect(rows[0]).toBe("> r. Alpha");
    expect(rows[1]).toBe("     Bravo");
  });
});
