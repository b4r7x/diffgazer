import type { Cleanup } from "../util";

export function initCopyButtons(
  root: ParentNode = document,
  revertMs = 1400,
  signal?: AbortSignal,
): Cleanup {
  const clearButtonTimers: Array<() => void> = [];
  let disposed = false;
  const isDisposed = (): boolean => disposed || signal?.aborted === true;
  const clearTimers = (): void => {
    for (const clearTimer of clearButtonTimers) clearTimer();
  };

  for (const button of root.querySelectorAll<HTMLButtonElement>(".copy-btn")) {
    let operation = 0;
    let revertTimer: ReturnType<typeof setTimeout> | undefined;
    const clearRevertTimer = (): void => {
      if (revertTimer === undefined) return;
      clearTimeout(revertTimer);
      revertTimer = undefined;
    };
    clearButtonTimers.push(clearRevertTimer);

    button.addEventListener(
      "click",
      async () => {
        const label = button.querySelector<HTMLElement>(".copy-label");
        if (!label || isDisposed()) return;
        const currentOperation = ++operation;
        clearRevertTimer();
        try {
          await navigator.clipboard.writeText(button.dataset.copy ?? "");
          if (isDisposed() || currentOperation !== operation) return;
          label.textContent = "copied";
        } catch {
          if (isDisposed() || currentOperation !== operation) return;
          label.textContent = "failed";
        }
        if (isDisposed() || currentOperation !== operation) return;
        const timer = setTimeout(() => {
          if (revertTimer !== timer || currentOperation !== operation || isDisposed()) return;
          revertTimer = undefined;
          label.textContent = "copy";
        }, revertMs);
        revertTimer = timer;
      },
      signal ? { signal } : undefined,
    );
  }
  signal?.addEventListener("abort", clearTimers, { once: true });

  return () => {
    disposed = true;
    signal?.removeEventListener("abort", clearTimers);
    clearTimers();
  };
}
