import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { initHud } from "./hud";

interface IntersectionObserverProbe {
  callback: IntersectionObserverCallback;
  options: IntersectionObserverInit;
}

let probes: IntersectionObserverProbe[] = [];

function stubIntersectionObserver(): void {
  probes = [];

  class MockIntersectionObserver {
    constructor(callback: IntersectionObserverCallback, options: IntersectionObserverInit = {}) {
      probes.push({ callback, options });
    }

    observe() {}

    unobserve() {}

    disconnect() {}
  }

  vi.stubGlobal("IntersectionObserver", MockIntersectionObserver);
}

function intersectingEntry(target: Element): IntersectionObserverEntry {
  return {
    boundingClientRect: target.getBoundingClientRect(),
    intersectionRatio: 1,
    intersectionRect: new DOMRect(),
    isIntersecting: true,
    rootBounds: null,
    target,
    time: 0,
  };
}

/** The HUD readers are batched into an animation frame, so let one pass. */
const nextFrame = (): Promise<void> =>
  new Promise<void>((resolve) => {
    requestAnimationFrame(() => resolve());
  });

/** Mounted box heights, so a placed top yields a truthful bottom edge. */
const HEIGHTS: Record<string, number> = { "#s1 h1": 80 };
const SCENE_HEIGHT = 900;

/** Place elements relative to the viewport top, standing in for a scroll. */
function place(tops: Record<string, number>): void {
  for (const [selector, top] of Object.entries(tops)) {
    const element = document.querySelector<HTMLElement>(selector);
    if (!element) throw new Error(`${selector} not mounted`);
    const height = HEIGHTS[selector] ?? SCENE_HEIGHT;
    element.getBoundingClientRect = () => new DOMRect(0, top, 375, height);
  }
}

/** Place, scroll, and let the batched readers run. */
async function scrollTo(tops: Record<string, number>): Promise<void> {
  place(tops);
  dispatchEvent(new Event("scroll"));
  await nextFrame();
}

function mountScenes(): void {
  document.body.innerHTML = `
    <div class="hud hud-tl"></div>
    <div class="hud hud-tr"></div>
    <span id="osd-label"></span>
    <section class="scene" id="s1" data-osd="01 / GAZE"><h1>Local AI code review.</h1></section>
    <section class="scene" id="s4" data-osd="04 / FINDINGS" data-theme-scene="light"></section>
    <section class="scene" id="s6" data-osd="05 / INSTALL"></section>`;
  // The band the hero heading collides with is measured off the fixed corners,
  // so they need a real box: 22px from the top, 34px tall.
  for (const corner of document.querySelectorAll<HTMLElement>(".hud-tl, .hud-tr")) {
    corner.getBoundingClientRect = () => new DOMRect(0, 22, 120, 34);
  }
}

const readout = (): string | null | undefined => document.querySelector("#osd-label")?.textContent;

describe("initHud scene tracking", () => {
  beforeEach(() => {
    stubIntersectionObserver();
    mountScenes();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    document.body.innerHTML = "";
  });

  it("reads out the scene at mid-viewport and inverts the theme with it", async () => {
    place({ "#s4": -60, "#s6": 900 });

    const cleanup = initHud(document, { reduced: true, finePointer: true });

    expect(readout()).toBe("04 / FINDINGS");
    expect(document.documentElement.dataset.sceneTheme).toBe("light");
    expect(document.documentElement.dataset.theme).toBe("light");

    await scrollTo({ "#s4": -931, "#s6": 0 });

    expect(readout()).toBe("05 / INSTALL");
    expect(document.documentElement.dataset.sceneTheme).toBe("dark");
    expect(document.documentElement.dataset.theme).toBe("dark");

    cleanup();
  });

  it("publishes the scene at mid-viewport as data-osd-scene", async () => {
    place({ "#s1": 0, "#s4": 900, "#s6": 1800 });

    const cleanup = initHud(document, { reduced: true, finePointer: true });

    expect(document.documentElement.dataset.osdScene).toBe("s1");

    await scrollTo({ "#s1": -900, "#s4": -60, "#s6": 900 });
    expect(document.documentElement.dataset.osdScene).toBe("s4");

    await scrollTo({ "#s1": -1800, "#s4": -931, "#s6": 0 });
    expect(document.documentElement.dataset.osdScene).toBe("s6");

    cleanup();
  });

  it("flags the top HUD band while the hero heading scrolls through it", async () => {
    place({ "#s1": 0, "#s4": 900, "#s6": 1800 });

    const cleanup = initHud(document, { reduced: true, finePointer: true });

    await scrollTo({ "#s1 h1": 600 });
    expect(document.documentElement.dataset.osdScene).toBe("s1");
    expect(document.documentElement.dataset.hudBand).toBeUndefined();

    await scrollTo({ "#s1 h1": 20 });
    expect(document.documentElement.dataset.osdScene).toBe("s1");
    expect(document.documentElement.dataset.hudBand).toBe("occupied");

    await scrollTo({ "#s1 h1": -120 });
    expect(document.documentElement.dataset.hudBand).toBeUndefined();

    cleanup();
  });

  it("re-announces a scene that is scrolled back into view", async () => {
    place({ "#s4": -60, "#s6": 900 });

    const cleanup = initHud(document, { reduced: true, finePointer: true });
    await scrollTo({ "#s4": -931, "#s6": 0 });
    await scrollTo({ "#s4": -60, "#s6": 900 });

    expect(readout()).toBe("04 / FINDINGS");
    expect(document.documentElement.dataset.sceneTheme).toBe("light");

    cleanup();
  });

  it("hands back the document attributes it owns on cleanup, and stops tracking", async () => {
    place({ "#s4": -60, "#s6": 900 });
    initHud(document, { reduced: true, finePointer: true })();

    expect(document.documentElement.dataset.osdScene).toBeUndefined();
    expect(document.documentElement.dataset.sceneTheme).toBeUndefined();
    expect(document.documentElement.dataset.theme).toBeUndefined();
    expect(document.documentElement.dataset.hudBand).toBeUndefined();

    await scrollTo({ "#s4": -931, "#s6": 0 });

    expect(readout()).toBe("04 / FINDINGS");
    expect(document.documentElement.dataset.sceneTheme).toBeUndefined();
  });

  it("reveals a scene once it enters the viewport", () => {
    const scene = document.querySelector<HTMLElement>("#s4");
    if (!scene) throw new Error("findings scene not mounted");

    const cleanup = initHud(document, { reduced: true, finePointer: true });

    const revealObserver = probes.find(({ options }) => options.rootMargin === "0px 0px -10% 0px");
    expect(revealObserver?.options.threshold).toBe(0);
    revealObserver?.callback([intersectingEntry(scene)], new IntersectionObserver(() => {}));

    expect(scene.classList.contains("in")).toBe(true);

    cleanup();
  });
});
