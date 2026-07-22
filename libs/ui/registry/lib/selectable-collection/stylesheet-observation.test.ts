import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useSelectableCollection } from "../selectable-collection";

type SelectableCollectionModule = typeof import("../selectable-collection");
type SelectableCollectionHookModule = Pick<SelectableCollectionModule, "useSelectableCollection">;

interface StyleSheetMethods {
  insertRule: CSSStyleSheet["insertRule"];
  deleteRule: CSSStyleSheet["deleteRule"];
  replace: CSSStyleSheet["replace"];
  replaceSync: CSSStyleSheet["replaceSync"];
}

function getStyleSheetPrototype(View: Window): CSSStyleSheet {
  if (!("CSSStyleSheet" in View) || typeof View.CSSStyleSheet !== "function") {
    throw new Error("Expected CSSStyleSheet constructor");
  }
  return View.CSSStyleSheet.prototype;
}

function getStyleSheetMethods(prototype: CSSStyleSheet): StyleSheetMethods {
  return {
    insertRule: prototype.insertRule,
    deleteRule: prototype.deleteRule,
    replace: prototype.replace,
    replaceSync: prototype.replaceSync,
  };
}

function expectStyleSheetMethods(prototype: CSSStyleSheet, expected: StyleSheetMethods): void {
  expect(getStyleSheetMethods(prototype)).toEqual(expected);
}

function renderCollection(
  module: SelectableCollectionHookModule,
  ownerDocument: Document = document,
) {
  const container = ownerDocument.createElement("div");
  ownerDocument.body.append(container);
  const hook = renderHook(() => module.useSelectableCollection({ current: container }));
  return { container, ...hook };
}

async function loadSelectableCollectionCopy(): Promise<SelectableCollectionModule> {
  vi.resetModules();
  return import("../selectable-collection");
}

afterEach(() => {
  document.body.innerHTML = "";
});

