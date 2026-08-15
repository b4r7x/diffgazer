import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import CardInteractiveExample from "./card-interactive";

describe("card interactive example", () => {
  it("leaves the forced-state matrix swatches non-interactive", () => {
    const { container } = render(<CardInteractiveExample />);

    const cards = [...container.querySelectorAll('[data-slot="card"]')];
    const interactive = cards.filter((card) => card.hasAttribute("data-interactive"));

    expect(cards.length).toBeGreaterThan(interactive.length);
    expect(interactive.map((card) => card.tagName)).toEqual(["A", "A", "A", "A", "BUTTON"]);
  });
});
