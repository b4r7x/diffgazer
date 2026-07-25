import { type Cleanup, createEffectScope } from "../effect-scope";

export function initCopyButtons(
  root: ParentNode = document,
  revertMs = 1400,
  signal?: AbortSignal,
): Cleanup {
  const scope = createEffectScope(signal);

  for (const button of root.querySelectorAll<HTMLButtonElement>(".copy-btn")) {
    let operation = 0;
    let revertTimer: ReturnType<typeof setTimeout> | undefined;
    scope.addCleanup(() => {
      if (revertTimer === undefined) return;
      clearTimeout(revertTimer);
      revertTimer = undefined;
    });

    button.addEventListener(
      "click",
      async () => {
        const label = button.querySelector<HTMLElement>(".copy-label");
        if (!label || !scope.active()) return;
        const currentOperation = ++operation;
        clearTimeout(revertTimer);
        revertTimer = undefined;
        try {
          await navigator.clipboard.writeText(button.dataset.copy ?? "");
          if (!scope.active() || currentOperation !== operation) return;
          label.textContent = "copied";
        } catch {
          if (!scope.active() || currentOperation !== operation) return;
          label.textContent = "failed";
        }
        if (!scope.active() || currentOperation !== operation) return;
        const timer = setTimeout(() => {
          if (revertTimer !== timer || currentOperation !== operation || !scope.active()) return;
          revertTimer = undefined;
          label.textContent = "copy";
        }, revertMs);
        revertTimer = timer;
      },
      { signal: scope.signal },
    );
  }

  return scope.cleanup;
}
