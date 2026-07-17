import { afterEach, describe, expect, it, vi } from "vitest";
import { initCursor } from "./cursor";
import { initHero } from "./hero";
import { initHud } from "./hud";

const animatedFlags = { reduced: false, finePointer: true };

interface IntersectionObserverProbe {
  callback: IntersectionObserverCallback;
  options: IntersectionObserverInit;
}

function mockIntersectionObservers(): IntersectionObserverProbe[] {
  const probes: IntersectionObserverProbe[] = [];

  class MockIntersectionObserver {
    constructor(callback: IntersectionObserverCallback, options: IntersectionObserverInit = {}) {
      probes.push({ callback, options });
    }

    observe() {}

    unobserve() {}

    disconnect() {}
  }

  vi.stubGlobal("IntersectionObserver", MockIntersectionObserver);
  return probes;
}

function mountHero(): void {
  document.body.innerHTML = `
    <section id="s1">
      <h1 id="h1">Local AI code review.</h1>
      <p id="swap"><s>cloud.</s><ins></ins></p>
    </section>`;
}

describe("effect lifecycle signals", () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    document.documentElement.className = "";
    document.body.innerHTML = "";
  });

  it("does not start the hero intro after an external abort", async () => {
    vi.useFakeTimers();
    mountHero();
    const abort = new AbortController();

    const cleanup = initHero(document, animatedFlags, abort.signal);
    abort.abort();
    await vi.advanceTimersByTimeAsync(2_000);

    expect(document.querySelector("#s1")?.classList.contains("in")).toBe(false);
    expect(document.querySelector("#swap ins")?.textContent).toBe("");

    cleanup();
  });

  it("does not mutate the hero for an already-aborted signal", async () => {
    vi.useFakeTimers();
    mountHero();
    const abort = new AbortController();
    abort.abort();

    const cleanup = initHero(document, animatedFlags, abort.signal);
    await vi.advanceTimersByTimeAsync(2_000);

    expect(document.querySelector("#h1")?.textContent).toBe("Local AI code review.");
    expect(document.querySelector("#s1")?.classList.contains("in")).toBe(false);

    cleanup();
  });

  it("does not enable the custom cursor for an already-aborted signal", () => {
    document.body.innerHTML = `
      <div id="reticle"></div>
      <button data-hover data-magnetic>Copy install command</button>`;
    const abort = new AbortController();
    abort.abort();

    const cursor = initCursor(
      document,
      animatedFlags,
      { x: 0, y: 0, nx: 0, ny: 0, lastMove: 0 },
      abort.signal,
    );

    expect(document.documentElement.classList.contains("reticle-on")).toBe(false);
    expect(document.querySelector("#reticle")?.classList.contains("on")).toBe(false);

    cursor.cleanup();
  });

  it("does not start HUD timers for an already-aborted signal", () => {
    vi.useFakeTimers();
    document.body.innerHTML = `<span id="osd-spin"></span>`;
    const setIntervalSpy = vi.spyOn(globalThis, "setInterval");
    const abort = new AbortController();
    abort.abort();

    const cleanup = initHud(document, animatedFlags, abort.signal);

    expect(setIntervalSpy).not.toHaveBeenCalled();

    cleanup();
  });

  it("stops HUD timers when the external signal aborts", async () => {
    vi.useFakeTimers();
    document.body.innerHTML = `<span id="osd-spin"></span>`;
    const abort = new AbortController();

    const cleanup = initHud(document, animatedFlags, abort.signal);
    abort.abort();
    await vi.advanceTimersByTimeAsync(500);

    expect(document.querySelector("#osd-spin")?.textContent).toBe("");

    cleanup();
  });

  it("activates the findings scene in the short-landscape viewport bands", () => {
    vi.stubGlobal("innerWidth", 720);
    vi.stubGlobal("innerHeight", 400);
    const observers = mockIntersectionObservers();
    document.body.innerHTML = `
      <span id="osd-label"></span>
      <section class="scene" id="s4" data-osd="04 / FINDINGS" data-theme-scene="light"></section>`;
    const scene = document.querySelector<HTMLElement>("#s4");
    if (!scene) throw new Error("findings scene not mounted");
    vi.spyOn(scene, "getBoundingClientRect").mockReturnValue({
      x: 0,
      y: 199,
      width: 720,
      height: 1_000,
      top: 199,
      right: 720,
      bottom: 1_199,
      left: 0,
      toJSON() {},
    });

    const cleanup = initHud(document, { reduced: true, finePointer: true });

    const hudObserver = observers.find(({ options }) => options.rootMargin === "0px 0px -50% 0px");
    const revealObserver = observers.find(
      ({ options }) => options.rootMargin === "0px 0px -10% 0px",
    );
    expect(hudObserver?.options.threshold).toBe(0);
    expect(revealObserver?.options.threshold).toBe(0);

    const sceneRect = scene.getBoundingClientRect();
    const entry: IntersectionObserverEntry = {
      boundingClientRect: sceneRect,
      intersectionRatio: 0.01,
      intersectionRect: new DOMRect(0, 199, 720, 1),
      isIntersecting: true,
      rootBounds: new DOMRect(0, 0, 720, 400),
      target: scene,
      time: 0,
    };
    const observer = new IntersectionObserver(() => {});
    hudObserver?.callback([entry], observer);
    revealObserver?.callback([entry], observer);

    expect(scene.classList.contains("in")).toBe(true);
    expect(document.querySelector("#osd-label")?.textContent).toBe("04 / FINDINGS");
    expect(document.documentElement.dataset.sceneTheme).toBe("light");
    expect(document.documentElement.dataset.theme).toBe("light");

    cleanup();
  });
});
