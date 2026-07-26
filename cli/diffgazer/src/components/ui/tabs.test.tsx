import { Text } from "ink";
import { cleanup, render } from "ink-testing-library";
import { afterEach, describe, expect, test, vi } from "vitest";
import { flush } from "../../testing/flush";
import { CliThemeProvider } from "../../theme/provider";
import { Tabs } from "./tabs";

afterEach(() => {
  cleanup();
});

const ARROW_LEFT = "[D";
const ARROW_RIGHT = "[C";

function renderTabs(
  listProps: Partial<Parameters<typeof Tabs.List>[0]> = {},
  rootProps: Partial<Parameters<typeof Tabs>[0]> = {},
) {
  return render(
    <CliThemeProvider initialTheme="dark">
      <Tabs defaultValue="a" {...rootProps}>
        <Tabs.List isActive {...listProps}>
          <Tabs.Trigger value="a">Alpha</Tabs.Trigger>
          <Tabs.Trigger value="b" disabled>
            Bravo
          </Tabs.Trigger>
          <Tabs.Trigger value="c">Charlie</Tabs.Trigger>
        </Tabs.List>
        <Tabs.Content value="a">
          <Text>Alpha panel</Text>
        </Tabs.Content>
        <Tabs.Content value="c">
          <Text>Charlie panel</Text>
        </Tabs.Content>
      </Tabs>
    </CliThemeProvider>,
  );
}

describe("Tabs navigation", () => {
  test("shows the default tab's content", async () => {
    const { lastFrame } = renderTabs();
    await flush();
    expect(lastFrame()).toContain("Alpha panel");
    expect(lastFrame()).not.toContain("Charlie panel");
  });

  test("right arrow moves the active tab and skips disabled triggers", async () => {
    const onChange = vi.fn();
    const { lastFrame, stdin } = renderTabs({}, { onChange });
    await flush();

    stdin.write(ARROW_RIGHT);
    await flush();
    expect(onChange).toHaveBeenLastCalledWith("c");
    expect(onChange).not.toHaveBeenCalledWith("b");
    expect(lastFrame()).toContain("Charlie panel");
    expect(lastFrame()).not.toContain("Alpha panel");
  });

  test("left arrow moves the active tab back and skips disabled triggers", async () => {
    const onChange = vi.fn();
    const { lastFrame, stdin } = renderTabs({}, { defaultValue: "c", onChange });
    await flush();

    stdin.write(ARROW_LEFT);
    await flush();
    expect(onChange).toHaveBeenLastCalledWith("a");
    expect(onChange).not.toHaveBeenCalledWith("b");
    expect(lastFrame()).toContain("Alpha panel");
  });

  test("wraps past the last tab when loop is true", async () => {
    const onChange = vi.fn();
    const { stdin } = renderTabs({ loop: true }, { defaultValue: "c", onChange });
    await flush();

    stdin.write(ARROW_RIGHT);
    await flush();
    expect(onChange).toHaveBeenLastCalledWith("a");
  });

  test("does not wrap past the last tab when loop is false", async () => {
    const onChange = vi.fn();
    const { lastFrame, stdin } = renderTabs({ loop: false }, { defaultValue: "c", onChange });
    await flush();

    stdin.write(ARROW_RIGHT);
    await flush();
    expect(onChange).not.toHaveBeenCalledWith("a");
    expect(lastFrame()).toContain("Charlie panel");
    expect(lastFrame()).not.toContain("Alpha panel");
  });

  test("ignores input when the list is inactive", async () => {
    const onChange = vi.fn();
    const { stdin } = renderTabs({ isActive: false }, { onChange });
    await flush();

    stdin.write(ARROW_RIGHT);
    await flush();
    expect(onChange).not.toHaveBeenCalled();
  });
});
