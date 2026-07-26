import { type Cleanup, createEffectScope } from "../effect-scope";
import { spinAt } from "../motion";
import { observeEach } from "../observe";
import { type Flags, getFlags } from "../viewport";

/** A viewport reader. `resized` marks the frames where cached boxes are stale. */
type HudReader = (resized: boolean) => void;

/** Type a label out character by character, or set it directly when reduced. */
function makeLabelSetter(label: HTMLElement, reduced: boolean): [(text: string) => void, Cleanup] {
  if (reduced) {
    return [
      (text) => {
        label.textContent = text;
      },
      () => {},
    ];
  }
  let timer: ReturnType<typeof setInterval> | undefined;
  return [
    (text) => {
      clearInterval(timer);
      let i = 0;
      timer = setInterval(() => {
        label.textContent = text.slice(0, ++i);
        if (i >= text.length) clearInterval(timer);
      }, 40);
    },
    () => {
      if (timer) clearInterval(timer);
    },
  ];
}

/**
 * Drive every HUD reader from one scroll/resize handler, batched into an
 * animation frame. Each reader measures layout, so separate listeners meant one
 * forced reflow per reader per scroll event; batching also lets the readers
 * share the `resized` flag that says when cached boxes need re-measuring.
 */
function trackViewport(readers: readonly HudReader[], signal: AbortSignal): void {
  let frame = 0;
  let resized = true;
  const flush = (): void => {
    frame = 0;
    const wasResized = resized;
    resized = false;
    for (const read of readers) read(wasResized);
  };
  const schedule = (fromResize: boolean): void => {
    if (fromResize) resized = true;
    if (frame === 0) frame = requestAnimationFrame(flush);
  };
  addEventListener("scroll", () => schedule(false), { passive: true, signal });
  addEventListener("resize", () => schedule(true), { signal });
  signal.addEventListener("abort", () => cancelAnimationFrame(frame), { once: true });
  flush();
}

/**
 * The scene that owns the HUD readout and the page theme: the last one whose
 * top has crossed the middle of the viewport. Resolved from geometry on every
 * scroll rather than from IntersectionObserver enter events — an observer only
 * announces a scene when its intersection flips, so a scene re-entered from
 * below (scrolling back up, or jumping via an anchor) is never announced again
 * and the readout and theme stay stuck on the scene below it.
 */
function createActiveSceneReader(
  scenes: readonly HTMLElement[],
  onChange: (scene: HTMLElement) => void,
): HudReader {
  let active: HTMLElement | undefined;
  return () => {
    const line = innerHeight / 2;
    let next = scenes[0];
    for (const scene of scenes) {
      if (scene.getBoundingClientRect().top <= line) next = scene;
    }
    if (!next || next === active) return;
    active = next;
    onChange(next);
  };
}

/** Bottom edge of the fixed top-corner HUD band (wordmark + docs/github links). */
function measureHudBandBottom(root: ParentNode): number {
  let bottom = 0;
  for (const corner of root.querySelectorAll<HTMLElement>(".hud-tl, .hud-tr")) {
    bottom = Math.max(bottom, corner.getBoundingClientRect().bottom);
  }
  return bottom;
}

/**
 * The hero heading is full-bleed and scrolls up through the fixed top corners
 * while the hero is still the scene that owns the viewport, so scene tracking
 * alone leaves a window where the wordmark prints through the heading. Publish
 * that collision separately so the narrow-width CSS can clear the corners for
 * exactly the scroll range where the two boxes overlap. The corners are fixed,
 * so their band is measured from the corners themselves once per resize rather
 * than pinned to a constant that the stylesheet can drift away from.
 */
function createHudBandReader(root: ParentNode, heading: HTMLElement): HudReader {
  let occupied: boolean | undefined;
  let bandBottom = 0;
  return (resized) => {
    if (resized) bandBottom = measureHudBandBottom(root);
    const { top, bottom } = heading.getBoundingClientRect();
    const next = top < bandBottom && bottom > 0;
    if (next === occupied) return;
    occupied = next;
    if (next) document.documentElement.dataset.hudBand = "occupied";
    else delete document.documentElement.dataset.hudBand;
  };
}

/** Scroll-progress telemetry in the bottom-left HUD readout. */
function createScrollProgressReader(pct: HTMLElement): HudReader {
  let lastPct = -1;
  return () => {
    const max = document.documentElement.scrollHeight - innerHeight;
    const value = max > 0 ? Math.round((scrollY / max) * 100) : 0;
    if (value === lastPct) return;
    lastPct = value;
    pct.textContent = `${String(value).padStart(3, "0")}%`;
  };
}

export function initHud(
  root: ParentNode = document,
  flags: Flags = getFlags(),
  signal?: AbortSignal,
): Cleanup {
  const scope = createEffectScope(signal);
  if (!scope.active()) return scope.cleanup;

  const spin = root.querySelector<HTMLElement>("#osd-spin");
  const label = root.querySelector<HTMLElement>("#osd-label");
  const pct = root.querySelector<HTMLElement>("#osd-pct");

  if (spin && !flags.reduced) {
    let step = 0;
    const timer = setInterval(() => {
      spin.textContent = spinAt(++step);
    }, 120);
    scope.addCleanup(() => clearInterval(timer));
  }

  const [setLabel, cleanupLabel] = label
    ? makeLabelSetter(label, flags.reduced)
    : [() => {}, () => {}];
  scope.addCleanup(cleanupLabel);

  // The stylesheet keys the corner HUD and the page theme off these attributes,
  // so a torn-down HUD has to take them with it — otherwise a re-init (a
  // motion-preference flip restarts every effect) starts against stale state.
  const html = document.documentElement;
  scope.addCleanup(() => {
    delete html.dataset.hudBand;
    delete html.dataset.osdScene;
    delete html.dataset.sceneTheme;
    delete html.dataset.theme;
  });

  const readers: HudReader[] = [];
  if (pct) readers.push(createScrollProgressReader(pct));
  const heroHeading = root.querySelector<HTMLElement>("#s1 h1");
  if (heroHeading) readers.push(createHudBandReader(root, heroHeading));
  readers.push(
    createActiveSceneReader([...root.querySelectorAll<HTMLElement>("[data-osd]")], (scene) => {
      setLabel(scene.dataset.osd ?? "");
      const light = scene.dataset.themeScene === "light";
      html.dataset.sceneTheme = light ? "light" : "dark";
      html.dataset.theme = light ? "light" : "dark";
      html.dataset.osdScene = scene.id;
    }),
  );
  trackViewport(readers, scope.signal);

  scope.addCleanup(
    observeEach(root.querySelectorAll(".scene"), (target) => target.classList.add("in"), {
      threshold: 0,
      rootMargin: "0px 0px -10% 0px",
      once: true,
    }),
  );

  return scope.cleanup;
}
