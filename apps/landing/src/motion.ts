/** One code unit per frame, so the braille spinner indexes directly. */
const SPIN = "⣾⣽⣻⢿⡿⣟⣯⣷";

export const spinAt = (index: number): string => SPIN.charAt(index % SPIN.length);

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
