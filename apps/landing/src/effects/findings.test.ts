import { afterEach, describe, expect, it, vi } from "vitest";
import { demoFindings, formatFindingSummary } from "../demo";
import { mountLanding } from "../testing/markup";
import { initFindings } from "./findings";

const flags = { reduced: false, finePointer: false };

function mockIntersectionObserver() {
  const observe = vi.fn(() => {});
  const disconnect = vi.fn();
  class MockIntersectionObserver {
    observe = observe;
    disconnect = disconnect;
    unobserve = vi.fn();
  }
  vi.stubGlobal("IntersectionObserver", MockIntersectionObserver);
  return { observe, disconnect };
}

describe("initFindings", () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
    document.body.innerHTML = "";
  });

  it("renders vertical tabs and summary from the shared demo data", () => {
    mountLanding();

    const cleanup = initFindings(document, { reduced: true, finePointer: false });
    const tabs = [...document.querySelectorAll<HTMLElement>("[role='tab']")];

    expect(document.querySelector("#findings-list")?.getAttribute("aria-orientation")).toBe(
      "vertical",
    );
    expect(tabs).toHaveLength(demoFindings.length);
    expect(document.querySelector("#findings-summary")?.textContent).toBe(
      formatFindingSummary(demoFindings),
    );

    tabs[0]?.dispatchEvent(new KeyboardEvent("keydown", { key: "End", bubbles: true }));

    expect(document.querySelector(".finding-row[aria-selected='true']")?.textContent).toContain(
      demoFindings.at(-1)?.title,
    );

    cleanup();
  });

  it("does not advance the intro sequence after abort and cleanup", async () => {
    vi.useFakeTimers();
    vi.stubGlobal("IntersectionObserver", undefined);
    mountLanding();

    const controller = new AbortController();
    const cleanup = initFindings(document, flags, controller.signal);
    const selected = () =>
      document.querySelector<HTMLElement>(".finding-row[aria-selected='true']");

    expect(selected()?.textContent).toContain(demoFindings[0].title);

    controller.abort();
    cleanup();
    await vi.advanceTimersByTimeAsync(3000);

    expect(selected()?.textContent).toContain(demoFindings[0].title);
  });

  it("removes keyboard listeners when reduced-motion cleanup runs", () => {
    mountLanding();

    const cleanup = initFindings(document, { reduced: true, finePointer: false });
    const selected = () =>
      document.querySelector<HTMLElement>(".finding-row[aria-selected='true']");

    cleanup();
    document.dispatchEvent(new KeyboardEvent("keydown", { key: "j" }));

    expect(selected()?.textContent).toContain(demoFindings[0].title);
  });

  it("does not render or observe findings for an already-aborted signal", () => {
    const { observe } = mockIntersectionObserver();
    mountLanding();
    const abort = new AbortController();
    abort.abort();

    const cleanup = initFindings(document, flags, abort.signal);

    expect(document.querySelectorAll("[role='tab']")).toHaveLength(0);
    expect(observe).not.toHaveBeenCalled();

    cleanup();
  });

  it("disconnects the observer when the external signal aborts", () => {
    const { disconnect } = mockIntersectionObserver();
    mountLanding();
    const abort = new AbortController();

    initFindings(document, flags, abort.signal);
    abort.abort();

    expect(disconnect).toHaveBeenCalledTimes(1);
  });
});
