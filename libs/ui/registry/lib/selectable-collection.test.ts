import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  getEnabledSelectableCollectionItems,
  isSelectableItemEligible,
  resolveSelectableCollectionItem,
  type SelectableCollectionItem,
  useSelectableCollection,
} from "./selectable-collection";

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

describe("useSelectableCollection", () => {
  it("shares one event-driven document boundary and restores instrumentation after the last subscriber", async () => {
    const originalInsertRule = CSSStyleSheet.prototype.insertRule;
    const setInterval = vi.spyOn(window, "setInterval");
    const firstContainer = document.createElement("div");
    const secondContainer = document.createElement("div");
    document.body.append(firstContainer, secondContainer);

    const first = renderHook(() => useSelectableCollection({ current: firstContainer }));
    await waitFor(() => expect(CSSStyleSheet.prototype.insertRule).not.toBe(originalInsertRule));
    setInterval.mockClear();
    const sharedInsertRule = CSSStyleSheet.prototype.insertRule;
    const second = renderHook(() => useSelectableCollection({ current: secondContainer }));

    expect(CSSStyleSheet.prototype.insertRule).toBe(sharedInsertRule);
    expect(setInterval).not.toHaveBeenCalled();

    first.unmount();
    expect(CSSStyleSheet.prototype.insertRule).toBe(sharedInsertRule);
    second.unmount();
    expect(CSSStyleSheet.prototype.insertRule).toBe(originalInsertRule);
  });

  it("coalesces CSSOM invalidations and stops scheduling after final unsubscribe", async () => {
    const style = document.createElement("style");
    document.head.append(style);
    const sheet = style.sheet;
    if (!sheet) throw new Error("Expected a fixture stylesheet");
    const container = document.createElement("div");
    document.body.append(container);
    const containerRef = { current: container };
    const originalInsertRule = CSSStyleSheet.prototype.insertRule;
    const queueMicrotask = vi.spyOn(window, "queueMicrotask");
    const collection = renderHook(() => useSelectableCollection(containerRef));
    await waitFor(() => expect(CSSStyleSheet.prototype.insertRule).not.toBe(originalInsertRule));
    queueMicrotask.mockClear();

    sheet.insertRule(".first-rule { display: block; }");
    sheet.insertRule(".second-rule { display: block; }");
    sheet.deleteRule(1);

    expect(queueMicrotask).toHaveBeenCalledOnce();
    await act(async () => Promise.resolve());

    collection.unmount();
    queueMicrotask.mockClear();
    sheet.insertRule(".after-unsubscribe { display: block; }");
    expect(queueMicrotask).not.toHaveBeenCalled();
  });

  it("resynchronizes eligibility after CSSOM rule insertion and deletion", async () => {
    const style = document.createElement("style");
    document.head.append(style);
    const sheet = style.sheet;
    if (!sheet) throw new Error("Expected a fixture stylesheet");
    const container = document.createElement("div");
    const hiddenByRule = document.createElement("button");
    hiddenByRule.className = "hidden-by-cssom";
    const visible = document.createElement("button");
    container.append(hiddenByRule, visible);
    document.body.append(container);
    const containerRef = { current: container };
    const nativeGetComputedStyle = window.getComputedStyle.bind(window);
    vi.spyOn(window, "getComputedStyle").mockImplementation((element, pseudoElement) => {
      const computedStyle = nativeGetComputedStyle(element, pseudoElement);
      const isHiddenByRule =
        element === hiddenByRule &&
        Array.from(sheet.cssRules).some((rule) => rule.cssText.includes("visibility: hidden"));
      if (isHiddenByRule) {
        Object.defineProperty(computedStyle, "visibility", {
          configurable: true,
          value: "hidden",
        });
      }
      return computedStyle;
    });
    const { result } = renderHook(() => useSelectableCollection(containerRef));

    act(() => {
      result.current.registerItem("hidden", "hidden", false, hiddenByRule);
      result.current.registerItem("visible", "visible", false, visible);
    });
    await waitFor(() => expect(result.current.items).toHaveLength(2));

    const ruleIndex = sheet.insertRule(".hidden-by-cssom { visibility: hidden; }");
    await waitFor(() => {
      expect(
        getEnabledSelectableCollectionItems(result.current.items, false).map((item) => item.value),
      ).toEqual(["visible"]);
    });

    sheet.deleteRule(ruleIndex);
    await waitFor(() => {
      expect(
        getEnabledSelectableCollectionItems(result.current.items, false).map((item) => item.value),
      ).toEqual(["hidden", "visible"]);
    });
  });

  it.each<SkippedAttribute>([
    "hidden",
    "inert",
    "aria-hidden",
  ])("observes a late-attached container for later %s changes", async (attribute) => {
    const containerRef: { current: HTMLElement | null } = { current: null };
    const container = document.createElement("div");
    const item = document.createElement("button");
    container.append(item);
    document.body.append(container);
    const { result, rerender } = renderHook(() => useSelectableCollection(containerRef));

    act(() => result.current.registerItem("item", "item", false, item));
    containerRef.current = container;
    rerender();

    await waitFor(() => {
      expect(getEnabledSelectableCollectionItems(result.current.items, false)).toHaveLength(1);
    });

    item.setAttribute(attribute, attribute === "aria-hidden" ? "true" : "");
    await waitFor(() => {
      expect(getEnabledSelectableCollectionItems(result.current.items, false)).toHaveLength(0);
    });

    item.removeAttribute(attribute);
    await waitFor(() => {
      expect(getEnabledSelectableCollectionItems(result.current.items, false)).toHaveLength(1);
    });
  });

  it("disconnects the previous observer and measures a replacement container", async () => {
    const firstContainer = document.createElement("div");
    const secondContainer = document.createElement("div");
    const firstItem = document.createElement("button");
    const secondItem = document.createElement("button");
    firstContainer.append(firstItem, secondItem);
    document.body.append(firstContainer, secondContainer);
    const containerRef: { current: HTMLElement | null } = { current: firstContainer };
    const { result, rerender } = renderHook(() => useSelectableCollection(containerRef));

    act(() => {
      result.current.registerItem("first", "first", false, firstItem);
      result.current.registerItem("second", "second", false, secondItem);
    });
    await waitFor(() => {
      expect(result.current.items.map((item) => item.value)).toEqual(["first", "second"]);
    });

    secondContainer.append(secondItem, firstItem);
    containerRef.current = secondContainer;
    rerender();

    await waitFor(() => {
      expect(result.current.items.map((item) => item.value)).toEqual(["second", "first"]);
    });

    const itemsAfterReplacement = result.current.items;
    firstContainer.hidden = true;
    await act(async () => Promise.resolve());
    expect(result.current.items).toBe(itemsAfterReplacement);

    firstItem.hidden = true;
    await waitFor(() => {
      expect(
        getEnabledSelectableCollectionItems(result.current.items, false).map((item) => item.value),
      ).toEqual(["second"]);
    });
  });
});
