import { Text } from "ink";
import { cleanup, render } from "ink-testing-library";
import { useState } from "react";
import { afterEach, describe, expect, test, vi } from "vitest";
import { flush } from "../../testing/flush";
import { CliThemeProvider } from "../../theme/provider";
import { Tabs } from "./tabs";

afterEach(() => {
  cleanup();
});

const ARROW_LEFT = "\u001b[D";
const ARROW_RIGHT = "\u001b[C";

function Harness({
  initial = "a",
  onChange,
  listProps,
}: {
  initial?: string;
  onChange?: (value: string) => void;
  listProps?: Partial<Parameters<typeof Tabs.List>[0]>;
}) {
  const [value, setValue] = useState(initial);

  return (
    <Tabs
      value={value}
      onChange={(next) => {
        setValue(next);
        onChange?.(next);
      }}
    >
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
  );
}

function renderTabs(
  listProps: Partial<Parameters<typeof Tabs.List>[0]> = {},
  harnessProps: { initial?: string; onChange?: (value: string) => void } = {},
) {
  return render(
    <CliThemeProvider initialTheme="dark">
      <Harness {...harnessProps} listProps={listProps} />
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
    const { lastFrame, stdin } = renderTabs({}, { initial: "c", onChange });
    await flush();

    stdin.write(ARROW_LEFT);
    await flush();
    expect(onChange).toHaveBeenLastCalledWith("a");
    expect(onChange).not.toHaveBeenCalledWith("b");
    expect(lastFrame()).toContain("Alpha panel");
  });

  test("wraps past the last tab", async () => {
    const onChange = vi.fn();
    const { stdin } = renderTabs({}, { initial: "c", onChange });
    await flush();

    stdin.write(ARROW_RIGHT);
    await flush();
    expect(onChange).toHaveBeenLastCalledWith("a");
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
