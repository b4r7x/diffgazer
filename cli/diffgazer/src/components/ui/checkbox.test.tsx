import { cleanup, render } from "ink-testing-library";
import { afterEach, describe, expect, test, vi } from "vitest";
import { CliThemeProvider } from "../../theme/provider";
import { CheckboxGroup } from "./checkbox";

afterEach(() => {
  cleanup();
});

const ARROW_UP = "\u001b[A";
const ARROW_DOWN = "\u001b[B";
const SPACE = " ";

async function flush(times = 4): Promise<void> {
  for (let i = 0; i < times; i += 1) {
    await new Promise((resolve) => setImmediate(resolve));
  }
}

function renderGroup(props: Partial<Parameters<typeof CheckboxGroup>[0]> = {}) {
  return render(
    <CliThemeProvider initialTheme="dark">
      <CheckboxGroup isActive {...props}>
        <CheckboxGroup.Item value="a" label="Alpha" />
        <CheckboxGroup.Item value="b" label="Bravo" disabled />
        <CheckboxGroup.Item value="c" label="Charlie" />
      </CheckboxGroup>
    </CliThemeProvider>,
  );
}

describe("CheckboxGroup navigation", () => {
  test("space toggles the first selectable item by default", async () => {
    const onChange = vi.fn();
    const { stdin } = renderGroup({ onChange });
    await flush();

    stdin.write(SPACE);
    await flush();
    expect(onChange).toHaveBeenLastCalledWith(["a"]);
  });

  test("toggling the same item twice clears it", async () => {
    const onChange = vi.fn();
    const { stdin } = renderGroup({ onChange });
    await flush();

    stdin.write(SPACE);
    await flush();
    stdin.write(SPACE);
    await flush();
    expect(onChange).toHaveBeenLastCalledWith([]);
  });

  test("arrow down skips disabled items and space toggles the next selectable", async () => {
    const onChange = vi.fn();
    const onHighlightChange = vi.fn();
    const { stdin } = renderGroup({ onChange, onHighlightChange });
    await flush();

    stdin.write(ARROW_DOWN);
    await flush();
    expect(onHighlightChange).toHaveBeenLastCalledWith("c");

    stdin.write(SPACE);
    await flush();
    expect(onChange).toHaveBeenLastCalledWith(["c"]);
    expect(onChange).not.toHaveBeenCalledWith(["b"]);
  });

  test("moving down from the last item wraps to the first selectable", async () => {
    const onHighlightChange = vi.fn();
    const { stdin } = renderGroup({ onHighlightChange });
    await flush();

    stdin.write(ARROW_DOWN);
    await flush();
    stdin.write(ARROW_DOWN);
    await flush();
    expect(onHighlightChange).toHaveBeenLastCalledWith("a");
  });

  test("moving up from the first item wraps to the last selectable", async () => {
    const onHighlightChange = vi.fn();
    const { stdin } = renderGroup({ onHighlightChange });
    await flush();

    stdin.write(ARROW_UP);
    await flush();
    expect(onHighlightChange).toHaveBeenLastCalledWith("c");
  });

  test("does not respond to input when the group is disabled", async () => {
    const onChange = vi.fn();
    const { stdin } = renderGroup({ disabled: true, onChange });
    await flush();

    stdin.write(SPACE);
    await flush();
    expect(onChange).not.toHaveBeenCalled();
  });
});
