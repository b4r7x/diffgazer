import { expect } from "vitest";

// Brackets mean "this is the thing your keys drive", so a rendered view carries
// at most one bracketed element: either a panel wearing the resting viewfinder
// frame or a pane marked focused. Both render corners, so both count.
// Only the panel root draws corners, so the focused branch is scoped to it:
// Panel.Label publishes data-state="focused" too, to repaint a readout in --ring,
// and that label is seated between the arms rather than being a frame of its own.
const BRACKETED = '[data-frame="viewfinder"], [data-slot="panel"][data-state="focused"]';

/** Asserts the view renders exactly one bracketed element. */
export function expectSingleReticle(container: HTMLElement): void {
  const bracketed = container.querySelectorAll(BRACKETED);
  expect(
    bracketed.length,
    `expected exactly one bracketed element, found ${bracketed.length}`,
  ).toBe(1);
}
