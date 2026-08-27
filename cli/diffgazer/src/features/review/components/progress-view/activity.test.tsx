import type { ReviewEvent } from "@diffgazer/core/review";
import { cleanup, render } from "ink-testing-library";
import stripAnsi from "strip-ansi";
import { afterEach, describe, expect, test } from "vitest";
import { flush } from "../../../../testing/flush";
import { CliThemeProvider } from "../../../../theme/provider";
import { makeAgent } from "../../testing/progress-view";
import { ReviewProgressActivity } from "./activity";

afterEach(() => {
  cleanup();
});

const ARROW_UP = "\u001b[A";
const ARROW_DOWN = "\u001b[B";
const ARROW_RIGHT = "\u001b[C";
const HOME = "\u001b[H";
const END = "\u001b[F";

function makeEvents(count: number): ReviewEvent[] {
  return Array.from({ length: count }, (_, index) => ({
    type: "agent_thinking",
    agent: "detective",
    thought: `event-${index}`,
    timestamp: `2026-01-01T00:00:${String(index).padStart(2, "0")}.000Z`,
  }));
}

function renderActivity() {
  return render(
    <CliThemeProvider initialTheme="dark">
      <ReviewProgressActivity
        width="100%"
        height={8}
        events={makeEvents(10)}
        notices={[]}
        agents={[makeAgent("detective"), makeAgent("guardian")]}
        error={null}
      />
    </CliThemeProvider>,
  );
}

function filterLine(frame: string | undefined): string {
  return (
    stripAnsi(frame ?? "")
      .split("\n")
      .find((line) => line.includes("Filter")) ?? ""
  );
}

describe("ReviewProgressActivity zones (TUI)", () => {
  test("names the bound filter keys in the hint instead of the dead slash", async () => {
    const { lastFrame } = renderActivity();
    await flush();

    const hint = filterLine(lastFrame());
    expect(hint).toContain("Filter (f, [, ]):");
    expect(hint).not.toContain("/");
  });

  test("keeps arrows scrolling the log while it is above the top boundary", async () => {
    const { stdin, lastFrame } = renderActivity();
    await flush();
    expect(lastFrame() ?? "").toContain("event-9");

    stdin.write(ARROW_UP);
    await flush();
    expect(lastFrame() ?? "").not.toContain("event-9");

    stdin.write(END);
    await flush();
    expect(lastFrame() ?? "").toContain("event-9");
  });

  test("exits to the filter row at the top boundary and returns without moving the log", async () => {
    const { stdin, lastFrame } = renderActivity();
    await flush();

    stdin.write(HOME);
    await flush();
    expect(lastFrame() ?? "").toContain("event-0");
    expect(lastFrame() ?? "").not.toContain("event-9");

    stdin.write(ARROW_UP);
    await flush();

    stdin.write(ARROW_DOWN);
    await flush();
    expect(lastFrame() ?? "").toContain("event-0");

    stdin.write(ARROW_DOWN);
    await flush();
    expect(lastFrame() ?? "").not.toContain("event-0");
  });

  test("steps the filter with left/right while the filter row is focused", async () => {
    const { stdin, lastFrame } = renderActivity();
    await flush();

    stdin.write(HOME);
    await flush();
    stdin.write(ARROW_UP);
    await flush();
    expect(filterLine(lastFrame())).toContain("All agents");

    stdin.write(ARROW_RIGHT);
    await flush();
    expect(filterLine(lastFrame())).toContain("Detective");
  });
});
