import { type Cleanup, createEffectScope } from "../effect-scope";
import { spinAt } from "../motion";
import { observeEach } from "../observe";
import { type Flags, getFlags } from "../viewport";

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
 * The scene that owns the HUD readout and the page theme: the last one whose
 * top has crossed the middle of the viewport. Resolved from geometry on every
 * scroll rather than from IntersectionObserver enter events — an observer only
 * announces a scene when its intersection flips, so a scene re-entered from
 * below (scrolling back up, or jumping via an anchor) is never announced again
 * and the readout and theme stay stuck on the scene below it.
 */
function trackActiveScene(
  scenes: readonly HTMLElement[],
  onChange: (scene: HTMLElement) => void,
  signal: AbortSignal,
): void {
  let active: HTMLElement | undefined;
  const update = (): void => {
    const line = innerHeight / 2;
    let next = scenes[0];
    for (const scene of scenes) {
      if (scene.getBoundingClientRect().top <= line) next = scene;
    }
    if (!next || next === active) return;
    active = next;
    onChange(next);
  };
  addEventListener("scroll", update, { passive: true, signal });
  addEventListener("resize", update, { signal });
  update();
}

/** Scroll-progress telemetry in the bottom-left HUD readout. */
function trackScrollProgress(pct: HTMLElement, signal: AbortSignal): void {
  let lastPct = -1;
  const update = (): void => {
    const max = document.documentElement.scrollHeight - innerHeight;
    const value = max > 0 ? Math.round((scrollY / max) * 100) : 0;
    if (value === lastPct) return;
    lastPct = value;
    pct.textContent = `${String(value).padStart(3, "0")}%`;
  };
  addEventListener("scroll", update, { passive: true, signal });
  addEventListener("resize", update, { signal });
  update();
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
  if (pct) trackScrollProgress(pct, scope.signal);

  const [setLabel, cleanupLabel] = label
    ? makeLabelSetter(label, flags.reduced)
    : [() => {}, () => {}];
  scope.addCleanup(cleanupLabel);

  trackActiveScene(
    [...root.querySelectorAll<HTMLElement>("[data-osd]")],
    (scene) => {
      setLabel(scene.dataset.osd ?? "");
      const light = scene.dataset.themeScene === "light";
      const html = document.documentElement;
      html.dataset.sceneTheme = light ? "light" : "dark";
      html.dataset.theme = light ? "light" : "dark";
    },
    scope.signal,
  );

  scope.addCleanup(
    observeEach(root.querySelectorAll(".scene"), (target) => target.classList.add("in"), {
      threshold: 0,
      rootMargin: "0px 0px -10% 0px",
      once: true,
    }),
  );

  return scope.cleanup;
}
