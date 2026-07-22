import { HISTORY_SEARCH_PLACEHOLDER } from "@diffgazer/core/review";
import { cleanup, render } from "ink-testing-library";
import { useState } from "react";
import { afterEach, describe, expect, test, vi } from "vitest";
import { CliThemeProvider } from "../../theme/provider";
import { Input } from "./input";

const BACKSPACE = "\u007f";
const DELETE = "\u001B[3~";

async function flush(times = 4): Promise<void> {
  for (let i = 0; i < times; i += 1) {
    await new Promise((resolve) => setImmediate(resolve));
  }
}

function ControlledInput() {
  const [value, setValue] = useState("model😀");
  return <Input value={value} onChange={setValue} isActive />;
}

function ControlledHistorySearch() {
  const [value, setValue] = useState("");
  return (
    <Input value={value} onChange={setValue} placeholder={HISTORY_SEARCH_PLACEHOLDER} isActive />
  );
}

function ControlledPasswordInput() {
  const [value, setValue] = useState("sk-😀");
  return <Input value={value} onChange={setValue} type="password" isActive />;
}

describe("Input", () => {
  afterEach(() => {
    cleanup();
  });

  test("Backspace removes the previous Unicode code point while Delete preserves the end value", async () => {
    const { lastFrame, stdin } = render(
      <CliThemeProvider initialTheme="dark">
        <ControlledInput />
      </CliThemeProvider>,
    );
    await flush();

    expect(lastFrame()).toContain("model😀");
    stdin.write(DELETE);
    await flush();

    expect(lastFrame()).toContain("model😀");

    stdin.write(BACKSPACE);
    await flush();

    expect(lastFrame()).toContain("model");
    expect(lastFrame()).not.toContain("😀");
    expect(lastFrame()).not.toContain("�");
  });

  test("a controlled history search replaces its placeholder with typed text", async () => {
    const { lastFrame, stdin } = render(
      <CliThemeProvider initialTheme="dark">
        <ControlledHistorySearch />
      </CliThemeProvider>,
    );
    await flush();

    expect(lastFrame()).toContain(HISTORY_SEARCH_PLACEHOLDER);
    stdin.write("security");
    await flush();

    expect(lastFrame()).toContain("security");
    expect(lastFrame()).not.toContain(HISTORY_SEARCH_PLACEHOLDER);
  });

  test("password input masks Unicode characters and never renders the secret", async () => {
    const { lastFrame, stdin } = render(
      <CliThemeProvider initialTheme="dark">
        <ControlledPasswordInput />
      </CliThemeProvider>,
    );
    await flush();

    expect(lastFrame()).toContain("****");
    expect(lastFrame()).not.toContain("sk-");
    expect(lastFrame()).not.toContain("😀");

    stdin.write("x");
    await flush();
    expect(lastFrame()).toContain("*****");
    expect(lastFrame()).not.toContain("x");
  });

  test("disabled input ignores edits while preserving its value", async () => {
    const onChange = vi.fn();
    const { lastFrame, stdin } = render(
      <CliThemeProvider initialTheme="dark">
        <Input value="OPENAI_API_KEY" onChange={onChange} disabled isActive />
      </CliThemeProvider>,
    );
    await flush();

    stdin.write("ATTACKER_VAR");
    await flush();
    expect(lastFrame()).toContain("OPENAI_API_KEY");
    expect(lastFrame()).not.toContain("ATTACKER_VAR");
    expect(onChange).not.toHaveBeenCalled();
  });

  test("keeps a long value on one row and preserves its terminal-cell-safe tail", () => {
    const { lastFrame } = render(
      <CliThemeProvider initialTheme="dark">
        <Input value="prefix-いいいいいいいい-visible-tail" size="sm" />
      </CliThemeProvider>,
    );

    const frame = lastFrame() ?? "";
    expect(frame.split("\n")).toHaveLength(3);
    expect(frame).toContain("visible-tail");
    expect(frame).not.toContain("prefix-");
  });
});
