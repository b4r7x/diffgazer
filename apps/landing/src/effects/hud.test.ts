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

describe("initHud intersection reactions", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    document.documentElement.className = "";
    delete document.documentElement.dataset.sceneTheme;
    delete document.documentElement.dataset.theme;
    document.body.innerHTML = "";
  });

  it("updates reveal state, HUD label, and theme when a scene intersects", () => {
    const probes = captureIntersectionObservers();
    document.body.innerHTML = `
      <span id="osd-label"></span>
      <section class="scene" id="s4" data-osd="04 / FINDINGS" data-theme-scene="light"></section>`;
    const scene = document.querySelector<HTMLElement>("#s4");
    if (!scene) throw new Error("findings scene not mounted");

    const cleanup = initHud(document, { reduced: true, finePointer: true });

    const hudObserver = probes.find(({ options }) => options.rootMargin === "0px 0px -50% 0px");
    const revealObserver = probes.find(({ options }) => options.rootMargin === "0px 0px -10% 0px");
    expect(hudObserver?.options.threshold).toBe(0);
    expect(revealObserver?.options.threshold).toBe(0);

    const entry = intersectingEntry(scene);
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
