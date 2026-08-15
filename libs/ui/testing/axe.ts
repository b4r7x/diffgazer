import axeCore, { type RunOptions } from "axe-core";

/**
 * Runs axe and removes the `<style>` axe injects into the document head.
 *
 * axe leaves `* { pointer-events: all }` behind after every run. jsdom's
 * cascade then resolves `display` for `[hidden]` elements to `block` in later
 * tests of the same file, so eligibility checks that read `getComputedStyle`
 * (isReachable, selectable collections) silently see hidden elements as
 * reachable. Cleaning up keeps the helper free of cross-test document state.
 */
export async function axe(container: Element, options?: RunOptions) {
  const { head } = container.ownerDocument;
  const injectedBefore = new Set(head.querySelectorAll("style"));

  try {
    return await axeCore.run(container, {
      ...options,
      rules: {
        "color-contrast": { enabled: false },
        ...options?.rules,
      },
    });
  } finally {
    for (const style of head.querySelectorAll("style")) {
      if (!injectedBefore.has(style)) style.remove();
    }
  }
}
