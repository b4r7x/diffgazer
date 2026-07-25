import { afterEach, describe, expect, it, vi } from "vitest";
import { initHud } from "./hud";

interface IntersectionObserverProbe {
  callback: IntersectionObserverCallback;
  options: IntersectionObserverInit;
}

function captureIntersectionObservers(): IntersectionObserverProbe[] {
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

/** Place each scene relative to the viewport top, standing in for a scroll. */
function scrollTo(tops: Record<string, number>): void {
  for (const [selector, top] of Object.entries(tops)) {
    const scene = document.querySelector<HTMLElement>(selector);
    if (!scene) throw new Error(`scene ${selector} not mounted`);
    scene.getBoundingClientRect = () => new DOMRect(0, top, 375, 900);
  }
  dispatchEvent(new Event("scroll"));
}

function mountScenes(): void {
  document.body.innerHTML = `
    <span id="osd-label"></span>
    <section class="scene" id="s4" data-osd="04 / FINDINGS" data-theme-scene="light"></section>
    <section class="scene" id="s6" data-osd="05 / INSTALL"></section>`;
}

const readout = (): string | null | undefined => document.querySelector("#osd-label")?.textContent;

describe("initHud scene tracking", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    document.documentElement.className = "";
    delete document.documentElement.dataset.sceneTheme;
    delete document.documentElement.dataset.theme;
    document.body.innerHTML = "";
  });

  it("reads out the scene at mid-viewport and inverts the theme with it", () => {
    captureIntersectionObservers();
    mountScenes();
    scrollTo({ "#s4": -60, "#s6": 900 });

    const cleanup = initHud(document, { reduced: true, finePointer: true });

    expect(readout()).toBe("04 / FINDINGS");
    expect(document.documentElement.dataset.sceneTheme).toBe("light");
    expect(document.documentElement.dataset.theme).toBe("light");

    scrollTo({ "#s4": -931, "#s6": 0 });

    expect(readout()).toBe("05 / INSTALL");
    expect(document.documentElement.dataset.sceneTheme).toBe("dark");
    expect(document.documentElement.dataset.theme).toBe("dark");

    cleanup();
  });

  it("re-announces a scene that is scrolled back into view", () => {
    captureIntersectionObservers();
    mountScenes();
    scrollTo({ "#s4": -60, "#s6": 900 });

    const cleanup = initHud(document, { reduced: true, finePointer: true });
    scrollTo({ "#s4": -931, "#s6": 0 });
    scrollTo({ "#s4": -60, "#s6": 900 });

    expect(readout()).toBe("04 / FINDINGS");
    expect(document.documentElement.dataset.sceneTheme).toBe("light");

    cleanup();
  });

  it("stops tracking after cleanup", () => {
    captureIntersectionObservers();
    mountScenes();
    scrollTo({ "#s4": -60, "#s6": 900 });

    initHud(document, { reduced: true, finePointer: true })();
    scrollTo({ "#s4": -931, "#s6": 0 });

    expect(readout()).toBe("04 / FINDINGS");
    expect(document.documentElement.dataset.sceneTheme).toBe("light");
  });

  it("reveals a scene once it enters the viewport", () => {
    const probes = captureIntersectionObservers();
    mountScenes();
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
