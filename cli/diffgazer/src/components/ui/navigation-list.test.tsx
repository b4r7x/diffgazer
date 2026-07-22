import { Text } from "ink";
import { cleanup, render } from "ink-testing-library";
import { afterEach, describe, expect, test, vi } from "vitest";
import { CliThemeProvider } from "../../theme/provider";
import { NavigationList } from "./navigation-list";

afterEach(() => {
  cleanup();
});

const ARROW_UP = "[A";
const ARROW_DOWN = "[B";
const RETURN = "\r";

async function flush(times = 4): Promise<void> {
  for (let i = 0; i < times; i += 1) {
    await new Promise((resolve) => setImmediate(resolve));
  }
}

function renderList(props: Partial<Parameters<typeof NavigationList>[0]> = {}) {
  return render(
    <CliThemeProvider initialTheme="dark">
      <NavigationList isActive {...props}>
        <NavigationList.Item id="a">
          <Text>Alpha</Text>
        </NavigationList.Item>
        <NavigationList.Item id="b" disabled>
          <Text>Bravo</Text>
        </NavigationList.Item>
        <NavigationList.Item id="c">
          <Text>Charlie</Text>
        </NavigationList.Item>
      </NavigationList>
    </CliThemeProvider>,
  );
}

describe("NavigationList navigation", () => {
  test("highlights the first selectable item by default", async () => {
    const { lastFrame } = renderList();
    await flush();
    expect(lastFrame()).toContain("> Alpha");
  });

  test("renders the selected item prefix independently from the highlighted item", async () => {
    const { lastFrame } = renderList({ selectedId: "c" });
    await flush();
    const frame = lastFrame();
    expect(frame).toContain("| Charlie");
    expect(frame).toContain("> Alpha");
  });

  test("skips disabled items when moving down and wraps at the boundary", async () => {
    const onHighlightChange = vi.fn();
    const { stdin } = renderList({ onHighlightChange });
    await flush();

    stdin.write(ARROW_DOWN);
    await flush();
    expect(onHighlightChange).toHaveBeenLastCalledWith("c");

    stdin.write(ARROW_DOWN);
    await flush();
    expect(onHighlightChange).toHaveBeenLastCalledWith("a");
  });

  test("moving up from the first item wraps to the last selectable item", async () => {
    const onHighlightChange = vi.fn();
    const { stdin } = renderList({ onHighlightChange });
    await flush();

    stdin.write(ARROW_UP);
    await flush();
    expect(onHighlightChange).toHaveBeenLastCalledWith("c");
  });

  test("return selects the highlighted item and never selects a disabled item", async () => {
    const onSelect = vi.fn();
    const { stdin } = renderList({ onSelect });
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

  test("does not respond to input when inactive", async () => {
    const onHighlightChange = vi.fn();
    const { stdin } = renderList({ isActive: false, onHighlightChange });
    await flush();

    stdin.write(ARROW_DOWN);
    await flush();
    expect(onHighlightChange).not.toHaveBeenCalled();
  });

  test("navigates the full semantic item set when only a window is rendered", async () => {
    const onHighlightChange = vi.fn();
    const { stdin } = render(
      <CliThemeProvider initialTheme="dark">
        <NavigationList
          isActive
          highlightedId="a"
          navigationItems={[
            { id: "a", disabled: false },
            { id: "b", disabled: true },
            { id: "c", disabled: false },
          ]}
          onHighlightChange={onHighlightChange}
          wrap={false}
        >
          <NavigationList.Item id="a">
            <Text>Alpha</Text>
          </NavigationList.Item>
        </NavigationList>
      </CliThemeProvider>,
    );
    await flush();

    stdin.write(ARROW_DOWN);
    await flush();

    expect(onHighlightChange).toHaveBeenCalledWith("c");
  });
});
