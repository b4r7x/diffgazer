import type { MenuAction } from "@diffgazer/core/schemas/presentation";
import { describe, expect, test } from "vitest";
import type { Route } from "../../../lib/routes";
import { createHomeMenuAction, type HomeMenuActionOptions } from "./create-menu-action";

interface Harness {
  dispatch: (action: MenuAction) => void;
  routes: Route[];
  shutdownCalls: number;
  exits: number;
  resolveShutdown: () => void;
}

function buildHarness(overrides: Partial<HomeMenuActionOptions> = {}): Harness {
  const routes: Route[] = [];
  let shutdownCalls = 0;
  let exits = 0;
  let pendingSettled: (() => void) | null = null;

  const dispatch = createHomeMenuAction({
    navigate: (r) => routes.push(r),
    hasActiveSession: false,
    isTrusted: true,
    shutdown: {
      mutate: ((_input: unknown, options?: { onSettled?: (...args: unknown[]) => void }) => {
        shutdownCalls += 1;
        const settled = options?.onSettled;
        if (typeof settled === "function") {
          pendingSettled = () => settled();
        }
      }) as HomeMenuActionOptions["shutdown"]["mutate"],
    },
    onExit: () => {
      exits += 1;
    },
    ...overrides,
  });

  return {
    dispatch,
    routes,
    get shutdownCalls() {
      return shutdownCalls;
    },
    get exits() {
      return exits;
    },
    resolveShutdown: () => {
      const fn = pendingSettled;
      pendingSettled = null;
      fn?.();
    },
  } satisfies Harness;
}

describe("createHomeMenuAction", () => {
  test("review-unstaged navigates to review screen with unstaged mode", () => {
    const h = buildHarness();
    h.dispatch("review-unstaged");
    expect(h.routes).toEqual([{ screen: "review", mode: "unstaged" }]);
  });

  test("review-staged navigates to review screen with staged mode", () => {
    const h = buildHarness();
    h.dispatch("review-staged");
    expect(h.routes).toEqual([{ screen: "review", mode: "staged" }]);
  });

  test("review-start actions are gated when not trusted", () => {
    const h = buildHarness({ isTrusted: false });
    h.dispatch("review-unstaged");
    h.dispatch("review-staged");
    expect(h.routes).toEqual([]);
  });

  test("resume-review navigates only when an active session exists", () => {
    const noSession = buildHarness({ hasActiveSession: false });
    noSession.dispatch("resume-review");
    expect(noSession.routes).toEqual([]);

    const withSession = buildHarness({
      hasActiveSession: true,
      activeSession: { reviewId: "active-review", mode: "staged" },
    });
    withSession.dispatch("resume-review");
    expect(withSession.routes).toEqual([
      { screen: "review", reviewId: "active-review", mode: "staged", live: true },
    ]);
  });

  test("history/settings/help navigate to their screens", () => {
    const h = buildHarness();
    h.dispatch("history");
    h.dispatch("settings");
    h.dispatch("help");
    expect(h.routes).toEqual([{ screen: "history" }, { screen: "settings" }, { screen: "help" }]);
  });

  test("quit calls shutdown.mutate and exits on settled", () => {
    const h = buildHarness();
    h.dispatch("quit");
    expect(h.shutdownCalls).toBe(1);
    expect(h.exits).toBe(0);
    h.resolveShutdown();
    expect(h.exits).toBe(1);
  });
});
