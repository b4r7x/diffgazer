import { act, render, renderHook, screen, waitFor } from "@testing-library/react";
import { createElement, Fragment, StrictMode, useId, useLayoutEffect, useRef } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  getEnabledSelectableCollectionItems,
  useSelectableCollection,
} from "./selectable-collection";

type SkippedAttribute = "hidden" | "inert" | "aria-hidden";

type SelectableCollectionRegistration = Pick<
  ReturnType<typeof useSelectableCollection>,
  "registerItem" | "unregisterItem"
>;

function RegistrationItem({
  index,
  registerItem,
  unregisterItem,
}: SelectableCollectionRegistration & { index: number }) {
  const id = useId();
  const itemRef = useRef<HTMLButtonElement>(null);

  useLayoutEffect(() => {
    registerItem(id, `item-${index}`, false, itemRef.current);
    return () => unregisterItem(id);
  }, [id, index, registerItem, unregisterItem]);

  return createElement("button", {
    ref: itemRef,
    "data-registration-reconciliation-probe": "",
    type: "button",
  });
}

function RegistrationHarness({ count }: { count: number }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const { items, registerItem, unregisterItem } = useSelectableCollection(containerRef);

  return createElement(
    Fragment,
    null,
    createElement("output", { "aria-label": "registered item count" }, items.length),
    createElement(
      "div",
      { ref: containerRef },
      Array.from({ length: count }, (_, index) =>
        createElement(RegistrationItem, {
          index,
          key: index,
          registerItem,
          unregisterItem,
        }),
      ),
    ),
  );
}

afterEach(() => {
  document.body.innerHTML = "";
});

describe("useSelectableCollection", () => {
  it("coalesces one mount commit's item registrations into one reconciliation", async () => {
    const originalGetComputedStyle = window.getComputedStyle.bind(window);
    let itemStyleReads = 0;
    const getComputedStyle = vi
      .spyOn(window, "getComputedStyle")
      .mockImplementation((element, pseudoElement) => {
        if (
          element instanceof HTMLElement &&
          element.hasAttribute("data-registration-reconciliation-probe")
        ) {
          itemStyleReads += 1;
        }
        return originalGetComputedStyle(element, pseudoElement);
      });

    const mountAndCountStyleReads = async (count: number) => {
      itemStyleReads = 0;
      const view = render(createElement(RegistrationHarness, { count }));
      await waitFor(() =>
        expect(screen.getByLabelText("registered item count")).toHaveTextContent(String(count)),
      );
      view.unmount();
      return itemStyleReads;
    };

    const reads = await mountAndCountStyleReads(6);
    const doubledReads = await mountAndCountStyleReads(12);

    // Reconciling once per mount reads each item a fixed number of times, so
    // doubling the collection doubles the reads. Reconciling once per child
    // registration is quadratic, which nearly quadruples them.
    expect(reads).toBeGreaterThan(0);
    expect(doubledReads).toBeLessThan(reads * 3);

    getComputedStyle.mockRestore();
  });

  it("commits a post-mount registration in the layout pass that rendered it", () => {
    const view = render(createElement(RegistrationHarness, { count: 1 }));
    expect(screen.getByLabelText("registered item count")).toHaveTextContent("1");

    act(() => {
      view.rerender(createElement(RegistrationHarness, { count: 2 }));
    });

    // Read before any microtask runs: the item this commit registered is already
    // in the collection, so roving tabIndex and aria-activedescendant cannot be
    // a paint behind what the user sees.
    expect(screen.getByLabelText("registered item count")).toHaveTextContent("2");
    view.unmount();
  });

  it("shares one scheduled document notification and unsubscribes after the last subscriber", async () => {
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
