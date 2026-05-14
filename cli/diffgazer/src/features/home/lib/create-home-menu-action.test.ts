import assert from "node:assert/strict";
import test, { describe } from "node:test";
import { createHomeMenuAction, type HomeMenuActionOptions } from "./create-home-menu-action.js";
import type { Route } from "../../../app/routes.js";

interface Harness {
  dispatch: (action: string) => void;
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
  } as Harness;
}

describe("createHomeMenuAction", () => {
  test("review-unstaged navigates to review screen with unstaged mode", () => {
    const h = buildHarness();
    h.dispatch("review-unstaged");
    assert.deepEqual(h.routes, [{ screen: "review", mode: "unstaged" }]);
  });

  test("review-staged navigates to review screen with staged mode", () => {
    const h = buildHarness();
    h.dispatch("review-staged");
    assert.deepEqual(h.routes, [{ screen: "review", mode: "staged" }]);
  });

  test("review-files is a no-op (placeholder until feature lands)", () => {
    const h = buildHarness();
    h.dispatch("review-files");
    assert.deepEqual(h.routes, []);
  });

  test("review-start actions are gated when not trusted", () => {
    const h = buildHarness({ isTrusted: false });
    h.dispatch("review-unstaged");
    h.dispatch("review-staged");
    h.dispatch("review-files");
    assert.deepEqual(h.routes, []);
  });

  test("resume-review navigates only when an active session exists", () => {
    const noSession = buildHarness({ hasActiveSession: false });
    noSession.dispatch("resume-review");
    assert.deepEqual(noSession.routes, []);

    const withSession = buildHarness({ hasActiveSession: true });
    withSession.dispatch("resume-review");
    assert.deepEqual(withSession.routes, [{ screen: "review" }]);
  });

  test("history/settings/help navigate to their screens", () => {
    const h = buildHarness();
    h.dispatch("history");
    h.dispatch("settings");
    h.dispatch("help");
    assert.deepEqual(h.routes, [
      { screen: "history" },
      { screen: "settings" },
      { screen: "help" },
    ]);
  });

  test("quit calls shutdown.mutate and exits on settled", () => {
    const h = buildHarness();
    h.dispatch("quit");
    assert.equal(h.shutdownCalls, 1);
    assert.equal(h.exits, 0);
    h.resolveShutdown();
    assert.equal(h.exits, 1);
  });

  test("non-review actions are not gated by trust", () => {
    const h = buildHarness({ isTrusted: false, hasActiveSession: true });
    h.dispatch("history");
    h.dispatch("settings");
    h.dispatch("help");
    h.dispatch("resume-review");
    assert.deepEqual(h.routes, [
      { screen: "history" },
      { screen: "settings" },
      { screen: "help" },
      { screen: "review" },
    ]);
  });

  test("unknown menu actions are no-ops (do not navigate or shutdown)", () => {
    const h = buildHarness();
    h.dispatch("does-not-exist");
    assert.deepEqual(h.routes, []);
    assert.equal(h.shutdownCalls, 0);
    assert.equal(h.exits, 0);
  });
});
