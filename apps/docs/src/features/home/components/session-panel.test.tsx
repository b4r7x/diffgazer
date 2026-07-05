// @vitest-environment jsdom

import { stubMatchMedia } from "@diffgazer/core/testing/match-media";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SessionPanel } from "./session-panel";

function mockReducedMotion(reduced: boolean) {
  stubMatchMedia((query) => reduced && query.includes("prefers-reduced-motion"));
}

async function runAnimation(ms = 4000) {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(ms);
  });
}

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe("SessionPanel", () => {
  it("shows the full review frame immediately when reduced motion is preferred", () => {
    mockReducedMotion(true);
    render(<SessionPanel />);

    expect(screen.getByText("diffgazer")).toBeInTheDocument();
    expect(
      screen.getByText("local review · your code never leaves the machine"),
    ).toBeInTheDocument();
    expect(screen.getByText("2 findings")).toBeInTheDocument();
    expect(screen.getByText("1 suggestion")).toBeInTheDocument();
    expect(screen.getByText("coverage gap · parser.ts")).toBeInTheDocument();
    expect(screen.getByText(/press j\/k to browse the registry/)).toBeInTheDocument();

    // The typing/spinner phases are skipped entirely under reduced motion.
    expect(screen.queryByText(/reviewing 3 changed files/)).not.toBeInTheDocument();
  });

  it("keeps the number of terminal lines constant across the whole animation", async () => {
    mockReducedMotion(false);
    const { container } = render(<SessionPanel />);

    const lineCount = () => container.querySelectorAll("[data-session-line]").length;
    const atMount = lineCount();
    expect(atMount).toBeGreaterThan(0);

    await runAnimation();

    expect(lineCount()).toBe(atMount);
  });

  it("does not render the command or verdicts before the animation runs", async () => {
    mockReducedMotion(false);
    render(<SessionPanel />);

    // Command line starts empty and only fills as it "types".
    expect(screen.queryByText("diffgazer")).not.toBeInTheDocument();

    await runAnimation();

    expect(screen.getByText("diffgazer")).toBeInTheDocument();
    expect(screen.getByText("coverage gap · parser.ts")).toBeInTheDocument();
  });

  it("restarts the animation from the top when replay is pressed", async () => {
    mockReducedMotion(false);
    render(<SessionPanel />);

    await runAnimation();
    expect(screen.getByText("diffgazer")).toBeInTheDocument();

    // fireEvent retained: fake timers drive the replay animation; userEvent click hangs waiting on timer advancement.
    fireEvent.click(screen.getByRole("button", { name: /replay/i }));

    // Replay resets the command back to an empty, un-typed line.
    expect(screen.queryByText("diffgazer")).not.toBeInTheDocument();

    await runAnimation();
    expect(screen.getByText("diffgazer")).toBeInTheDocument();
  });

  it("keeps replay showing the final frame under reduced motion", () => {
    mockReducedMotion(true);
    render(<SessionPanel />);

    // fireEvent retained: fake timers drive the replay animation; userEvent click hangs waiting on timer advancement.
    fireEvent.click(screen.getByRole("button", { name: /replay/i }));

    expect(screen.getByText("diffgazer")).toBeInTheDocument();
    expect(screen.queryByText(/reviewing 3 changed files/)).not.toBeInTheDocument();
  });
});
