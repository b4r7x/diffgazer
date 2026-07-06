export const SPIN = ["⣾", "⣽", "⣻", "⢿", "⡿", "⣟", "⣯", "⣷"];

export type Cleanup = () => void;

export interface EffectScope {
  signal: AbortSignal;
  active(): boolean;
  addCleanup(cleanup: Cleanup | undefined): void;
  cleanup(): void;
}

export function createEffectScope(externalSignal?: AbortSignal): EffectScope {
  const controller = new AbortController();
  const cleanups: Cleanup[] = [];
  let disposed = false;

  const cleanup = (): void => {
    if (disposed) return;
    disposed = true;
    externalSignal?.removeEventListener("abort", cleanup);
    controller.abort();
    for (const dispose of cleanups.splice(0)) dispose();
  };

  if (externalSignal?.aborted) cleanup();
  else externalSignal?.addEventListener("abort", cleanup, { once: true });

  return {
    signal: controller.signal,
    active: () => !disposed,
    addCleanup: (dispose) => {
      if (!dispose) return;
      if (disposed) dispose();
      else cleanups.push(dispose);
    },
    cleanup,
  };
}

export const sleep = (ms: number, signal?: AbortSignal): Promise<boolean> => {
  if (signal?.aborted) return Promise.resolve(false);
  return new Promise((resolve) => {
    let done = false;
    let timer: ReturnType<typeof setTimeout>;
    const finish = (completed: boolean): void => {
      if (done) return;
      done = true;
      clearTimeout(timer);
      signal?.removeEventListener("abort", abort);
      resolve(completed);
    };
    const abort = (): void => finish(false);
    timer = setTimeout(() => finish(true), ms);
    signal?.addEventListener("abort", abort, { once: true });
  });
};

export const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;

export const clamp = (value: number, min: number, max: number): number =>
  Math.max(min, Math.min(max, value));

export const spinAt = (index: number): string => {
  const length = SPIN.length;
  return SPIN[((index % length) + length) % length] ?? SPIN[0] ?? "";
};

export interface Flags {
  reduced: boolean;
  finePointer: boolean;
}

export function getFlags(): Flags {
  if (typeof matchMedia !== "function") return { reduced: true, finePointer: false };
  return {
    reduced: matchMedia("(prefers-reduced-motion: reduce)").matches,
    finePointer: matchMedia("(pointer: fine)").matches,
  };
}

export interface Mouse {
  x: number;
  y: number;
  nx: number;
  ny: number;
  lastMove: number;
}

export const createMouse = (): Mouse => ({
  x: innerWidth / 2,
  y: innerHeight / 2,
  nx: 0,
  ny: 0,
  lastMove: 0,
});

export const isLight = (doc: Document = document): boolean =>
  doc.documentElement.dataset.sceneTheme === "light";

export async function typeText(
  el: Element,
  text: string,
  cps = 30,
  signal?: AbortSignal,
): Promise<boolean> {
  for (let i = 1; i <= text.length; i++) {
    if (signal?.aborted) return false;
    el.textContent = text.slice(0, i);
    if (!(await sleep(1000 / cps, signal))) return false;
  }
  return true;
}
