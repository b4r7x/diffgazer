import { act, renderHook, waitFor } from "@testing-library/react";
import { StrictMode } from "react";
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
  it("shares document change notifications and unsubscribes after the last subscriber", async () => {
    const queueMicrotask = vi.spyOn(window, "queueMicrotask");
    const firstContainer = document.createElement("div");
    const secondContainer = document.createElement("div");
    document.body.append(firstContainer, secondContainer);

    const first = renderHook(() => useSelectableCollection({ current: firstContainer }));
    const second = renderHook(() => useSelectableCollection({ current: secondContainer }));
    queueMicrotask.mockClear();

    window.dispatchEvent(new Event("resize"));
    window.dispatchEvent(new Event("resize"));
    expect(queueMicrotask).toHaveBeenCalledOnce();
    await act(async () => Promise.resolve());

    first.unmount();
    queueMicrotask.mockClear();
    document.dispatchEvent(new Event("visibilitychange"));
    expect(queueMicrotask).toHaveBeenCalledOnce();
    await act(async () => Promise.resolve());

    second.unmount();
    queueMicrotask.mockClear();
    window.dispatchEvent(new Event("resize"));
    expect(queueMicrotask).not.toHaveBeenCalled();
  });

  it("keeps the item array stable when a sync does not change collection content", async () => {
    const container = document.createElement("div");
    document.body.append(container);
    const containerRef = { current: container };
    const { result } = renderHook(() => useSelectableCollection(containerRef));
    const item = document.createElement("button");
    container.append(item);

    act(() => {
      result.current.registerItem("item", "item", false, item);
    });
    await waitFor(() => expect(result.current.items).toHaveLength(1));
    const items = result.current.items;

    window.dispatchEvent(new Event("resize"));
    await act(async () => Promise.resolve());

    expect(result.current.items).toBe(items);
  });

  it("keeps visible items stable while StrictMode tracks fieldset eligibility changes", async () => {
    const container = document.createElement("div");
    const ancestor = document.createElement("fieldset");
    const item = document.createElement("button");
    ancestor.disabled = true;
    ancestor.append(item);
    container.append(ancestor);
    document.body.append(container);

    const containerRef = { current: container };
    const { result } = renderHook(() => useSelectableCollection(containerRef), {
      wrapper: StrictMode,
    });

    act(() => {
      result.current.registerItem("item", "item", false, item);
    });
    await waitFor(() => expect(result.current.items).toHaveLength(1));
    expect(result.current.eligibleItems).toHaveLength(0);
    const items = result.current.items;

    ancestor.disabled = false;
    await waitFor(() =>
      expect(result.current.eligibleItems.map((entry) => entry.value)).toEqual(["item"]),
    );
    expect(result.current.items).toBe(items);

    ancestor.disabled = true;
    await waitFor(() => expect(result.current.eligibleItems).toHaveLength(0));
    expect(result.current.items).toBe(items);
  });

  it("resynchronizes inert eligibility under StrictMode", async () => {
    const container = document.createElement("div");
    const ancestor = document.createElement("div");
    const item = document.createElement("button");
    ancestor.append(item);
    container.append(ancestor);
    document.body.append(container);

    const { result } = renderHook(() => useSelectableCollection({ current: container }), {
      wrapper: StrictMode,
    });

    act(() => result.current.registerItem("item", "item", false, item));
    await waitFor(() => expect(result.current.eligibleItems).toHaveLength(1));

    ancestor.setAttribute("inert", "");
    await waitFor(() => expect(result.current.eligibleItems).toHaveLength(0));

    ancestor.removeAttribute("inert");
    await waitFor(() => expect(result.current.eligibleItems).toHaveLength(1));
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
