import { afterEach, describe, expect, it } from "vitest";
import {
  focusSelectableItem,
  getSelectableItemElements,
} from "../focus";

describe("focus helpers", () => {
  afterEach(() => {
    document.body.innerHTML = "";
  });

  it("focuses selectable items by role and value within the direct group", () => {
    document.body.innerHTML = `
      <div role="group" id="outer">
        <div role="checkbox" data-value="first" tabindex="0"></div>
        <div role="checkbox" data-value="second" tabindex="0"></div>
        <div role="group">
          <div role="checkbox" data-value="nested" tabindex="0"></div>
        </div>
      </div>
    `;
    const container = document.getElementById("outer");

    expect(getSelectableItemElements(container, "checkbox")).toHaveLength(2);
    expect(focusSelectableItem(container, { role: "checkbox", value: "second" })).toBe("second");
    expect(document.activeElement).toHaveAttribute("data-value", "second");
  });

  it("falls back to the first enabled selectable item", () => {
    document.body.innerHTML = `
      <div role="group" id="group">
        <div role="radio" data-value="disabled" aria-disabled="true" tabindex="-1"></div>
        <div role="radio" data-value="enabled" tabindex="0"></div>
      </div>
    `;

    expect(focusSelectableItem(document.getElementById("group"), { role: "radio", value: "missing" }))
      .toBe("enabled");
    expect(document.activeElement).toHaveAttribute("data-value", "enabled");
  });

  it("scopes radio items to the direct radiogroup", () => {
    document.body.innerHTML = `
      <div role="radiogroup" id="outer">
        <div role="radio" data-value="outer-a" tabindex="0"></div>
        <div role="radiogroup">
          <div role="radio" data-value="inner-a" tabindex="0"></div>
        </div>
        <div role="radio" data-value="outer-b" tabindex="0"></div>
      </div>
    `;
    const container = document.getElementById("outer");

    expect(getSelectableItemElements(container, "radio").map((item) => item.dataset.value))
      .toEqual(["outer-a", "outer-b"]);
    expect(focusSelectableItem(container, { role: "radio", value: "inner-a" })).toBe("outer-a");
  });

  it("prefers explicit selectable owners over semantic role groups", () => {
    document.body.innerHTML = `
      <div id="group" role="group" data-diffgazer-selectable-owner="checkbox">
        <div role="group" aria-label="Semantic section">
          <div role="checkbox" data-value="first" tabindex="0"></div>
        </div>
      </div>
    `;
    const container = document.getElementById("group");

    expect(focusSelectableItem(container, { role: "checkbox", value: "first" })).toBe("first");
  });
});
