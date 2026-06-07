import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { afterAll, beforeAll } from "vitest";

const THEME_BASE_CSS_PATH = resolve(fileURLToPath(import.meta.url), "../../styles/theme-base.css");

const REDUCED_MOTION_BLOCK_RE =
  /@media\s*\(prefers-reduced-motion:\s*reduce\)\s*\{\s*:root\s*\{[^}]*\}\s*\}/;

const REQUIRED_ENTER_TOKEN = /--ui-content-enter-from-top:\s*ui-content-enter-fade/;
const REQUIRED_EXIT_TOKEN = /--ui-content-exit-to-top:\s*ui-content-exit-fade/;

function extractReducedMotionRootRule(): string {
  const sourceCss = readFileSync(THEME_BASE_CSS_PATH, "utf8");
  const block = sourceCss.match(REDUCED_MOTION_BLOCK_RE)?.[0];
  if (!block) {
    throw new Error(
      "theme-base.css must declare a @media (prefers-reduced-motion: reduce) :root block",
    );
  }
  const rootRule = block.match(/:root\s*\{[^}]*\}/)?.[0];
  if (!rootRule || !REQUIRED_ENTER_TOKEN.test(rootRule) || !REQUIRED_EXIT_TOKEN.test(rootRule)) {
    throw new Error(
      "theme-base.css reduced-motion block must override --ui-content-enter-from-* to ui-content-enter-fade and --ui-content-exit-to-* to ui-content-exit-fade",
    );
  }
  return rootRule;
}

/**
 * Inject the `:root` overrides from `theme-base.css`'s
 * `@media (prefers-reduced-motion: reduce)` block as a top-level rule on the
 * current document. jsdom does not evaluate @media queries inside parsed
 * stylesheets, so simulating the reduced-motion state means lifting the rule
 * out of the @media wrapper. Returns a cleanup function that removes the
 * injected `<style>` element.
 */
export function injectReducedMotionTheme(): () => void {
  const rootRule = extractReducedMotionRootRule();
  const style = document.createElement("style");
  style.dataset.testSource = "theme-base.css#reduced-motion";
  style.textContent = rootRule;
  document.head.appendChild(style);
  return () => {
    style.remove();
  };
}

/**
 * Vitest fixture: registers `beforeAll` to inject the reduced-motion
 * `:root` override and `afterAll` to remove it. Call from inside a `describe`
 * block; the lifecycle hooks are scoped to that describe.
 */
export function applyReducedMotionFixture(): void {
  let cleanup: (() => void) | null = null;
  beforeAll(() => {
    cleanup = injectReducedMotionTheme();
  });
  afterAll(() => {
    cleanup?.();
    cleanup = null;
  });
}
