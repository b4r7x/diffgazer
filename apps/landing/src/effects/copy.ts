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

/**
 * Package-manager switch above an install command. The pressed button's
 * `data-cmd` is the single source for both the rendered command and the copy
 * button's payload, so the shown and copied strings cannot disagree.
 */
export function initPackageManagerSwitch(
  root: ParentNode = document,
  signal?: AbortSignal,
): Cleanup {
  const scope = createEffectScope(signal);

  for (const group of root.querySelectorAll<HTMLElement>(".pm-switch")) {
    group.addEventListener(
      "click",
      (event) => {
        if (!scope.active()) return;
        const target = event.target;
        if (!(target instanceof Element)) return;
        const button = target.closest<HTMLButtonElement>(".pm-btn");
        if (!button || !group.contains(button)) return;

        for (const sibling of group.querySelectorAll<HTMLButtonElement>(".pm-btn")) {
          sibling.setAttribute("aria-pressed", String(sibling === button));
        }

        const command = button.dataset.cmd ?? "";
        const scene = group.closest("section") ?? group.parentElement;
        const text = scene?.querySelector<HTMLElement>(".install-cmd-text");
        if (text) text.textContent = command;
        const copyButton = scene?.querySelector<HTMLElement>(".copy-btn");
        if (copyButton) copyButton.dataset.copy = command;
        // A stale "copied" would describe a payload that has since changed.
        const label = copyButton?.querySelector<HTMLElement>(".copy-label");
        if (label) label.textContent = "copy";
      },
      { signal: scope.signal },
    );
  }

  return scope.cleanup;
}