describe("useSelectableCollection", () => {
  it("shares document change notifications and unsubscribes after the last subscriber", async () => {
    const queueMicrotask = vi.spyOn(window, "queueMicrotask");
    const styleSheetPrototype = getStyleSheetPrototype(window);
    const originalMethods = getStyleSheetMethods(styleSheetPrototype);
    const firstContainer = document.createElement("div");
    const secondContainer = document.createElement("div");
    document.body.append(firstContainer, secondContainer);

    const first = renderHook(() => useSelectableCollection({ current: firstContainer }));
    const observedMethods = getStyleSheetMethods(styleSheetPrototype);
    expect(observedMethods).not.toEqual(originalMethods);
    const second = renderHook(() => useSelectableCollection({ current: secondContainer }));
    expectStyleSheetMethods(styleSheetPrototype, observedMethods);
    queueMicrotask.mockClear();

    window.dispatchEvent(new Event("resize"));
    window.dispatchEvent(new Event("resize"));
    expect(queueMicrotask).toHaveBeenCalledOnce();
    await act(async () => Promise.resolve());

    first.unmount();
    expectStyleSheetMethods(styleSheetPrototype, observedMethods);
    queueMicrotask.mockClear();
    document.dispatchEvent(new Event("visibilitychange"));
    expect(queueMicrotask).toHaveBeenCalledOnce();
    await act(async () => Promise.resolve());

    second.unmount();
    expectStyleSheetMethods(styleSheetPrototype, originalMethods);
    queueMicrotask.mockClear();
    window.dispatchEvent(new Event("resize"));
    expect(queueMicrotask).not.toHaveBeenCalled();
  });

  it("keeps duplicate module copies subscribed until both release the shared stylesheet methods", async () => {
    const styleSheetPrototype = getStyleSheetPrototype(window);
    const originalMethods = getStyleSheetMethods(styleSheetPrototype);
    const firstModule = await loadSelectableCollectionCopy();
    const first = renderCollection(firstModule);
    const observedMethods = getStyleSheetMethods(styleSheetPrototype);
    expect(observedMethods).not.toEqual(originalMethods);

    const secondModule = await loadSelectableCollectionCopy();
    const second = renderCollection(secondModule);
    expectStyleSheetMethods(styleSheetPrototype, observedMethods);
    const item = document.createElement("button");
    item.className = "duplicate-module-hidden";
    second.container.append(item);
    act(() => second.result.current.registerItem("second", "second", false, item));
    await waitFor(() => expect(second.result.current.eligibleItems).toHaveLength(1));

    first.unmount();
    expectStyleSheetMethods(styleSheetPrototype, observedMethods);
    const style = document.createElement("style");
    document.head.append(style);
    const ruleIndex = style.sheet?.insertRule(".duplicate-module-hidden { display: none; }");
    if (ruleIndex === undefined) throw new Error("Expected stylesheet rule insertion");
    await waitFor(() => expect(second.result.current.eligibleItems).toHaveLength(0));
    style.sheet?.deleteRule(ruleIndex);

    second.unmount();
    expectStyleSheetMethods(styleSheetPrototype, originalMethods);
  });

  it("does not replace stylesheet methods installed by a later owner during teardown", () => {
    const styleSheetPrototype = getStyleSheetPrototype(window);
    const originalMethods = getStyleSheetMethods(styleSheetPrototype);
    const collection = renderCollection({ useSelectableCollection });
    const observedMethods = getStyleSheetMethods(styleSheetPrototype);
    const laterMethods: StyleSheetMethods = {
      insertRule(rule, index) {
        return index === undefined
          ? observedMethods.insertRule.call(this, rule)
          : observedMethods.insertRule.call(this, rule, index);
      },
      deleteRule(index) {
        observedMethods.deleteRule.call(this, index);
      },
      replace(text) {
        return observedMethods.replace.call(this, text);
      },
      replaceSync(text) {
        observedMethods.replaceSync.call(this, text);
      },
    };

    styleSheetPrototype.insertRule = laterMethods.insertRule;
    styleSheetPrototype.deleteRule = laterMethods.deleteRule;
    styleSheetPrototype.replace = laterMethods.replace;
    styleSheetPrototype.replaceSync = laterMethods.replaceSync;
    try {
      collection.unmount();
      expectStyleSheetMethods(styleSheetPrototype, laterMethods);
    } finally {
      styleSheetPrototype.insertRule = originalMethods.insertRule;
      styleSheetPrototype.deleteRule = originalMethods.deleteRule;
      styleSheetPrototype.replace = originalMethods.replace;
      styleSheetPrototype.replaceSync = originalMethods.replaceSync;
    }
  });

  it("isolates stylesheet observation and teardown between owner windows", () => {
    const iframe = document.createElement("iframe");
    document.body.append(iframe);
    const frameDocument = iframe.contentDocument;
    const frameWindow = iframe.contentWindow;
    if (!frameDocument || !frameWindow) throw new Error("Expected iframe document and window");

    const mainPrototype = getStyleSheetPrototype(window);
    const framePrototype = getStyleSheetPrototype(frameWindow);
    const mainOriginals = getStyleSheetMethods(mainPrototype);
    const frameOriginals = getStyleSheetMethods(framePrototype);
    const main = renderCollection({ useSelectableCollection });
    const frame = renderCollection({ useSelectableCollection }, frameDocument);
    const mainObservers = getStyleSheetMethods(mainPrototype);
    const frameObservers = getStyleSheetMethods(framePrototype);
    expect(mainObservers).not.toEqual(mainOriginals);
    expect(frameObservers).not.toEqual(frameOriginals);
    expect(mainObservers).not.toEqual(frameObservers);

    main.unmount();
    expectStyleSheetMethods(mainPrototype, mainOriginals);
    expectStyleSheetMethods(framePrototype, frameObservers);

    frame.unmount();
    expectStyleSheetMethods(framePrototype, frameOriginals);
    iframe.remove();
  });
});
