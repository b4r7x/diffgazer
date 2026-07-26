import { expect } from "vitest";

/**
 * Rule 2 of the reticle grammar: a screen with a keyboard-driven pane renders
 * that reticle exactly once, and never a second one.
 *
 * `data-state="focused"` is a visual affordance, never an ARIA state, so no role
 * or accessibility query can catch a second reticle, so the rule has to be
 * asserted explicitly. Here that assertion belongs to the Panel primitive's own
 * tests; the app surfaces assert it over their screens through their own local
 * reticle helpers.
 */
export function expectSingleReticle(container: HTMLElement): void {
  expect(container.querySelectorAll('[data-slot="panel"][data-state="focused"]')).toHaveLength(1);
}
