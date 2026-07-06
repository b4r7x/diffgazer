import { createEffectScope, type Flags, lerp, type Mouse } from "../util";

export interface Cursor {
  draw(): void;
  cleanup(): void;
}

const NOOP: Cursor = { draw: () => {}, cleanup: () => {} };

/**
 * Custom reticle cursor that lens-locks onto hoverable controls, plus magnetic
 * pull on primary controls. Both require a fine pointer and full motion; they
 * are inert otherwise (touch, reduced motion), leaving the native cursor.
 */
export function initCursor(
  root: ParentNode,
  flags: Flags,
  mouse: Mouse,
  signal?: AbortSignal,
): Cursor {
  if (!flags.finePointer || flags.reduced) return NOOP;
  const scope = createEffectScope(signal);
  if (!scope.active()) return { ...NOOP, cleanup: scope.cleanup };

  for (const el of root.querySelectorAll<HTMLElement>("[data-magnetic]")) {
    el.addEventListener(
      "pointermove",
      (event) => {
        const rect = el.getBoundingClientRect();
        const dx = event.clientX - (rect.left + rect.width / 2);
        const dy = event.clientY - (rect.top + rect.height / 2);
        el.style.transform = `translate(${dx * 0.22}px, ${dy * 0.22}px)`;
      },
      { signal: scope.signal },
    );
    el.addEventListener(
      "pointerleave",
      () => {
        el.style.transition = "transform 0.4s cubic-bezier(0.2, 1, 0.3, 1)";
        el.style.transform = "none";
        const timer = setTimeout(() => {
          el.style.transition = "";
        }, 400);
        scope.addCleanup(() => clearTimeout(timer));
      },
      { signal: scope.signal },
    );
  }

  const reticle = root.querySelector<HTMLElement>("#reticle");
  if (!reticle) return { ...NOOP, cleanup: scope.cleanup };

  document.documentElement.classList.add("reticle-on");
  reticle.classList.add("on");
  scope.addCleanup(() => {
    document.documentElement.classList.remove("reticle-on");
    reticle.classList.remove("on", "lock");
  });

  let lockEl: HTMLElement | null = null;
  for (const el of root.querySelectorAll<HTMLElement>("[data-hover]")) {
    el.addEventListener(
      "pointerenter",
      () => {
        // data-hover-proxy: lock onto a compact child (e.g. a severity badge)
        // instead of the whole wide row.
        const proxy = el.dataset.hoverProxy;
        lockEl = (proxy && el.querySelector<HTMLElement>(proxy)) || el;
        reticle.classList.add("lock");
      },
      { signal: scope.signal },
    );
    el.addEventListener(
      "pointerleave",
      () => {
        if (lockEl && (lockEl === el || el.contains(lockEl))) {
          lockEl = null;
          reticle.classList.remove("lock");
        }
      },
      { signal: scope.signal },
    );
  }

  const state = { x: mouse.x, y: mouse.y, w: 34, h: 34 };
  const draw = (): void => {
    if (!scope.active()) return;
    let tx = mouse.x;
    let ty = mouse.y;
    let tw = 34;
    let th = 34;
    let ease = 0.55;
    if (lockEl) {
      const rect = lockEl.getBoundingClientRect();
      tx = rect.left + rect.width / 2;
      ty = rect.top + rect.height / 2;
      tw = rect.width + 14;
      th = rect.height + 14;
      ease = 0.3;
    }
    state.x = lerp(state.x, tx, ease);
    state.y = lerp(state.y, ty, ease);
    state.w = lerp(state.w, tw, 0.3);
    state.h = lerp(state.h, th, 0.3);
    reticle.style.width = `${state.w}px`;
    reticle.style.height = `${state.h}px`;
    reticle.style.transform = `translate(${state.x - state.w / 2}px, ${state.y - state.h / 2}px)`;
  };

  return {
    draw,
    cleanup: scope.cleanup,
  };
}
