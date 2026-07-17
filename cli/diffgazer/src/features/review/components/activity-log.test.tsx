import {
  createInitialReviewState,
  type ReviewEvent,
  type ReviewState,
  reviewReducer,
} from "@diffgazer/core/review";
import { cleanup, render } from "ink-testing-library";
import { afterEach, describe, expect, test } from "vitest";
import { CliThemeProvider } from "../../../theme/provider";
import { ActivityLog } from "./activity-log";

afterEach(() => {
  cleanup();
});

const ESC = String.fromCharCode(0x1b);
const BEL = String.fromCharCode(0x07);
// OSC-52 clipboard write sequence Ink would otherwise pass through to the terminal.
const OSC52 = `${ESC}]52;c;ZXZpbA==${BEL}`;
const ARROW_UP = "\u001b[A";
const END = "\u001b[F";

async function flush(times = 4): Promise<void> {
  for (let index = 0; index < times; index += 1) {
    await new Promise((resolve) => setImmediate(resolve));
  }
}

function appendThinkingEvents(state: ReviewState, prefix: string, count: number): ReviewState {
  let nextState = state;
  for (let index = 0; index < count; index += 1) {
    nextState = reviewReducer(nextState, {
      type: "EVENT",
      event: {
        type: "agent_thinking",
        agent: "detective",
        timestamp: "2024-01-01T00:00:00Z",
        thought: `${prefix}-${index}`,
      },
    });
  }
  return nextState;
}

describe("ActivityLog (TUI)", () => {
  test("strips OSC/ESC bytes from an escape-bearing entry message before render", () => {
    const events: ReviewEvent[] = [
      {
        type: "agent_thinking",
        agent: "detective",
        timestamp: "2024-01-01T00:00:00Z",
        thought: `safe${OSC52}message`,
      },
    ];

    const { lastFrame } = render(
      <CliThemeProvider initialTheme="dark">
        <ActivityLog events={events} />
      </CliThemeProvider>,
    );
    const frame = lastFrame() ?? "";

    expect(frame).toContain("safemessage");
    expect(frame).not.toContain(ESC);
    expect(frame).not.toContain("52;c;");
  });

  test("converts only the visible range of a 5,000-event log and keeps Up/End navigation", async () => {
    type ThinkingEvent = Extract<ReviewEvent, { type: "agent_thinking" }>;
    let propertyReads = 0;
    const events: ReviewEvent[] = Array.from({ length: 5_000 }, (_, index) => {
      const event: ThinkingEvent = {
        type: "agent_thinking",
        agent: "detective",
        timestamp: "2024-01-01T00:00:00Z",
        thought: `event-${index}`,
      };
      return new Proxy(event, {
        get(target, property, receiver) {
          propertyReads += 1;
          return Reflect.get(target, property, receiver);
        },
      });
    });

    const { stdin, lastFrame } = render(
      <CliThemeProvider initialTheme="dark">
        <ActivityLog events={events} height={3} isActive />
      </CliThemeProvider>,
    );
    await flush();

    expect(lastFrame() ?? "").toContain("event-4999");
    expect(propertyReads).toBeLessThan(300);

    stdin.write(ARROW_UP);
    await flush();
    expect(lastFrame() ?? "").toContain("event-4996");
    expect(lastFrame() ?? "").not.toContain("event-4999");

    stdin.write(END);
    await flush();
    expect(lastFrame() ?? "").toContain("event-4999");
    expect(propertyReads).toBeLessThan(600);
  });

  test("follows the new review tail after the event history resets through empty", async () => {
    const oldState = appendThinkingEvents(createInitialReviewState(), "old", 6);
    const emptyState = reviewReducer(oldState, { type: "RESET" });
    const nextState = appendThinkingEvents(emptyState, "next", 6);
    const { stdin, rerender, lastFrame } = render(
      <CliThemeProvider initialTheme="dark">
        <ActivityLog events={oldState.events} height={3} isActive />
      </CliThemeProvider>,
    );
    await flush();

    stdin.write(ARROW_UP);
    await flush();
    expect(lastFrame()).not.toContain("old-5");

    rerender(
      <CliThemeProvider initialTheme="dark">
        <ActivityLog events={emptyState.events} height={3} isActive />
      </CliThemeProvider>,
    );
    await flush();

    rerender(
      <CliThemeProvider initialTheme="dark">
        <ActivityLog events={nextState.events} height={3} isActive />
      </CliThemeProvider>,
    );
    await flush();

    const frame = lastFrame() ?? "";
    expect(frame).toContain("next-5");
    expect(frame).not.toContain("next-0");
  });
});
