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

    cleanup();
  });

  it("moves roving focus and the single tab stop with arrow, Home, and End keys", () => {
    mountLanding();

    const cleanup = initFindings(document, { reduced: true, finePointer: false });
    const tabs = [...document.querySelectorAll<HTMLButtonElement>("[role='tab']")];

    expect(tabs[0]?.tabIndex).toBe(0);
    expect(tabs.slice(1).every((tab) => tab.tabIndex === -1)).toBe(true);

    tabs[0]?.focus();
    tabs[0]?.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowDown", bubbles: true }));

    expect(document.activeElement).toBe(tabs[1]);
    expect(tabs[1]?.tabIndex).toBe(0);
    expect(tabs[1]?.getAttribute("aria-selected")).toBe("true");
    expect(tabs[0]?.tabIndex).toBe(-1);

    tabs[1]?.dispatchEvent(new KeyboardEvent("keydown", { key: "End", bubbles: true }));

    expect(document.activeElement).toBe(tabs.at(-1));
    expect(tabs.at(-1)?.tabIndex).toBe(0);

    tabs.at(-1)?.dispatchEvent(new KeyboardEvent("keydown", { key: "Home", bubbles: true }));

    expect(document.activeElement).toBe(tabs[0]);
    expect(tabs[0]?.tabIndex).toBe(0);

    cleanup();
  });

  it("navigates with j/k while the findings widget owns focus", () => {
    mountLanding();

    const cleanup = initFindings(document, { reduced: true, finePointer: false });
    const selected = () =>
      document.querySelector<HTMLElement>(".finding-row[aria-selected='true']");
    const firstRow = document.querySelector<HTMLElement>(".finding-row");

    firstRow?.focus();
    const event = new KeyboardEvent("keydown", { key: "j", bubbles: true, cancelable: true });
    firstRow?.dispatchEvent(event);

    const rows = [...document.querySelectorAll<HTMLButtonElement>(".finding-row")];
    expect(event.defaultPrevented).toBe(true);
    expect(selected()?.textContent).toContain(demoFindings[1].title);
    expect(document.activeElement).toBe(rows[1]);
    expect(rows[1]?.tabIndex).toBe(0);
    expect(rows[0]?.tabIndex).toBe(-1);

    cleanup();
  });

  it("navigates with j/k from a non-interactive target while findings are visible", () => {
    mountLanding();

    const cleanup = initFindings(document, { reduced: true, finePointer: false });
    const selected = () =>
      document.querySelector<HTMLElement>(".finding-row[aria-selected='true']");

    document.body.dispatchEvent(new KeyboardEvent("keydown", { key: "j", bubbles: true }));

    expect(selected()?.textContent).toContain(demoFindings[1].title);

    cleanup();
  });

  it.each(["j", "k"] as const)("leaves modified %s shortcuts to the browser", (key) => {
    mountLanding();

    const cleanup = initFindings(document, { reduced: true, finePointer: false });
    const selected = () =>
      document.querySelector<HTMLElement>(".finding-row[aria-selected='true']");

    document.body.dispatchEvent(new KeyboardEvent("keydown", { key: "j", bubbles: true }));
    expect(selected()?.textContent).toContain(demoFindings[1].title);

    for (const modifier of [{ ctrlKey: true }, { metaKey: true }, { altKey: true }]) {
      const event = new KeyboardEvent("keydown", {
        key,
        bubbles: true,
        cancelable: true,
        ...modifier,
      });
      document.body.dispatchEvent(event);

      expect(event.defaultPrevented).toBe(false);
      expect(selected()?.textContent).toContain(demoFindings[1].title);
    }

    cleanup();
  });

  it("ignores a j/k shortcut already handled by another listener", () => {
    mountLanding();

    const cleanup = initFindings(document, { reduced: true, finePointer: false });
    const selected = () =>
      document.querySelector<HTMLElement>(".finding-row[aria-selected='true']");
    const event = new KeyboardEvent("keydown", {
      key: "j",
      bubbles: true,
      cancelable: true,
    });
    event.preventDefault();

    document.body.dispatchEvent(event);

    expect(selected()?.textContent).toContain(demoFindings[0].title);

    cleanup();
  });

  it("does not steal j/k from an interactive element outside the widget", () => {
    mountLanding();

    const cleanup = initFindings(document, { reduced: true, finePointer: false });
    const selected = () =>
      document.querySelector<HTMLElement>(".finding-row[aria-selected='true']");
    const docsLink = document.querySelector<HTMLElement>("a[data-link='docs']");

    docsLink?.focus();
    const event = new KeyboardEvent("keydown", { key: "j", bubbles: true, cancelable: true });
    docsLink?.dispatchEvent(event);

    expect(event.defaultPrevented).toBe(false);
    expect(selected()?.textContent).toContain(demoFindings[0].title);

    cleanup();
  });

  it("does not steal j/k from a focusable region outside the widget", () => {
    mountLanding();

    const cleanup = initFindings(document, { reduced: true, finePointer: false });
    const selected = () =>
      document.querySelector<HTMLElement>(".finding-row[aria-selected='true']");
    const diffRegion = document.querySelector<HTMLElement>("#gz-diff");

    diffRegion?.focus();
    const event = new KeyboardEvent("keydown", { key: "j", bubbles: true, cancelable: true });
    diffRegion?.dispatchEvent(event);

    expect(event.defaultPrevented).toBe(false);
    expect(selected()?.textContent).toContain(demoFindings[0].title);

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

  it("keeps the first clicked finding selected after the intro has started", async () => {
    vi.useFakeTimers();
    vi.stubGlobal("IntersectionObserver", undefined);
    mountLanding();

    const cleanup = initFindings(document, flags);
    const rows = [...document.querySelectorAll<HTMLButtonElement>(".finding-row")];
    const selected = () =>
      document.querySelector<HTMLElement>(".finding-row[aria-selected='true']");

    await vi.advanceTimersByTimeAsync(800);
    expect(selected()?.textContent).toContain(demoFindings[1].title);

    rows[3]?.click();
    await vi.advanceTimersByTimeAsync(3_000);

    expect(selected()?.textContent).toContain(demoFindings[3].title);
    expect(rows[3]?.getAttribute("aria-selected")).toBe("true");
    expect(rows[3]?.tabIndex).toBe(0);
    expect(rows.filter((row, index) => index !== 3 && row.tabIndex === 0)).toEqual([]);

    cleanup();
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

describe("landing accessibility markup", () => {
  afterEach(() => {
    document.body.innerHTML = "";
  });

  it("announces copy state through a polite live region without losing the action label", () => {
    mountLanding();

    const buttons = [...document.querySelectorAll<HTMLButtonElement>(".copy-btn")];

    expect(buttons).toHaveLength(2);
    for (const button of buttons) {
      expect(button.getAttribute("aria-label")).toBe("Copy install command");
      expect(button.querySelector(".copy-label")?.getAttribute("aria-live")).toBe("polite");
    }
  });

  it("exposes the install figlet as a single labeled image, not raw ascii", () => {
    mountLanding();

    const figlet = document.querySelector<HTMLElement>("#figlet");

    expect(figlet?.getAttribute("role")).toBe("img");
    expect(figlet?.getAttribute("aria-label")).toBe("Diffgazer");
  });
});
