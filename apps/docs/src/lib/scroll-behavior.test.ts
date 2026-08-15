import { stubMatchMedia } from "@diffgazer/core/testing/match-media";
import { afterEach, describe, expect, it } from "vitest";
import { scrollBehaviorFor } from "./scroll-behavior";

afterEach(() => {
  document.body.replaceChildren();
});

function renderElement(): HTMLElement {
  const element = document.createElement("div");
  document.body.append(element);
  return element;
}

describe("scrollBehaviorFor", () => {
  it("animates the scroll by default", () => {
    stubMatchMedia(() => false);

    expect(scrollBehaviorFor(renderElement())).toBe("smooth");
  });

  it("jumps instead of animating when the reader asked for reduced motion", () => {
    stubMatchMedia((query) => query.includes("prefers-reduced-motion"));

    expect(scrollBehaviorFor(renderElement())).toBe("instant");
  });
});
