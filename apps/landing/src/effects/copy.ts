import type { Cleanup } from "../util";

export function initCopyButtons(
  root: ParentNode = document,
  revertMs = 1400,
  signal?: AbortSignal,
): Cleanup {
  const timers = new Set<ReturnType<typeof setTimeout>>();
  let disposed = false;
  const isDisposed = (): boolean => disposed || signal?.aborted === true;
  const clearTimers = (): void => {
    for (const timer of timers) clearTimeout(timer);
    timers.clear();
  };
  signal?.addEventListener("abort", clearTimers, { once: true });

  for (const button of root.querySelectorAll<HTMLButtonElement>(".copy-btn")) {
    button.addEventListener(
      "click",
      async () => {
        const label = button.querySelector<HTMLElement>(".copy-label");
        if (!label || isDisposed()) return;
        try {
          await navigator.clipboard.writeText(button.dataset.copy ?? "");
          if (isDisposed()) return;
          label.textContent = "copied";
        } catch {
          if (isDisposed()) return;
          label.textContent = "failed";
        }
        if (isDisposed()) return;
        const timer = setTimeout(() => {
          timers.delete(timer);
          label.textContent = "copy";
        }, revertMs);
        timers.add(timer);
      },
      signal ? { signal } : undefined,
    );
  }
  return () => {
    disposed = true;
    signal?.removeEventListener("abort", clearTimers);
    clearTimers();
  };
}
