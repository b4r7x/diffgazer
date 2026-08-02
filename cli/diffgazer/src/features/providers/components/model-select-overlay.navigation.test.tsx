import "./model-select-overlay.terminal-mock";
import { cleanup, render } from "ink-testing-library";
import { afterEach, describe, expect, test, vi } from "vitest";
import { ModelSelectOverlay } from "./model-select-overlay";
import {
  flush,
  flushUntil,
  GEMINI_CONFIGURATION,
  geminiName,
  Wrapper,
} from "./model-select-overlay.test-support";

describe("ModelSelectOverlay search input mode", () => {
  afterEach(() => {
    cleanup();
  });

  test("typing q in model search does not trigger the global quit shortcut", async () => {
    const onOpenChange = vi.fn();
    const { stdin, lastFrame } = render(
      <Wrapper>
        <ModelSelectOverlay open onOpenChange={onOpenChange} configuration={GEMINI_CONFIGURATION} />
      </Wrapper>,
    );

    await flushUntil(() => lastFrame()?.includes(geminiName("gemini-2.5-flash")) ?? false);
    stdin.write("/");
    await flush();
    stdin.write("q");
    await flush();

    expect(lastFrame()).toContain("q");
    expect(lastFrame()).not.toContain("Search models...");
    expect(onOpenChange).not.toHaveBeenCalledWith(false);
  });

  test("Escape clears a populated search before closing the dialog", async () => {
    const onOpenChange = vi.fn();
    const { stdin, lastFrame } = render(
      <Wrapper>
        <ModelSelectOverlay open onOpenChange={onOpenChange} configuration={GEMINI_CONFIGURATION} />
      </Wrapper>,
    );

    await flushUntil(() => lastFrame()?.includes(geminiName("gemini-2.5-flash")) ?? false);
    stdin.write("/");
    await flush();
    stdin.write("pro");
    await flush();
    expect(lastFrame()).toContain("pro");

    stdin.write("\u001B");
    await flushUntil(() => lastFrame()?.includes("Search models...") ?? false);

    expect(lastFrame()).toContain("Select Model");
    expect(lastFrame()).toContain("Search models...");
    expect(onOpenChange).not.toHaveBeenCalled();

    stdin.write("\u001B");
    await flushUntil(() => onOpenChange.mock.calls.length > 0);
    expect(onOpenChange).toHaveBeenCalledOnce();
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  test("one Escape closes from the filter zone", async () => {
    const onOpenChange = vi.fn();
    const { stdin, lastFrame } = render(
      <Wrapper>
        <ModelSelectOverlay open onOpenChange={onOpenChange} configuration={GEMINI_CONFIGURATION} />
      </Wrapper>,
    );

    await flushUntil(() => lastFrame()?.includes(geminiName("gemini-2.5-flash")) ?? false);
    stdin.write("\t");
    await flush();
    stdin.write("\t");
    await flush();
    expect(lastFrame()).toContain("<-/->");
    stdin.write("\u001B");
    await flushUntil(() => onOpenChange.mock.calls.length > 0);

    expect(onOpenChange).toHaveBeenCalledOnce();
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });
});
