import { cleanup, render } from "ink-testing-library";
import { afterEach, describe, expect, test, vi } from "vitest";
import { CliThemeProvider } from "../../theme/provider";
import { RadioGroup } from "./radio";

afterEach(() => {
  cleanup();
});

const ARROW_UP = "\u001b[A";
const ARROW_DOWN = "\u001b[B";
const ARROW_LEFT = "\u001b[D";
const ARROW_RIGHT = "\u001b[C";
const RETURN = "\r";
const SPACE = " ";

async function flush(times = 4): Promise<void> {
  for (let i = 0; i < times; i += 1) {
    await new Promise((resolve) => setImmediate(resolve));
  }
}

function renderGroup(props: Partial<Parameters<typeof RadioGroup>[0]> = {}) {
  return render(
    <CliThemeProvider initialTheme="dark">
      <RadioGroup isActive {...props}>
        <RadioGroup.Item value="a" label="Alpha" />
        <RadioGroup.Item value="b" label="Bravo" disabled />
        <RadioGroup.Item value="c" label="Charlie" />
      </RadioGroup>
    </CliThemeProvider>,
  );
}

describe("RadioGroup navigation", () => {
  test("return selects the first selectable item by default", async () => {
    const onChange = vi.fn();
    const { stdin } = renderGroup({ onChange });
    await flush();

    stdin.write(RETURN);
    await flush();
    expect(onChange).toHaveBeenLastCalledWith("a");
  });

  test("arrow down skips disabled items and return selects the next selectable", async () => {
    const onChange = vi.fn();
    const onHighlightChange = vi.fn();
    const { stdin } = renderGroup({ onChange, onHighlightChange });
    await flush();

    stdin.write(ARROW_DOWN);
    await flush();
    expect(onHighlightChange).toHaveBeenLastCalledWith("c");

    stdin.write(RETURN);
    await flush();
    expect(onChange).toHaveBeenLastCalledWith("c");
    expect(onChange).not.toHaveBeenCalledWith("b");
  });

  test("moving up from the first item wraps to the last selectable", async () => {
    const onHighlightChange = vi.fn();
    const { stdin } = renderGroup({ onHighlightChange });
    await flush();

    stdin.write(ARROW_UP);
    await flush();
    expect(onHighlightChange).toHaveBeenLastCalledWith("c");
  });

  test("horizontal orientation navigates with left and right arrows", async () => {
    const onChange = vi.fn();
    const onHighlightChange = vi.fn();
    const { stdin } = renderGroup({
      orientation: "horizontal",
      onChange,
      onHighlightChange,
    });
    await flush();

    stdin.write(ARROW_RIGHT);
    await flush();
    expect(onHighlightChange).toHaveBeenLastCalledWith("c");

    stdin.write(SPACE);
    await flush();
    expect(onChange).toHaveBeenLastCalledWith("c");

    stdin.write(ARROW_LEFT);
    await flush();
    expect(onHighlightChange).toHaveBeenLastCalledWith("a");
  });

  test("does not respond to input when the group is disabled", async () => {
    const onChange = vi.fn();
    const { stdin } = renderGroup({ disabled: true, onChange });
    await flush();

    stdin.write(RETURN);
    await flush();
    expect(onChange).not.toHaveBeenCalled();
  });
});
