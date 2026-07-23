import { Box, Text } from "ink";
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

  test("reports the down boundary without wrapping when actions follow the list", async () => {
    const onHighlightChange = vi.fn();
    const onNavigationBoundaryReached = vi.fn();
    const { stdin } = renderGroup({
      wrap: false,
      onHighlightChange,
      onNavigationBoundaryReached,
    });
    await flush();

    stdin.write(ARROW_DOWN);
    await flush();
    expect(onHighlightChange).toHaveBeenLastCalledWith("c");

    stdin.write(ARROW_DOWN);
    await flush();
    expect(onNavigationBoundaryReached).toHaveBeenCalledExactlyOnceWith(1);
    expect(onHighlightChange).toHaveBeenCalledTimes(1);
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

  test.each([
    ["controlled", { value: "c" }],
    ["default", { defaultValue: "c" }],
  ])("starts highlight at the non-first %s selection before navigation", async (_kind, props) => {
    const onChange = vi.fn();
    const onHighlightChange = vi.fn();
    const { lastFrame, stdin } = renderGroup({ ...props, onChange, onHighlightChange });
    await flush();

    expect(lastFrame()).toContain("( * ) Charlie");
    stdin.write(RETURN);
    await flush();
    expect(onChange).toHaveBeenLastCalledWith("c");

    stdin.write(ARROW_DOWN);
    await flush();
    expect(onHighlightChange).toHaveBeenLastCalledWith("a");
    stdin.write(RETURN);
    await flush();
    expect(onChange).toHaveBeenLastCalledWith("a");
  });

  test("repairs an invalidated default highlight and keeps later movement uncontrolled", async () => {
    const onChange = vi.fn();
    const onHighlightChange = vi.fn();
    const renderItems = (includeCharlie: boolean) => (
      <CliThemeProvider initialTheme="dark">
        <RadioGroup defaultValue="c" onChange={onChange} onHighlightChange={onHighlightChange}>
          <RadioGroup.Item value="a" label="Alpha" />
          {includeCharlie && <RadioGroup.Item value="c" label="Charlie" />}
          <RadioGroup.Item value="d" label="Delta" />
        </RadioGroup>
      </CliThemeProvider>
    );
    const view = render(renderItems(true));
    await flush();

    view.rerender(renderItems(false));
    await flush();
    view.stdin.write(ARROW_DOWN);
    await flush();
    expect(onHighlightChange).toHaveBeenLastCalledWith("d");
    view.stdin.write(RETURN);
    await flush();
    expect(onChange).toHaveBeenLastCalledWith("d");
  });

  test("keeps top, middle, and bottom windows inside maxVisibleItems", async () => {
    const onChange = vi.fn();
    const view = render(
      <CliThemeProvider initialTheme="dark">
        <RadioGroup maxVisibleItems={3} onChange={onChange}>
          {Array.from({ length: 8 }, (_, index) => (
            <RadioGroup.Item
              key={`model-${String(index)}`}
              value={`model-${String(index)}`}
              label={`Model ${String(index)}`}
            />
          ))}
        </RadioGroup>
      </CliThemeProvider>,
    );
    await flush();

    const top = (view.lastFrame() ?? "").split("\n").filter(Boolean);
    expect(top).toHaveLength(2);
    expect(top.join("\n")).toContain("Model 0");
    expect(top.at(-1)).toContain("\u25BC");

    for (let index = 0; index < 5; index += 1) {
      view.stdin.write(ARROW_DOWN);
      await flush();
    }

    const middle = (view.lastFrame() ?? "").split("\n").filter(Boolean);
    expect(middle).toHaveLength(2);
    expect(middle[0]).toContain("\u25B2");
    expect(middle.join("\n")).toContain("Model 5");
    expect(middle.at(-1)).toContain("\u25BC");

    for (let index = 0; index < 2; index += 1) {
      view.stdin.write(ARROW_DOWN);
      await flush();
    }

    const bottom = (view.lastFrame() ?? "").split("\n").filter(Boolean);
    expect(bottom).toHaveLength(2);
    expect(bottom[0]).toContain("\u25B2");
    expect(bottom.join("\n")).toContain("Model 7");
    view.stdin.write(RETURN);
    await flush();
    expect(onChange).toHaveBeenLastCalledWith("model-7");
  });

  test("keeps the scroll indicator out of the content column when the model list is height-squeezed", async () => {
    // Mirrors the onboarding model step on a short terminal: a subtitle plus a
    // wrapped fallback notice sit above a windowed RadioGroup and the content
    // zone is one row too short for the full window. Before the gutter fix the
    // "▼" composited onto the last radio row ("▼   ) Snapshot Model 4"); it must
    // instead live in a right-hand gutter and never overwrite a row's "(".
    const { lastFrame } = render(
      <CliThemeProvider initialTheme="dark">
        <Box flexDirection="column" height={8} overflow="hidden">
          <Text>Select a model for Google Gemini.</Text>
          <Text>Using the bundled model catalog because live</Text>
          <Text>catalog data is unavailable. Press r to retry.</Text>
          <Box />
          <RadioGroup maxVisibleItems={6}>
            {Array.from({ length: 20 }, (_, index) => (
              <RadioGroup.Item
                key={`model-${String(index)}`}
                value={`model-${String(index)}`}
                label={`Snapshot Model ${String(index)}`}
              />
            ))}
          </RadioGroup>
        </Box>
      </CliThemeProvider>,
    );
    await flush();

    const frame = lastFrame() ?? "";
    expect(frame.split("\n").some((line) => /▼\s+\)/.test(line))).toBe(false);
    expect(frame).toContain("▼");
    expect(frame).toContain("(   ) Snapshot Model 4");
  });

  test("shows distinct descriptions for enabled and disabled items", async () => {
    const { lastFrame } = render(
      <CliThemeProvider initialTheme="dark">
        <RadioGroup isActive>
          <RadioGroup.Item value="a" label="Alpha" description="Enabled description" />
          <RadioGroup.Item value="b" label="Bravo" description="Disabled description" disabled />
        </RadioGroup>
      </CliThemeProvider>,
    );
    await flush();

    const frame = lastFrame() ?? "";
    expect(frame).toContain("Enabled description");
    expect(frame).toContain("Disabled description");
  });
});
