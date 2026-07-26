import stripAnsi from "strip-ansi";
import { expect } from "vitest";

// The terminal mirror of apps/web/src/testing/reticle.ts: heavy corners mean
// "this is the pane your keys drive", so a rendered screen wears exactly one
// set of them. The top-left corner is counted because a pane draws it once.
export function expectSingleHeavyCornerPane(frame: string | undefined): void {
  const corners = stripAnsi(frame ?? "").split("┏").length - 1;
  expect(corners, `expected exactly one heavy-corner pane, found ${corners}`).toBe(1);
}
