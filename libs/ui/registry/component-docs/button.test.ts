import { describe, expect, it } from "vitest";
import { buttonDoc } from "./button";

describe("buttonDoc", () => {
  it("documents highlighted state across every Button rendering mode", () => {
    expect(buttonDoc.dataAttributes).toContainEqual({
      attribute: "data-highlighted",
      appliesTo: "Button in button, anchor, and render-prop modes",
      values: "present when highlighted",
      description: "Marks the button as highlighted by a parent collection.",
    });
  });
});
