// @vitest-environment jsdom

import { stubControllableMatchMedia, stubMatchMedia } from "@diffgazer/core/testing/match-media";
import { KeyboardProvider } from "@diffgazer/keys";
import { act, fireEvent, render, screen } from "@testing-library/react";
import type { ComponentProps } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { HomeLibrary } from "../data";
import { ModulesIndexTable } from "./modules-index-table";
import { SessionPanel } from "./session-panel";

const routeCalls = vi.hoisted(() => vi.fn());

vi.mock("@tanstack/react-router", () => ({
  Link: ({ children, params, onClick, to: _to, ...props }: MockLinkProps) => (
    <a
      {...props}
      href={`/${params.lib}/${params._splat}`}
      onClick={(event) => {
        onClick?.(event);
        if (!event.defaultPrevented) routeCalls(params);
      }}
    >
      {children}
    </a>
  ),
  useNavigate: () => routeCalls,
}));

interface MockLinkProps extends Omit<ComponentProps<"a">, "href"> {
  to: string;
  params: { lib: string; _splat: string };
}

const TEST_LIBRARIES: HomeLibrary[] = [
  {
    id: "app",
    displayName: "Diffgazer App",
    sections: [{ name: "Getting Started", splat: "getting-started", count: 1 }],
  },
  {
    id: "ui",
    displayName: "Diffgazer UI",
    sections: [{ name: "Components", splat: "components", count: 4 }],
  },
];

function mockReducedMotion(reduced: boolean) {
  stubMatchMedia((query) => reduced && query.includes("prefers-reduced-motion"));
}

async function runAnimation(ms = 4000) {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(ms);
  });
}

function activateWithNativeEnter(element: HTMLElement) {
  // fireEvent retained: keydown exposes provider cancellation and click emulates native activation under fake timers.
  const keyAllowed = fireEvent.keyDown(element, { key: "Enter" });
  if (keyAllowed) fireEvent.click(element);
}

beforeEach(() => {
  vi.useFakeTimers();
  routeCalls.mockReset();
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

  it("settles a running animation when reduced motion turns on and waits for replay after it turns off", async () => {
    const reducedMotion = stubControllableMatchMedia(false);
    render(<SessionPanel />);

    await runAnimation(900);
    expect(screen.getByText(/reviewing 3 changed files/)).toBeInTheDocument();

    act(() => reducedMotion.setMatches(true));

    expect(screen.getByText("diffgazer")).toBeInTheDocument();
    expect(screen.getByText("coverage gap · parser.ts")).toBeInTheDocument();
    expect(screen.queryByText(/reviewing 3 changed files/)).not.toBeInTheDocument();

    act(() => reducedMotion.setMatches(false));
    await runAnimation();
    expect(screen.getByText("diffgazer")).toBeInTheDocument();

    // fireEvent retained: fake timers drive the replay animation; userEvent click hangs waiting on timer advancement.
    fireEvent.click(screen.getByRole("button", { name: /replay/i }));
    expect(screen.queryByText("diffgazer")).not.toBeInTheDocument();

    await runAnimation();
    expect(screen.getByText("diffgazer")).toBeInTheDocument();
  });

  it("keeps package activation on the focused link instead of intercepting Enter elsewhere", async () => {
    mockReducedMotion(false);
    const onSidebarToggle = vi.fn();
    render(
      <KeyboardProvider>
        <ModulesIndexTable libraries={TEST_LIBRARIES} />
        <SessionPanel />
        <input aria-label="Search docs" />
        <button type="button" onClick={onSidebarToggle}>
          Toggle sidebar
        </button>
      </KeyboardProvider>,
    );

    await runAnimation();
    const packageLink = screen.getByRole("link", { name: /diffgazer app/i });
    packageLink.focus();

    const replay = screen.getByRole("button", { name: /replay/i });
    replay.focus();
    activateWithNativeEnter(replay);
    expect(routeCalls).not.toHaveBeenCalled();
    expect(screen.queryByText("diffgazer")).not.toBeInTheDocument();

    const search = screen.getByRole("textbox", { name: "Search docs" });
    search.focus();
    // fireEvent retained: this directly checks whether the provider cancels the input's keydown.
    fireEvent.keyDown(search, { key: "Enter" });
    expect(routeCalls).not.toHaveBeenCalled();

    const sidebarToggle = screen.getByRole("button", { name: "Toggle sidebar" });
    sidebarToggle.focus();
    activateWithNativeEnter(sidebarToggle);
    expect(onSidebarToggle).toHaveBeenCalledOnce();
    expect(routeCalls).not.toHaveBeenCalled();

    packageLink.focus();
    activateWithNativeEnter(packageLink);
    expect(routeCalls).toHaveBeenCalledOnce();
  });
});
