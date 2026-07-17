import { cleanup, render } from "ink-testing-library";
import { afterEach, describe, expect, test, vi } from "vitest";
import { waitUntil } from "../../testing/wait-until";
import { CliThemeProvider } from "../../theme/provider";
import { Menu } from "./menu";

afterEach(() => {
  cleanup();
});

const ARROW_DOWN = "\u001b[B";
const RETURN = "\r";
const ESCAPE = "\u001b";

async function flush(times = 4): Promise<void> {
  for (let i = 0; i < times; i += 1) {
    await new Promise((resolve) => setImmediate(resolve));
  }
}

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

  test("escape closes the menu", async () => {
    const onClose = vi.fn();
    const { stdin } = renderMenu({ onClose });
    await flush();

    stdin.write(ESCAPE);
    await waitUntil(() => onClose.mock.calls.length === 1);
    expect(onClose).toHaveBeenCalledTimes(1);
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
