import { act, renderHook, waitFor } from "@testing-library/react";
import { StrictMode } from "react";
import { afterEach, describe, expect, it } from "vitest";
import {
  getEnabledSelectableCollectionItems,
  useSelectableCollection,
} from "../selectable-collection";

type SkippedAttribute = "hidden" | "inert" | "aria-hidden";

afterEach(() => {
  document.body.innerHTML = "";
});

describe("useSelectableCollection", () => {
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
      expect(result.current.items).toHaveLength(1);
      expect(result.current.eligibleItems).toHaveLength(1);
    });

    item.setAttribute(attribute, attribute === "aria-hidden" ? "true" : "");
    await waitFor(() => {
      expect(result.current.items).toHaveLength(0);
      expect(result.current.eligibleItems).toHaveLength(0);
    });

    item.removeAttribute(attribute);
    await waitFor(() => {
      expect(result.current.items).toHaveLength(1);
      expect(result.current.eligibleItems).toHaveLength(1);
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
