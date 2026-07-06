import { observeEach } from "../observe";
import { type Cleanup, createEffectScope, type Flags, getFlags, spinAt } from "../util";

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

/** Scroll-progress telemetry in the bottom-left HUD readout. */
function trackScrollProgress(pct: HTMLElement, signal?: AbortSignal): void {
  let lastPct = -1;
  const update = (): void => {
    const max = document.documentElement.scrollHeight - innerHeight;
    const value = max > 0 ? Math.round((scrollY / max) * 100) : 0;
    if (value === lastPct) return;
    lastPct = value;
    pct.textContent = `${String(value).padStart(3, "0")}%`;
  };
  addEventListener("scroll", update, signal ? { passive: true, signal } : { passive: true });
  addEventListener("resize", update, signal ? { signal } : undefined);
  update();
}

export function initHud(
  root: ParentNode = document,
  flags: Flags = getFlags(),
  signal?: AbortSignal,
): Cleanup {
  const scope = createEffectScope(signal);
  if (!scope.active()) return scope.cleanup;

  const cleanups: Cleanup[] = [];
  const spin = root.querySelector<HTMLElement>("#osd-spin");
  const label = root.querySelector<HTMLElement>("#osd-label");
  const pct = root.querySelector<HTMLElement>("#osd-pct");

  if (spin && !flags.reduced) {
    let step = 0;
    const timer = setInterval(() => {
      spin.textContent = spinAt(++step);
    }, 120);
    cleanups.push(() => clearInterval(timer));
  }
  if (pct) trackScrollProgress(pct, scope.signal);

  const [setLabel, cleanupLabel] = label
    ? makeLabelSetter(label, flags.reduced)
    : [() => {}, () => {}];
  cleanups.push(cleanupLabel);

  cleanups.push(
    observeEach(root.querySelectorAll("[data-osd]"), (target) => {
      const section = target as HTMLElement;
      setLabel(section.dataset.osd ?? "");
      const light = section.dataset.themeScene === "light";
      const html = document.documentElement;
      html.dataset.sceneTheme = light ? "light" : "dark";
      html.dataset.theme = light ? "light" : "dark";
    }),
  );

  cleanups.push(
    observeEach(root.querySelectorAll(".scene"), (target) => target.classList.add("in"), {
      threshold: 0.3,
      once: true,
    }),
  );

  scope.addCleanup(() => {
    for (const cleanup of cleanups.splice(0)) cleanup();
  });
  return scope.cleanup;
}
