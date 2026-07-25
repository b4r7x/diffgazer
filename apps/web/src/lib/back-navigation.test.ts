import type { AnyRouter } from "@tanstack/react-router";
import { describe, expect, it, vi } from "vitest";
import { performBackAction, resolveBackAction } from "./back-navigation";

describe("resolveBackAction", () => {
  it("uses deterministic route mapping in settings flow", () => {
    expect(resolveBackAction("/settings/theme", true)).toEqual({
      type: "navigate",
      to: "/settings",
    });
    expect(resolveBackAction("/settings", false)).toEqual({
      type: "navigate",
      to: "/",
    });
  });

  it("falls back to home when there is no browser history target", () => {
    expect(resolveBackAction("/history", false)).toEqual({
      type: "navigate",
      to: "/",
    });
  });

  it("keeps history-back behavior outside settings when history exists", () => {
    expect(resolveBackAction("/history", true)).toEqual({ type: "history" });
  });

  it("hides back action on home route", () => {
    expect(resolveBackAction("/", true)).toEqual({ type: "none" });
  });

  it("hides back action on onboarding so the wizard cannot loop back into itself", () => {
    expect(resolveBackAction("/onboarding", true)).toEqual({ type: "none" });
    expect(resolveBackAction("/onboarding", false)).toEqual({ type: "none" });
  });
});

describe("performBackAction", () => {
  function createRouter() {
    const navigate = vi.fn();
    const back = vi.fn();
    const router = { navigate, history: { back } } as unknown as AnyRouter;
    return { router, navigate, back };
  }

  it("navigates to the resolved target", () => {
    const { router, navigate, back } = createRouter();
    performBackAction(router, { type: "navigate", to: "/settings" });
    expect(navigate).toHaveBeenCalledWith({ to: "/settings" });
    expect(back).not.toHaveBeenCalled();
  });

  it("steps back through history", () => {
    const { router, navigate, back } = createRouter();
    performBackAction(router, { type: "history" });
    expect(back).toHaveBeenCalledTimes(1);
    expect(navigate).not.toHaveBeenCalled();
  });

  it("does nothing for the none action", () => {
    const { router, navigate, back } = createRouter();
    performBackAction(router, { type: "none" });
    expect(navigate).not.toHaveBeenCalled();
    expect(back).not.toHaveBeenCalled();
  });
});
