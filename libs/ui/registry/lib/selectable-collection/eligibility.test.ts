import { afterEach, describe, expect, it } from "vitest";
import {
  getEnabledSelectableCollectionItems,
  isSelectableItemEligible,
  resolveSelectableCollectionItem,
  type SelectableCollectionItem,
} from "../selectable-collection";

type SkippedAttribute = "hidden" | "inert" | "aria-hidden";

function appendItem(
  value: string,
  options: { disabled?: boolean; attribute?: SkippedAttribute; parent?: HTMLElement } = {},
): SelectableCollectionItem {
  const element = document.createElement("button");
  if (options.attribute === "aria-hidden") element.setAttribute("aria-hidden", "true");
  else if (options.attribute) element.setAttribute(options.attribute, "");
  (options.parent ?? document.body).append(element);
  return { id: value, value, disabled: options.disabled ?? false, element };
}

afterEach(() => {
  document.body.innerHTML = "";
});

describe("isSelectableItemEligible", () => {
  it("accepts an enabled, mounted, unskipped item", () => {
    expect(isSelectableItemEligible(appendItem("a"))).toBe(true);
  });

  it("rejects disabled and unmounted items", () => {
    expect(isSelectableItemEligible(appendItem("a", { disabled: true }))).toBe(false);
    expect(isSelectableItemEligible({ id: "b", value: "b", disabled: false, element: null })).toBe(
      false,
    );
  });

  it.each<SkippedAttribute>([
    "hidden",
    "inert",
    "aria-hidden",
  ])("rejects an item carrying %s", (attribute) => {
    expect(isSelectableItemEligible(appendItem("a", { attribute }))).toBe(false);
  });

  it("rejects an item nested under a skipped ancestor", () => {
    const parent = document.createElement("div");
    parent.setAttribute("inert", "");
    document.body.append(parent);
    expect(isSelectableItemEligible(appendItem("a", { parent }))).toBe(false);
  });
});

describe("getEnabledSelectableCollectionItems", () => {
  it("excludes a hidden first item from the enabled set", () => {
    const hidden = appendItem("first", { attribute: "hidden" });
    const visible = appendItem("second");

    const enabled = getEnabledSelectableCollectionItems([hidden, visible], false);

    expect(enabled.map((item) => item.value)).toEqual(["second"]);
  });
});

describe("resolveSelectableCollectionItem", () => {
  it("falls back past a skipped preferred value to the first eligible item", () => {
    const hidden = appendItem("first", { attribute: "aria-hidden" });
    const visible = appendItem("second");

    const resolved = resolveSelectableCollectionItem([hidden, visible], "first");

    expect(resolved?.value).toBe("second");
  });
});
